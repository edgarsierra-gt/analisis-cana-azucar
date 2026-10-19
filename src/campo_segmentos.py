"""
Serie I · Campo — pregunta 3: segmentar variedades por productividad, calidad, longevidad y estabilidad.

Todo se mide CONTRA LOS TESTIGOS NÚCLEO del mismo ensayo y corte (igual que en las preguntas 1 y 2), así el lugar y el
año no se confunden con la variedad. Indicadores, en logaritmo (0 = igual a los testigos):

    productividad   caña por acre (TCA) en plantía vs testigos             -> "TCH"
    calidad         azúcar por tonelada (TRS) vs testigos, promedio         -> "rendimiento"
    longevidad      cuánto gana o pierde en caña por cada corte vs testigos -> "persistencia de la cepa"
    estabilidad     −σ de la ventaja entre fincas y años que NO explica la calidad de la finca, sin el ruido de parcela
    respuesta       (descriptivo) pendiente de la ventaja contra un índice ambiental independiente

Se usa caña y calidad por separado (no azúcar y calidad) porque azúcar = caña × calidad: con azúcar la calidad
contaría dos veces.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from campo_economia import CORE_CHECKS, MAX_CUTS, relative_to_core

INDICADORES = ["productividad", "calidad", "longevidad", "estabilidad"]


def _rel_vs_core(p: pd.DataFrame, col: str) -> pd.Series:
    """Cociente contra el promedio de testigos núcleo del mismo ensayo y corte (leave-one-out para los testigos)."""
    core = p["CLONE"].isin(CORE_CHECKS) & p[col].notna()
    g = p.assign(_v=p[col].where(core), _n=core.astype(int)).groupby(["TRIAL", "CROP"])
    tot, n = g["_v"].transform("sum"), g["_n"].transform("sum")
    ref = (tot - p[col].where(core, 0.0)) / (n - core.astype(int))
    return p[col] / ref.where((n - core.astype(int)) > 0)


def preparar(df5: pd.DataFrame) -> pd.DataFrame:
    """Tabla por parcela (etapa 5) con todo lo que necesitan los indicadores.

    df5: filas limpias de etapa 5 a nivel repetición (salida de campo_data.clean filtrada a STAGE == 5).
    """
    plot = (df5.groupby(["TRIAL", "LOC", "PLANT_YEAR", "ENV", "CLONE", "CROP", "YEAR"], as_index=False)
               [["T_SPACRE", "TCA", "TRS_TON", "FIBER"]].mean())
    # ruido de la parcela: varianza entre repeticiones del log azúcar / número de repeticiones
    rep = (df5.assign(ly=np.log(df5["T_SPACRE"])).groupby(["TRIAL", "CLONE", "CROP"])["ly"]
              .agg(["var", "count"]).reset_index())
    rep["ruido"] = rep["var"] / rep["count"]
    p = plot.merge(rep[["TRIAL", "CLONE", "CROP", "ruido"]], on=["TRIAL", "CLONE", "CROP"], how="left")
    p = relative_to_core(p)                                   # rel_sugar, rel_trs
    p["rel_tca"] = _rel_vs_core(p, "TCA")
    core = p["CLONE"].isin(CORE_CHECKS)
    # fibra: diferencia en puntos porcentuales contra los testigos (descriptivo; cobertura incompleta)
    p["dif_fibra"] = p["FIBER"] - p["FIBER"] / _rel_vs_core(p, "FIBER")
    # ruido del denominador: ruido promedio de los testigos usados / número de testigos usados
    g = p.assign(_r=p["ruido"].where(core), _n=core.astype(int)).groupby(["TRIAL", "CROP"])
    n_usados = g["_n"].transform("sum") - core.astype(int)
    p["ruido_ref"] = ((g["_r"].transform("sum") - p["ruido"].where(core, 0.0)) / n_usados) / n_usados
    p["ruido_total"] = p["ruido"].fillna(p["ruido"].mean()) + p["ruido_ref"].fillna(p["ruido_ref"].mean())
    # índice ambiental INDEPENDIENTE (pregunta 1, H3): parcelas que no son testigos núcleo, sin la variedad evaluada,
    # llevadas a "plantía equivalente" con la caída promedio por corte
    caida = np.exp(np.log(p["T_SPACRE"]).groupby(p["CROP"]).mean() - np.log(p.loc[p["CROP"] == 0, "T_SPACRE"]).mean())
    p["pce"] = p["T_SPACRE"] / p["CROP"].map(caida)
    e = p[~core].groupby("ENV")["pce"].agg(["sum", "count"]).add_prefix("env_")
    p = p.join(e, on="ENV")
    propio, n_propio = np.where(core, 0.0, p["pce"]), np.where(core, 0, 1)
    p["indice"] = (p["env_sum"] - propio) / (p["env_count"] - n_propio)
    p["l_indice"] = np.log(p["indice"]) - np.log(p["indice"]).mean()
    p["l_s"], p["l_t"], p["l_q"] = np.log(p["rel_sugar"]), np.log(p["rel_tca"]), np.log(p["rel_trs"])
    return p.drop(columns=["env_sum", "env_count"])


def indicadores(p: pd.DataFrame, clones: list[str], min_parcelas: int = 6) -> pd.DataFrame:
    """Indicadores por variedad. Cada fila de `p` cuenta una vez (en el bootstrap puede haber ensayos repetidos)."""
    ok = p["CLONE"].isin(clones) & p[["l_s", "l_t", "l_q", "l_indice"]].notna().all(axis=1)
    rows = {}
    for c, x in p[ok].groupby("CLONE"):
        k = x["CROP"].to_numpy(float)
        if len(x) < min_parcelas or np.ptp(k) == 0:
            continue
        X1 = np.column_stack([np.ones_like(k), k])
        (a_t, b_t), *_ = np.linalg.lstsq(X1, x["l_t"].to_numpy(), rcond=None)
        X2 = np.column_stack([np.ones_like(k), x["l_indice"].to_numpy(), k])
        beta, *_ = np.linalg.lstsq(X2, x["l_s"].to_numpy(), rcond=None)
        res = x["l_s"].to_numpy() - X2 @ beta
        var_dev = (res ** 2).sum() / (len(x) - 3)                  # = interacción con el ambiente + ruido de parcela
        sd_ge = np.sqrt(max(var_dev - x["ruido_total"].mean(), 0.0))
        rows[c] = {"productividad": a_t, "calidad": x["l_q"].mean(), "longevidad": b_t, "estabilidad": -sd_ge,
                   "respuesta": beta[1], "sd_bruta": np.sqrt(var_dev), "sd_ruido": np.sqrt(x["ruido_total"].mean()),
                   "parcelas": len(x), "anios": x["YEAR"].nunique(), "fincas": x["LOC"].nunique(),
                   "ultimo_corte": int(k.max())}
    return pd.DataFrame(rows).T.reindex([c for c in clones if c in rows]).astype(float)


def estandarizar(X: pd.DataFrame, cols: list[str] = INDICADORES) -> tuple[pd.DataFrame, pd.Series, pd.Series]:
    """Z-scores de los indicadores; devuelve también media y desvío para estandarizar variedades nuevas igual."""
    mu, sd = X[cols].mean(), X[cols].std()
    return (X[cols] - mu) / sd, mu, sd


def nombrar(centros: pd.DataFrame) -> dict[int, str]:
    """Nombre de cada grupo según su centro (z-scores), con reglas fijas y en orden (cada grupo recibe un solo nombre)."""
    libres = list(centros.index)
    nombres = {}

    def tomar(serie: pd.Series, nombre: str):
        """Asigna `nombre` al grupo aún libre con el valor más alto de `serie`."""
        i = serie.loc[libres].idxmax()
        nombres[i] = nombre
        libres.remove(i)

    z = centros
    tomar(-z["estabilidad"], "Inestables y de vida corta")
    tomar(z["calidad"] + z["longevidad"] + z["productividad"], "Completas: caña, calidad y longevidad")
    tomar(z["productividad"] - z["calidad"], "Mucha caña, menos calidad")
    tomar(z["calidad"] - z["productividad"], "Calidad sin caña")
    for i in libres:
        nombres[i] = "Sin ventaja clara"
    return nombres
