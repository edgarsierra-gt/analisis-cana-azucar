"""
Serie I · Campo — pregunta 4: cuánta evidencia hace falta para comparar variedades con datos propios.

Componentes de varianza (escala log del azúcar por acre), estimados con los ensayos de etapa 5 de Louisiana:
    σ²_GL   interacción variedad × finca        (la ventaja cambia de una finca a otra, igual todos los años)
    σ²_GY   interacción variedad × año          (la ventaja cambia de un año a otro, igual en todas las fincas)
    σ²_GLY  interacción variedad × finca × año  (lo que queda: cada lote-año es distinto)
    σ²_e    error de parcela por repetición     (diferencia entre repeticiones del mismo ensayo)

Varianza de la diferencia entre dos variedades promediadas en L fincas, Y años y R repeticiones:
    Var(d) = 2 · (σ²_GL/L + σ²_GY/Y + σ²_GLY/(L·Y) + σ²_e/(L·Y·R))
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import norm


def componentes_varianza(d5: pd.DataFrame) -> dict:
    """d5: filas de etapa 5 a nivel repetición (salida de campo_data.clean). Devuelve los 4 componentes y r̄.

    Paso 1: efectos fijos por MCO (ambiente lote-año, variedad y caída propia de cada variedad por corte).
    Paso 2: REML sobre el residuo para separar variedad × finca y variedad × año; el resto es variedad × lote-año
    más error de parcela, que se mide aparte con las repeticiones y se resta.
    """
    import statsmodels.formula.api as smf

    d = d5.assign(ly=np.log(d5["T_SPACRE"]))
    g = d.groupby(["TRIAL", "CLONE", "CROP"])["ly"]
    v, n = g.var(ddof=1), g.count()
    s2_e = float((v * (n - 1)).sum() / (n - 1).sum())
    r_bar = float(n.mean())

    p = d.groupby(["TRIAL", "LOC", "YEAR", "CLONE", "CROP"], as_index=False)["ly"].mean()
    p["TY"] = p["TRIAL"] + "|" + p["YEAR"].astype(str)
    X = pd.get_dummies(p[["TY", "CLONE"]], drop_first=True, dtype=float)
    X = pd.concat([X, pd.get_dummies(p["CLONE"], dtype=float).mul(p["CROP"], axis=0).add_prefix("k_")], axis=1)
    X.insert(0, "c", 1.0)
    Xa = X.to_numpy()
    beta, *_ = np.linalg.lstsq(Xa, p["ly"].to_numpy(), rcond=None)
    p["r"] = p["ly"] - Xa @ beta
    gl_res = len(p) - np.linalg.matrix_rank(Xa)

    p["GL"] = p["CLONE"] + "|" + p["LOC"]
    p["GY"] = p["CLONE"] + "|" + p["YEAR"].astype(str)
    p["uno"] = 1
    import warnings
    from statsmodels.tools.sm_exceptions import ConvergenceWarning
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ConvergenceWarning)   # aviso de frontera; los componentes salen positivos
        m = smf.mixedlm("r ~ 1", p, groups="uno", vc_formula={"GL": "0 + C(GL)", "GY": "0 + C(GY)"}).fit(reml=True)
    vc = dict(zip(m.model.exog_vc.names, m.vcomp))
    residuo = m.scale * (len(p) - 1) / gl_res                 # corrige los grados de libertad de los efectos fijos
    return {"GL": float(vc["GL"]), "GY": float(vc["GY"]), "GLY": float(max(residuo - s2_e / r_bar, 0.0)),
            "e": s2_e, "r_media": r_bar, "parcelas": int(len(p))}


def var_diferencia(c: dict, L: float, Y: float, R: float, factor_gxe: float = 1.0) -> float:
    """Varianza de la diferencia de medias (log) entre dos variedades. factor_gxe escala las tres interacciones."""
    f = factor_gxe
    return 2 * (f * c["GL"] / L + f * c["GY"] / Y + f * c["GLY"] / (L * Y) + c["e"] / (L * Y * R))


def potencia(delta_pct: float, c: dict, L: float, Y: float, R: float, alfa: float = 0.05,
             factor_gxe: float = 1.0) -> float:
    """Probabilidad de detectar (prueba bilateral) una ventaja real de delta_pct (p. ej. 0.05 = 5 %)."""
    se = np.sqrt(var_diferencia(c, L, Y, R, factor_gxe))
    z = np.log1p(delta_pct) / se
    za = norm.ppf(1 - alfa / 2)
    return float(norm.cdf(z - za) + norm.cdf(-z - za))


def fincas_necesarias(delta_pct: float, c: dict, Y: float, R: float, objetivo: float = 0.8,
                      factor_gxe: float = 1.0, maximo: int = 200) -> float:
    """Menor número de fincas (sitios por año) para llegar a la potencia objetivo; NaN si no se alcanza."""
    for L in range(2, maximo + 1):
        if potencia(delta_pct, c, L, Y, R, factor_gxe=factor_gxe) >= objetivo:
            return L
    return float("nan")


# ----------------------------------------------------------------------------- zonificación de lotes
def distancia_gower(df: pd.DataFrame, numericas: list[str], categoricas: list[str],
                    pesos: dict | None = None) -> np.ndarray:
    """Distancia de Gower entre lotes con variables mixtas (0 = idénticos, 1 = máximo).

    Numéricas: |a − b| / rango. Categóricas: 0 si coinciden, 1 si no. Promedio ponderado.
    """
    pesos = pesos or {}
    n = len(df)
    tot, wsum = np.zeros((n, n)), 0.0
    for col in numericas:
        x = df[col].to_numpy(float)
        rng = np.nanmax(x) - np.nanmin(x)
        w = pesos.get(col, 1.0)
        if rng > 0:
            tot += w * np.abs(x[:, None] - x[None, :]) / rng
            wsum += w
    for col in categoricas:
        x = df[col].to_numpy()
        w = pesos.get(col, 1.0)
        tot += w * (x[:, None] != x[None, :])
        wsum += w
    return tot / wsum
