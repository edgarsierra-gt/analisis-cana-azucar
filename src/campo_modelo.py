"""
Serie I · Campo — pregunta 2: estimar el azúcar por acre (T_SPACRE, lb/acre) de una variedad en una localidad
para la siguiente zafra.

Regla de oro: cada fila del año t se describe SOLO con información que existía antes de cosechar el año t
(datos de años < t). Así la validación imita el uso real: en diciembre se planifica la zafra siguiente.

Variables (todas en logaritmo, como desviaciones; 0 = "igual al promedio"):
    base_corte      nivel típico de los testigos núcleo en ese corte (promedio de los años previos)
    var_rel         ventaja de la variedad sobre los testigos en ese corte (pregunta 1, con encogimiento)
    var_n           cuántas parcelas de etapa 5 respaldan var_rel (evidencia)
    loc_rel         qué tan buena es la finca vs el promedio del mismo año y corte (con encogimiento)
    lote_ant_rel    cómo rindió ESTA variedad en ESTE lote el año pasado, vs los testigos del mismo lote
    lote_ant_amb    qué tan bueno fue ESTE lote el año pasado (testigos del lote vs su nivel típico)
    tiene_lote_ant  1 si existe el corte anterior del lote (socas); 0 en plantía

Modelo en dos piezas (notebook 03, sección 4):
    log(azúcar) = NIVEL (base_corte + loc_rel; de la historia, no se aprende)
                + VENTAJA vs testigos del mismo lote (se aprende: Ridge, Random Forest o XGBoost)

Escenario 1 (variedad conocida, finca conocida): todas las variables.
Escenario 2 (variedad conocida, finca nueva): la finca no existe en la historia -> sin loc_rel ni lote anterior.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from campo_economia import CORE_CHECKS, MAX_CUTS, relative_to_core

# Encogimiento ("shrinkage"): con poca evidencia, se asume que la variedad / finca es promedio.
LAMBDA_A = 3.0     # pseudo-parcelas en 0 para el nivel de la variedad
LAMBDA_B = 10.0    # pseudo-parcelas en 0 para la caída extra por corte (es más ruidosa)
LAMBDA_LOC = 1.0   # pseudo-años en 0 para el efecto de la finca

# El modelo tiene dos piezas (ver notebook 03, sección 4):
#   log(azúcar) = NIVEL de la finca (historia, sin aprender)  +  VENTAJA de la variedad (aprendida)
# Variables de la pieza aprendida, por algoritmo y escenario:
RIDGE_E1 = ["var_rel", "lote_ant_rel", "tiene_lote_ant"]
RIDGE_E2 = ["var_rel"]
TREE_E1 = ["corte", "var_rel", "var_n", "loc_rel", "lote_ant_rel", "lote_ant_amb", "tiene_lote_ant"]
TREE_E2 = ["corte", "var_rel", "var_n"]


# ----------------------------------------------------------------------------- historia (solo años previos)
def base_por_corte(h: pd.DataFrame, core: list[str] = CORE_CHECKS) -> pd.Series:
    """log(lb/acre) típico de los testigos núcleo por corte: promedio de cada año, luego promedio entre años.

    Si un corte no tiene datos aún (soca 4 antes de 2019), se extiende con la caída promedio entre cortes.
    """
    c = h[h["CLONE"].isin(core)]
    by_year = np.log(c["T_SPACRE"]).groupby([c["YEAR"], c["CROP"]]).mean()
    base = by_year.groupby(level="CROP").mean().reindex(range(MAX_CUTS))
    step = base.diff().mean()
    for k in range(1, MAX_CUTS):
        if np.isnan(base[k]):
            base[k] = base[k - 1] + step
    return base.rename("base_corte")


def parametros_variedad(h: pd.DataFrame) -> pd.DataFrame:
    """Por variedad: log(rel) = a + b·corte con encogimiento hacia 0 (= igual a los testigos).

    Mínimos cuadrados penalizados: (XᵀX + diag(λa, λb)) β = Xᵀy. Con pocas parcelas, a y b quedan cerca de 0.
    """
    rows = []
    g = h[h["rel_sugar"].notna() & (h["rel_sugar"] > 0)]
    for clone, d in g.groupby("CLONE"):
        k = d["CROP"].to_numpy(float)
        y = np.log(d["rel_sugar"].to_numpy())
        X = np.column_stack([np.ones_like(k), k])
        a, b = np.linalg.solve(X.T @ X + np.diag([LAMBDA_A, LAMBDA_B]), X.T @ y)
        rows.append({"CLONE": clone, "a": a, "b": b, "kmax": int(k.max()), "n": len(d)})
    return pd.DataFrame(rows).set_index("CLONE") if rows else pd.DataFrame(columns=["a", "b", "kmax", "n"])


def efecto_finca(h: pd.DataFrame, core: list[str] = CORE_CHECKS) -> pd.DataFrame:
    """log(testigos en la finca) − log(testigos de todas las fincas, mismo año y corte); promedio por año, encogido."""
    c = h[h["CLONE"].isin(core)].assign(ly=lambda d: np.log(d["T_SPACRE"]))
    c = c.assign(d=c["ly"] - c.groupby(["YEAR", "CROP"])["ly"].transform("mean"))
    env = c.groupby(["LOC", "YEAR"])["d"].mean()
    out = env.groupby(level="LOC").agg(["sum", "count"])
    return pd.DataFrame({"loc_rel": out["sum"] / (out["count"] + LAMBDA_LOC), "loc_anios": out["count"]})


def historia(plots: pd.DataFrame, t: int, excluir_loc: str | None = None) -> dict:
    """Todo lo que se sabía antes de la zafra t (opcionalmente, como si la finca `excluir_loc` no existiera)."""
    h = plots[plots["YEAR"] < t]
    if excluir_loc is not None:
        h = h[h["LOC"] != excluir_loc]
    todas = np.log(h["T_SPACRE"]).groupby([h["YEAR"], h["CROP"]]).mean().groupby(level="CROP").mean()
    return {"base": base_por_corte(h), "var": parametros_variedad(h), "loc": efecto_finca(h),
            "ingenuo": todas.reindex(range(MAX_CUTS)).ffill()}


# ----------------------------------------------------------------------------- variables por fila
def preparar(plots: pd.DataFrame) -> pd.DataFrame:
    """Agrega rel_sugar (vs testigos núcleo, mismo ensayo y corte) y las variables del corte anterior del lote."""
    p = relative_to_core(plots)
    core = p[p["CLONE"].isin(CORE_CHECKS)]
    lote_core = np.log(core["T_SPACRE"]).groupby([core["TRIAL"], core["CROP"]]).mean().rename("lote_core_log")
    ant = p[["TRIAL", "CLONE", "CROP", "rel_sugar", "T_SPACRE"]].rename(
        columns={"rel_sugar": "rel_ant", "T_SPACRE": "y_ant"})
    ant = ant.merge(lote_core, left_on=["TRIAL", "CROP"], right_index=True, how="left")
    ant["CROP"] += 1   # el corte k-1 de este lote describe al corte k
    return p.merge(ant, on=["TRIAL", "CLONE", "CROP"], how="left")


def variables(filas: pd.DataFrame, hist: dict, escenario: int = 1) -> pd.DataFrame:
    """Matriz de variables para `filas` usando únicamente `hist` (y el corte anterior del lote en escenario 1)."""
    f = pd.DataFrame(index=filas.index)
    k = filas["CROP"].to_numpy()
    f["corte"] = k
    f["base_corte"] = hist["base"].reindex(k).to_numpy()
    v = hist["var"].reindex(filas["CLONE"])
    kk = np.minimum(k, v["kmax"].fillna(0).to_numpy())          # no extrapolar más allá del último corte medido
    f["var_rel"] = (v["a"] + v["b"] * kk).fillna(0.0).to_numpy()
    f["var_n"] = np.log1p(v["n"].fillna(0).to_numpy())
    f["var_conocida"] = v["n"].notna().to_numpy()
    if escenario == 1:
        loc = hist["loc"].reindex(filas["LOC"])
        f["loc_rel"] = loc["loc_rel"].fillna(0.0).to_numpy()
        f["loc_conocida"] = loc["loc_rel"].notna().to_numpy()
        base_ant = hist["base"].reindex(np.maximum(k - 1, 0)).to_numpy()
        f["lote_ant_rel"] = np.log(filas["rel_ant"]).fillna(0.0).to_numpy()
        f["lote_ant_amb"] = (filas["lote_core_log"] - base_ant).fillna(0.0).to_numpy()
        f["tiene_lote_ant"] = (filas["rel_ant"].notna() & filas["lote_core_log"].notna()).astype(float).to_numpy()
        f.loc[f["tiene_lote_ant"] == 0, ["lote_ant_rel", "lote_ant_amb"]] = 0.0
    # Referencias sin aprendizaje (líneas base)
    f["pred_ingenuo"] = hist["ingenuo"].reindex(k).to_numpy()                     # promedio por corte
    f["pred_regla"] = f["base_corte"] + f["var_rel"] + (f["loc_rel"] if escenario == 1 else 0.0)
    if escenario == 1:   # regla del agrónomo: soca = lo que dio el lote el año pasado × caída típica
        y_ant = np.log(filas["y_ant"]).to_numpy()
        agro = y_ant + f["base_corte"].to_numpy() - base_ant
        f["pred_agronomo"] = np.where(f["tiene_lote_ant"] == 1, agro, f["pred_regla"])
    return f


COLS_ID = ["TRIAL", "LOC", "ENV", "CLONE", "CROP", "YEAR", "T_SPACRE", "rel_sugar"]


def tabla_asof(plots: pd.DataFrame, anios: list[int], escenario: int = 1,
               excluir_loc: str | None = None, solo_loc: str | None = None) -> pd.DataFrame:
    """Variables 'as-of' de las filas de `anios`: cada año se describe con la historia previa a él.

    - excluir_loc: la finca se borra de la historia y de las filas (escenario 2, para entrenar sin ella).
    - solo_loc: devuelve solo las filas de esa finca (escenario 2, filas de prueba; usar junto con excluir_loc).
    Agrega `y_rel` = log(azúcar vs testigos del mismo ensayo y corte): el objetivo de la pieza aprendida.
    """
    out = []
    for t in anios:
        filas = plots[plots["YEAR"] == t]
        if solo_loc is not None:
            filas = filas[filas["LOC"] == solo_loc]
        elif excluir_loc is not None:
            filas = filas[filas["LOC"] != excluir_loc]
        if filas.empty:
            continue
        out.append(variables(filas, historia(plots, t, excluir_loc), escenario).join(filas[COLS_ID]))
    out = pd.concat(out)
    out["nivel"] = out["base_corte"] + (out["loc_rel"] if escenario == 1 else 0.0)
    out["y_rel"] = np.log(out["rel_sugar"])
    return out


# ----------------------------------------------------------------------------- evaluación
def metricas(d: pd.DataFrame, pred_log: str, grupo: str = "GRUPO") -> dict:
    """Errores en lb/acre y orden de variedades dentro de cada ensayo-corte (mismo lote, mismo año)."""
    from scipy.stats import spearmanr
    y, p = d["T_SPACRE"], np.exp(d[pred_log])
    rhos = [spearmanr(g["T_SPACRE"], np.exp(g[pred_log]))[0] for _, g in d.groupby(grupo) if len(g) >= 4]
    return {"MAE": float((y - p).abs().mean()), "RMSE": float(np.sqrt(((y - p) ** 2).mean())),
            "MAPE_%": float(((y - p).abs() / y).mean() * 100),
            "R2": float(1 - ((y - p) ** 2).sum() / ((y - y.mean()) ** 2).sum()),
            "orden_spearman": float(np.nanmean(rhos)), "filas": int(len(d))}


def bootstrap_pareado(err_a: pd.Series, err_b: pd.Series, grupos: pd.Series, n: int = 2000,
                      seed: int = 20261019) -> tuple[float, float, float]:
    """Diferencia media de error (a − b) e IC90 remuestreando grupos completos (finca-año)."""
    df = pd.DataFrame({"d": err_a - err_b, "g": grupos.to_numpy()}).groupby("g")["d"].agg(["sum", "count"])
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(df), size=(n, len(df)))
    s, c = df["sum"].to_numpy()[idx].sum(1), df["count"].to_numpy()[idx].sum(1)
    boot = s / c
    return float(df["sum"].sum() / df["count"].sum()), float(np.percentile(boot, 5)), float(np.percentile(boot, 95))
