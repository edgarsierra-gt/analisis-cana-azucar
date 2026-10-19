"""
Serie I · Campo — curvas de rendimiento por variedad y economía del ciclo de renovación.

Idea (simple a propósito):
1. Regla fija: 4 variedades testigo presentes en etapa 5 los 12 años (CORE_CHECKS).
2. Cada parcela se compara contra el promedio de esos testigos en el mismo ensayo y corte
   (sin incluirse a sí misma). Eso quita el efecto del lugar, el año y el suelo.
3. Por variedad: log(relativo) = a + b·corte  ->  a = nivel en plantía vs testigos, b = caída extra por corte.
4. Curva absoluta = curva de los testigos × exp(a + b·corte). Con TRS relativo se obtiene el tonelaje.
5. Margen por corte con los supuestos de la prueba; ciclo óptimo = máximo margen promedio por año.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

CORE_CHECKS = ["HOCP04-838", "HOCP96-540", "L01-283", "L01-299"]  # en etapa 5 los 12 años (2010-2021)
MAX_CUTS = 5  # plantía + 4 socas: más allá no hay datos


@dataclass(frozen=True)
class Supuestos:
    """Supuestos económicos de la prueba (referenciales)."""
    precio: float = 0.20        # US$ por libra de azúcar recuperable
    corte: float = 14.0         # US$ por tonelada corta de caña (corte, alce y transporte)
    mantenimiento: float = 350  # US$ por acre por año
    renovacion: float = 1100    # US$ por acre, en el año de plantía
    barbecho: int = 0           # años sin caña antes de resembrar (0 = supuesto de la prueba)


# ----------------------------------------------------------------------------- comparación contra testigos
def relative_to_core(s5: pd.DataFrame, core: list[str] = CORE_CHECKS) -> pd.DataFrame:
    """Agrega rel_sugar y rel_trs: cociente contra el promedio de testigos núcleo del mismo ensayo y corte.

    Para un testigo núcleo, su referencia excluye su propia parcela (leave-one-out).
    """
    out = s5.copy()
    is_core = out["CLONE"].isin(core)
    for col, name in [("T_SPACRE", "rel_sugar"), ("TRS_TON", "rel_trs")]:
        g = out.assign(_v=out[col].where(is_core), _n=is_core.astype(int)).groupby(["TRIAL", "CROP"])
        tot, n = g["_v"].transform("sum"), g["_n"].transform("sum")
        own = out[col].where(is_core, 0.0)
        ref = (tot - own) / (n - is_core.astype(int))
        out[name] = out[col] / ref.where(ref > 0)
    return out


def clone_parameters(rel: pd.DataFrame, clones: list[str]) -> pd.DataFrame:
    """Por variedad: a, b de log(rel_sugar) = a + b·CROP (MCO) y TRS relativo promedio."""
    rows = []
    for c in clones:
        g = rel[(rel["CLONE"] == c) & rel["rel_sugar"].notna()]
        x, y = g["CROP"].to_numpy(float), np.log(g["rel_sugar"].to_numpy())
        if len(g) < 3 or np.ptp(x) == 0:
            continue
        b, a = np.polyfit(x, y, 1)
        rows.append({"CLONE": c, "a": a, "b": b, "trs_rel": g["rel_trs"].mean(),
                     "plantia_vs_testigos": np.exp(a), "retencion_vs_testigos": np.exp(b),
                     "ultimo_corte_medido": int(x.max()), "parcelas": len(g),
                     "ensayos": g["TRIAL"].nunique(), "anios": g["YEAR"].nunique()})
    return pd.DataFrame(rows).set_index("CLONE")


# ----------------------------------------------------------------------------- curva de los testigos
def core_curve(s5: pd.DataFrame, core: list[str] = CORE_CHECKS) -> pd.DataFrame:
    """Curva absoluta de los testigos núcleo en etapa 5, por corte (0..MAX_CUTS-1).

    - Plantía: promedio de azúcar/acre de los testigos núcleo en plantía.
    - Caída por corte: regresión log con efectos fijos de ambiente (lugar-año) y de clon,
      para no confundir la edad de la caña con años buenos o malos.
    - TRS por corte: promedio de los testigos núcleo.
    """
    c = s5[s5["CLONE"].isin(core)]
    y = np.log(c["T_SPACRE"].to_numpy())
    X = pd.get_dummies(c[["ENV", "CLONE"]].astype(str), drop_first=True, dtype=float)
    X = pd.concat([X, pd.get_dummies(c["CROP"], prefix="crop", drop_first=True, dtype=float)], axis=1)
    X.insert(0, "const", 1.0)
    beta, *_ = np.linalg.lstsq(X.to_numpy(), y, rcond=None)
    coef = pd.Series(beta, index=X.columns)
    mult = [1.0] + [float(np.exp(coef.get(f"crop_{k}", np.nan))) for k in range(1, MAX_CUTS)]
    base = c.loc[c["CROP"] == 0, "T_SPACRE"].mean()
    trs = c.groupby("CROP")["TRS_TON"].mean().reindex(range(MAX_CUTS)).ffill()
    return pd.DataFrame({"mult": mult, "sugar": base * np.array(mult), "trs": trs.to_numpy()},
                        index=pd.Index(range(MAX_CUTS), name="corte"))


def clone_curve(curve: pd.DataFrame, a: float = 0.0, b: float = 0.0, trs_rel: float = 1.0,
                ultimo_medido: int | None = None) -> pd.DataFrame:
    """Curva absoluta de una variedad: azúcar (lb/acre), TRS (lb/t) y caña (t/acre) por corte.

    Si se indica `ultimo_medido`, la ventaja relativa no se extrapola más allá del último corte con datos:
    después de ese corte la variedad conserva la ventaja (o desventaja) que tenía, y cae al ritmo de los testigos.
    """
    k = curve.index.to_numpy()
    k_rel = k if ultimo_medido is None else np.minimum(k, ultimo_medido)
    sugar = curve["sugar"].to_numpy() * np.exp(a + b * k_rel)
    trs = curve["trs"].to_numpy() * trs_rel
    return pd.DataFrame({"sugar": sugar, "trs": trs, "tca": sugar / trs}, index=curve.index)


# ----------------------------------------------------------------------------- economía
def cycle_economics(cc: pd.DataFrame, s: Supuestos = Supuestos()) -> pd.DataFrame:
    """Margen de cada corte y margen promedio anual de un ciclo de n cortes (n = 1..MAX_CUTS)."""
    m = cc["sugar"] * s.precio - s.corte * cc["tca"] - s.mantenimiento
    m = m - np.where(cc.index == 0, s.renovacion, 0.0)
    n = np.arange(1, len(cc) + 1)
    avg = np.cumsum(m.to_numpy()) / (n + s.barbecho)
    return pd.DataFrame({"margen_corte": m.to_numpy(), "cortes": n, "margen_anual_promedio": avg}, index=cc.index)


def best_cycle(cc: pd.DataFrame, s: Supuestos = Supuestos()) -> tuple[int, float]:
    """(número de cortes óptimo, margen promedio anual en el óptimo)."""
    e = cycle_economics(cc, s)
    v = e["margen_anual_promedio"].to_numpy()
    if np.all(np.isnan(v)):
        return 0, float("nan")
    i = int(np.nanargmax(v))   # si falta un corte (p. ej. sin datos de soca 4 en una réplica), ese ciclo no se evalúa
    return int(e["cortes"].iloc[i]), float(v[i])


def evaluate(params: pd.DataFrame, curve: pd.DataFrame, s: Supuestos = Supuestos(),
             extrapolar: bool = False) -> pd.DataFrame:
    """Ciclo óptimo y margen por variedad, y ganancia contra el testigo núcleo promedio.

    extrapolar=False (por defecto, conservador): la ventaja relativa se congela en el último corte medido.
    """
    n_ref, v_ref = best_cycle(clone_curve(curve), s)
    rows = []
    for c, p in params.iterrows():
        last = None if extrapolar else int(p["ultimo_corte_medido"])
        n, v = best_cycle(clone_curve(curve, p["a"], p["b"], p["trs_rel"], last), s)
        rows.append({"CLONE": c, "ciclo_optimo": n, "margen_anual": v, "ganancia_vs_testigos": v - v_ref,
                     "ciclo_extrapolado": n > p["ultimo_corte_medido"] + 1})
    out = pd.DataFrame(rows).set_index("CLONE")
    out.attrs["referencia"] = {"ciclo_optimo": n_ref, "margen_anual": v_ref}
    return out


def break_even_price(p: pd.Series, curve: pd.DataFrame, s: Supuestos = Supuestos(),
                     lo: float = 0.02, hi: float = 0.60) -> float:
    """Precio mínimo (US$/lb) con el que el mejor ciclo de la variedad tiene margen ≥ 0 (bisección)."""
    cc = clone_curve(curve, p["a"], p["b"], p["trs_rel"], int(p["ultimo_corte_medido"]))
    f = lambda price: best_cycle(cc, Supuestos(price, s.corte, s.mantenimiento, s.renovacion, s.barbecho))[1]
    if f(hi) < 0:
        return float("nan")
    for _ in range(50):
        mid = (lo + hi) / 2
        lo, hi = (lo, mid) if f(mid) >= 0 else (mid, hi)
    return hi
