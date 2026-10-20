"""Serie III · Mercado — pronóstico del precio del azúcar No. 11 a 1 y 3 meses, con bandas de incertidumbre.

Objetivo: el promedio mensual del contrato más próximo en el mes t+h, pronosticado al cierre del mes t.
Validación: origen rodante (ventana creciente). En cada origen solo se usa información disponible ese día: para
entrenar, solo pares (t', t'+h) cuyo resultado ya se conocía (t' + h ≤ t).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from mercado_precio import dias_de_cambio, retornos

MODELOS = ["Ingenuo: último cierre", "Ingenuo: promedio del mes", "ARIMA(1,1,0) sobre promedios", "Regresión: momentum y reversión"]
PREDICTORES = ["ret_1m", "ret_12m", "desv_60m", "curva"]


# ----------------------------------------------------------------------------- 1. tabla mensual
def mensual(s: pd.DataFrame) -> pd.DataFrame:
    """Una fila por mes completo con el precio promedio, el último cierre y los predictores conocidos al cierre."""
    r = retornos(s)
    c = s.close
    M = pd.DataFrame({"prom": c.resample("ME").mean(), "ult": c.resample("ME").last(), "dias": c.resample("ME").size()})
    # meses completos: se descarta el último si la serie termina antes de fin de mes
    if s.index[-1] < s.index[-1] + pd.offsets.BMonthEnd(0):
        M = M.iloc[:-1]
    M["lp"], M["lu"] = np.log(M.prom), np.log(M.ult)
    M["ret_1m"] = M.lu.diff()
    M["ret_12m"] = M.lu.diff(12)
    M["desv_60m"] = M.lu - np.log(M.prom.rolling(60, min_periods=36).mean())
    # forma de la curva: brecha del último cambio de contrato conocido (negativa = próximo más caro que el siguiente)
    brecha = r.loc[dias_de_cambio(s), "brecha"]
    M["curva"] = brecha.resample("ME").last().reindex(M.index).ffill()
    M["vol_3m"] = r.ajustado.rolling(63).std().resample("ME").last().reindex(M.index) * np.sqrt(21)   # 1 mes
    return M


# ----------------------------------------------------------------------------- 2. modelos
def _ar1_promedios(lp: pd.Series, h: int) -> float:
    d = lp.diff().dropna()
    x, y = d.shift(1).dropna(), d.iloc[1:]
    b, a = np.polyfit(x.values, y.loc[x.index].values, 1)
    f, cur = lp.iloc[-1], d.iloc[-1]
    for _ in range(h):
        cur = a + b * cur
        f += cur
    return float(f)


def _regresion(M: pd.DataFrame, i: int, h: int, minimo: int = 48) -> float:
    """OLS de log(prom_{t+h}) − log(ult_t) sobre los predictores, con pares ya realizados en el origen i."""
    y = M.lp.shift(-h) - M.lu
    datos = pd.concat([y.rename("y"), M[PREDICTORES]], axis=1).iloc[: i - h + 1].dropna()
    x0 = M[PREDICTORES].iloc[i]
    if len(datos) < minimo or x0.isna().any():
        return float(M.lu.iloc[i])
    X = np.column_stack([np.ones(len(datos)), datos[PREDICTORES].values])
    beta = np.linalg.lstsq(X, datos.y.values, rcond=None)[0]
    return float(M.lu.iloc[i] + beta[0] + x0.values @ beta[1:])


def pronosticos(M: pd.DataFrame, h: int, desde: str = "2008-12-31") -> pd.DataFrame:
    """Pronósticos fuera de muestra (log) de cada modelo para cada origen."""
    filas = []
    for i in range(len(M) - h):
        t = M.index[i]
        if t < pd.Timestamp(desde):
            continue
        filas.append({
            "origen": t, "objetivo": M.index[i + h], "real": M.lp.iloc[i + h], "ult": M.lu.iloc[i], "vol_3m": M.vol_3m.iloc[i],
            MODELOS[0]: M.lu.iloc[i],
            MODELOS[1]: M.lp.iloc[i],
            MODELOS[2]: _ar1_promedios(M.lp.iloc[: i + 1], h),
            MODELOS[3]: _regresion(M, i, h),
        })
    return pd.DataFrame(filas).set_index("origen")


# ----------------------------------------------------------------------------- 3. evaluación
def metricas(P: pd.DataFrame, modelos=MODELOS) -> pd.DataFrame:
    real = np.exp(P.real)
    filas = {}
    for m in modelos:
        e = np.exp(P[m]) - real
        filas[m] = {"MAE (¢/lb)": e.abs().mean(), "MAPE (%)": 100 * (e.abs() / real).mean(),
                    "RMSE (¢/lb)": np.sqrt((e ** 2).mean()), "sesgo (¢/lb)": e.mean()}
    T = pd.DataFrame(filas).T
    base = T.loc[MODELOS[0], "MAE (¢/lb)"]
    T["mejora vs último cierre (%)"] = 100 * (1 - T["MAE (¢/lb)"] / base)
    return T


def bootstrap_pareado(P: pd.DataFrame, a: str, b: str, bloque: int = 12, reps: int = 4000, semilla: int = 20261019) -> dict:
    """Diferencia de MAE (a − b, ¢/lb) con bootstrap por bloques de meses: negativo = a es mejor."""
    real = np.exp(P.real)
    d = ((np.exp(P[a]) - real).abs() - (np.exp(P[b]) - real).abs()).values
    n = len(d); rng = np.random.default_rng(semilla)
    k = int(np.ceil(n / bloque)); est = []
    for _ in range(reps):
        ini = rng.integers(0, n - bloque + 1, k)
        est.append(np.concatenate([d[j:j + bloque] for j in ini])[:n].mean())
    est = np.array(est)
    return {"dif_MAE": float(d.mean()), "IC90": (float(np.percentile(est, 5)), float(np.percentile(est, 95))),
            "P(a peor)": float((est > 0).mean())}


def diebold_mariano(P: pd.DataFrame, a: str, b: str, h: int) -> dict:
    """Prueba de Diebold-Mariano (pérdida absoluta) con varianza de Newey-West y corrección de Harvey."""
    real = np.exp(P.real)
    d = ((np.exp(P[a]) - real).abs() - (np.exp(P[b]) - real).abs()).values
    n = len(d); dm = d - d.mean()
    lags = max(h - 1, 0) + 2
    g = [np.sum(dm[k:] * dm[: n - k]) / n for k in range(lags + 1)]
    var = g[0] + 2 * sum((1 - k / (lags + 1)) * g[k] for k in range(1, lags + 1))
    est = d.mean() / np.sqrt(var / n)
    est *= np.sqrt((n + 1 - 2 * h + h * (h - 1) / n) / n)
    return {"DM": float(est), "p": float(2 * stats.t.sf(abs(est), n - 1))}


# ----------------------------------------------------------------------------- 4. bandas
def bandas(P: pd.DataFrame, modelo: str, h: int, niveles=(0.80, 0.95), minimo: int = 36, escala_vol: bool = False) -> pd.DataFrame:
    """Bandas con los errores pasados ya realizados (en log). Con escala_vol, el error se mide en unidades de la
    volatilidad del momento (vol de 3 meses × √h) y se reescala con la volatilidad actual."""
    e = P.real - P[modelo]
    esc = P.vol_3m * np.sqrt(h) if escala_vol else pd.Series(1.0, index=P.index)
    z = e / esc
    out = []
    for j, t in enumerate(P.index):
        prev = z.iloc[: max(0, j - h + 1)].dropna()     # solo errores cuyo resultado ya se conocía en t
        if len(prev) < minimo:
            continue
        fila = {"origen": t, "centro": P[modelo].iloc[j], "real": P.real.iloc[j]}
        for nv in niveles:
            lo, hi = np.quantile(prev, [(1 - nv) / 2, 1 - (1 - nv) / 2])
            fila[f"lo{int(nv * 100)}"] = P[modelo].iloc[j] + lo * esc.iloc[j]
            fila[f"hi{int(nv * 100)}"] = P[modelo].iloc[j] + hi * esc.iloc[j]
        out.append(fila)
    return pd.DataFrame(out).set_index("origen")


def evaluar_bandas(B: pd.DataFrame, niveles=(0.80, 0.95), turbulento: pd.Series | None = None) -> pd.DataFrame:
    filas = {}
    for nv in niveles:
        k = int(nv * 100)
        dentro = (B.real >= B[f"lo{k}"]) & (B.real <= B[f"hi{k}"])
        ancho = 100 * (np.exp(B[f"hi{k}"]) - np.exp(B[f"lo{k}"])) / np.exp(B.centro)
        a = 1 - nv
        winkler = (np.exp(B[f"hi{k}"]) - np.exp(B[f"lo{k}"])
                   + 2 / a * (np.exp(B[f"lo{k}"]) - np.exp(B.real)).clip(lower=0)
                   + 2 / a * (np.exp(B.real) - np.exp(B[f"hi{k}"])).clip(lower=0))
        fila = {"cobertura (%)": 100 * dentro.mean(), "ancho medio (% del centro)": ancho.mean(), "Winkler (¢/lb)": winkler.mean()}
        if turbulento is not None:
            tb = turbulento.reindex(B.index).fillna(False).astype(bool)
            fila["cobertura en calma (%)"] = 100 * dentro[~tb].mean()
            fila["cobertura en turbulencia (%)"] = 100 * dentro[tb].mean()
        filas[f"{k} %"] = fila
    return pd.DataFrame(filas).T
