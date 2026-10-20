"""Serie III · Mercado — respuesta de la oferta de caña al precio del azúcar.

Diseño: panel anual país-año 2000-2023 en primeras diferencias de logaritmos, con efectos fijos por país (cada país
con su propio ritmo de crecimiento) y rezagos distribuidos del cambio del precio. Como el precio es el mismo para
todos los países, la variación que identifica el efecto es la del tiempo (~20 años): los errores se agrupan por año
y la significancia se confirma con una prueba de permutación de los años del precio.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.api as sm


def precio_anual(s: pd.DataFrame) -> pd.Series:
    """Promedio del año calendario del contrato más próximo (¢/lb). 2000 empieza en marzo."""
    p = s.close.groupby(s.index.year).mean()
    p.index.name = "anio"
    return p


def panel_oferta(P: pd.DataFrame, paises: list[str], precio: pd.Series, rezagos=range(-1, 5)) -> pd.DataFrame:
    """Panel con cambios anuales (log) de área y producción y cambios del precio con rezagos y adelantos.

    dlp_k = cambio del log del precio k años antes (k = −1 es el año siguiente: placebo).
    """
    d = P[P.pais.isin(paises)].copy().sort_values(["pais", "anio"])
    d = d[(d.area > 0) & (d["prod"] > 0)]
    g = d.groupby("pais")
    d["dla"] = g.area.transform(lambda x: np.log(x).diff())
    d["dlq"] = g["prod"].transform(lambda x: np.log(x).diff())
    d.loc[d.anio != g.anio.shift() + 1, ["dla", "dlq"]] = np.nan   # años no consecutivos
    g = d.groupby("pais")
    for k in (1, 2):                                                 # inercia propia (rezagos de la dependiente)
        d[f"dla_l{k}"], d[f"dlq_l{k}"] = g.dla.shift(k), g.dlq.shift(k)
    d["oficial"] = (d.f_area == "A") & (g.f_area.shift() == "A") & (d.f_prod == "A") & (g.f_prod.shift() == "A")
    dlp = np.log(precio).diff()
    for k in rezagos:
        d[f"dlp{k}".replace("-", "m")] = d.anio.map(dlp.shift(k))
    return d.reset_index(drop=True)


def nombre(k: int) -> str:
    return f"dlp{k}".replace("-", "m")


def estimar(D: pd.DataFrame, dep: str, lags, fe: bool = True, peso: str | None = None, cov: str = "anio",
            propios: int = 0) -> dict:
    """OLS en diferencias con efectos fijos por país (dentro de país), errores agrupados por año o Driscoll-Kraay.

    propios = k agrega los k primeros rezagos de la propia variable dependiente (ARDL): controla la inercia del área o
    de la producción, que de otro modo puede contaminar los rezagos del precio si la oferta también mueve el precio.
    """
    cols = [nombre(k) for k in lags] + [f"{dep}_l{k}" for k in range(1, propios + 1)]
    d = D.dropna(subset=[dep] + cols).copy()
    y, X = d[dep], d[cols]
    if fe:
        y = y - d.groupby("pais")[dep].transform("mean")
        X = X - d.groupby("pais")[cols].transform("mean")
    else:
        X = sm.add_constant(X)
    w = d[peso] if peso else None
    mod = sm.WLS(y, X, weights=w) if peso else sm.OLS(y, X)
    if cov == "anio":
        fit = mod.fit(cov_type="cluster", cov_kwds={"groups": d.anio.values})
    else:   # Driscoll-Kraay: correlación entre países y en el tiempo
        t = (d.anio - d.anio.min()).values
        fit = mod.fit(cov_type="hac-groupsum", cov_kwds={"time": t, "maxlags": 2})
    pos = [nombre(k) for k in lags if k >= 1]                          # solo rezagos del precio ≥ 1 en la suma
    v = np.zeros(len(fit.params)); v[[list(fit.params.index).index(c) for c in pos]] = 1
    suma = float(v @ fit.params.values); se = float(np.sqrt(v @ fit.cov_params().values @ v))
    pc = [nombre(k) for k in lags]
    return {"fit": fit, "coef": fit.params[pc], "se": fit.bse[pc], "p": fit.pvalues[pc], "suma": suma,
            "propios": fit.params[[c for c in cols if c not in pc]],
            "se_suma": se, "n": int(fit.nobs), "paises": int(d.pais.nunique()), "anios": int(d.anio.nunique()), "datos": d}


def permutacion(D: pd.DataFrame, precio: pd.Series, dep: str, lags, reps: int = 2000, semilla: int = 20261019, **kw) -> dict:
    """¿Qué tan seguido sale una suma de efectos tan grande si el orden de los años del precio fuera azar?

    Se barajan los cambios anuales del precio (se rompe su relación con la oferta pero se conserva su distribución) y
    se reconstruyen los rezagos con la serie barajada.
    """
    rng = np.random.default_rng(semilla)
    base = estimar(D, dep, lags, **kw)["suma"]
    dlp = np.log(precio).diff().dropna()
    nulos = []
    for _ in range(reps):
        sim = pd.Series(rng.permutation(dlp.values), index=dlp.index)
        Dp = D.copy()
        for k in lags:
            Dp[nombre(k)] = Dp.anio.map(sim.shift(k))
        nulos.append(estimar(Dp, dep, lags, **kw)["suma"])
    nulos = np.array(nulos)
    return {"suma": base, "p_una_cola": float((nulos >= base).mean()), "p_dos_colas": float((np.abs(nulos) >= abs(base)).mean()),
            "nulo_p95": float(np.percentile(nulos, 95))}


def jackknife_anios(D: pd.DataFrame, dep: str, lags, **kw) -> pd.Series:
    """Suma de efectos quitando un año a la vez: ¿depende de un solo año?"""
    anios = sorted(D.dropna(subset=[dep] + [nombre(k) for k in lags]).anio.unique())
    return pd.Series({a: estimar(D[D.anio != a], dep, lags, **kw)["suma"] for a in anios})


def agregado(P: pd.DataFrame, paises: list[str], precio: pd.Series, lags=(1, 2, 3)) -> dict:
    """Serie mundial (suma de los países): una observación por año, errores HAC."""
    w = P[P.pais.isin(paises) & (P.anio >= precio.index.min())].groupby("anio")[["area", "prod"]].sum()
    dlp = np.log(precio).diff()
    w["dla"], w["dlq"] = np.log(w.area).diff(), np.log(w["prod"]).diff()
    out = {}
    for dep in ["dla", "dlq"]:
        X = pd.concat({nombre(k): dlp.shift(k) for k in lags}, axis=1).reindex(w.index)
        d = pd.concat([w[dep], X], axis=1).dropna()
        fit = sm.OLS(d[dep], sm.add_constant(d[X.columns])).fit(cov_type="HAC", cov_kwds={"maxlags": 2})
        v = np.r_[0, np.ones(len(lags))]
        out[dep] = {"coef": fit.params.drop("const"), "p": fit.pvalues.drop("const"), "suma": float(v @ fit.params.values),
                    "se_suma": float(np.sqrt(v @ fit.cov_params().values @ v)), "n": int(fit.nobs)}
    return out
