"""Serie II · Caldera: sensor virtual del flujo de vapor principal (pregunta 3).

Tres modelos, de más físico a más empírico:
- Hidráulico: el vapor que sale del domo pierde presión en los sobrecalentadores; esa caída crece con el flujo.
  Como en una placa de orificio, Q ≈ a + b·√(ΔP·ρ), con ΔP = domo − colector y ρ ∝ P/T (gas ideal, aproximado).
- Ridge con todos los sensores y sus rezagos (interpretable, lineal).
- Ridge de combustión: sin las presiones de vapor. Es el respaldo si fallan los transmisores de presión, y responde
  "qué variables del fuego explican el vapor y con qué rezago".
Validación: por días hacia adelante (se entrena con el pasado y se predice el día siguiente), con 30 min de separación
entre entrenamiento y prueba para que la autocorrelación no filtre información.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, RidgeCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from fabrica_datos import EXCLUIR_MODELOS, OBJETIVO, PRESION_HOGAR, variables_derivadas

ALFAS = np.logspace(-2, 3, 12)
REZAGOS = (0, 1, 2, 5)          # minutos
VENTANA_MEDIA = 10              # minutos
PRESIONES_VAPOR = ["PTCA_8322A", "PTCA_8324"]


def tabla_minuto(df: pd.DataFrame) -> pd.DataFrame:
    """Promedios de 1 min de los sensores que pueden entrar al modelo (pares resumidos, excluidos fuera)."""
    d = variables_derivadas(df)
    # Los pares se resumen. El aire de retorno izq./der. entra como total: el 30/03 se redistribuyó entre lados
    # (pregunta 1) y cada lado por separado cambia de significado; el total no.
    quitar = EXCLUIR_MODELOS + PRESION_HOGAR + ["ZCLCCY", "YCLCCY", "AIR_8301A", "AIR_8301B", "TE_8319A", "TE_8319B",
                                                "FT_8306A", "FT_8306B"]
    t = pd.concat([df.drop(columns=quitar), d[["presion_hogar", "lecho", "o2", "t_gases", "retorno_total"]]], axis=1)
    t = t.resample("1min").mean()
    t["dp_sobrecalentador"] = t["PTCA_8322A"] - t["PTCA_8324"]
    t["raiz_dp_rho"] = np.sqrt((t["dp_sobrecalentador"] * t["PTCA_8324"] / (t["TE_8332A"] + 273.15)).clip(lower=0))
    return t


def con_rezagos(t: pd.DataFrame, columnas: list[str], rezagos=REZAGOS, ventana=VENTANA_MEDIA) -> pd.DataFrame:
    """Valor actual, rezagos y media móvil de cada columna. Solo pasado y presente: nada del futuro."""
    F = {}
    for c in columnas:
        for L in rezagos:
            F[f"{c}|t-{L}"] = t[c].shift(L)
        F[f"{c}|media{ventana}"] = t[c].rolling(ventana, min_periods=ventana).mean()
    return pd.DataFrame(F, index=t.index)


def pliegues_adelante(indice: pd.DatetimeIndex, separacion: str = "30min") -> list[tuple[np.ndarray, np.ndarray]]:
    """Por día: entrenar con todo lo anterior (menos la separación) y probar el día completo siguiente."""
    dia = ((indice - indice[0]).total_seconds() // 86400).astype(int)
    out = []
    for d in range(1, dia.max() + 1):
        prueba = dia == d
        t0 = indice[prueba].min()
        out.append((np.asarray(indice < t0 - pd.Timedelta(separacion)), np.asarray(prueba)))
    return out


def ridge():
    """Ridge estandarizado; la penalización se elige con validación interna (generalizada, rápida)."""
    return make_pipeline(StandardScaler(), RidgeCV(alphas=ALFAS))


def hidraulico():
    """Q = a + b·√(ΔP·ρ): un solo parámetro físico más el intercepto."""
    return LinearRegression()


def metricas(y: pd.Series, p: pd.Series) -> dict:
    """MAE, MAPE, RMSE y R² sobre las filas con predicción."""
    e = (p - y).dropna(); yy = y.loc[e.index]
    return {"MAE_t_h": e.abs().mean(), "MAPE_%": 100 * (e.abs() / yy).mean(), "RMSE_t_h": np.sqrt((e ** 2).mean()),
            "R2": 1 - (e ** 2).sum() / ((yy - yy.mean()) ** 2).sum(), "filas": int(len(e))}


def bootstrap_bloques(err_a: pd.Series, err_b: pd.Series, bloque: str = "1h", n: int = 2000, semilla: int = 0) -> dict:
    """Diferencia de MAE (a − b) con IC90 remuestreando bloques de una hora (los errores vecinos se parecen)."""
    g = err_a.index.floor(bloque)
    A = err_a.abs().groupby(g).agg(["sum", "size"]); B = err_b.abs().groupby(g).sum()
    rng = np.random.default_rng(semilla)
    idx = rng.integers(0, len(A), (n, len(A)))
    sa, sb, cnt = A["sum"].to_numpy(), B.loc[A.index].to_numpy(), A["size"].to_numpy()
    dif = (sa[idx].sum(1) - sb[idx].sum(1)) / cnt[idx].sum(1)
    obs = (sa.sum() - sb.sum()) / cnt.sum()
    return {"dif_MAE": obs, "ic90": (np.quantile(dif, 0.05), np.quantile(dif, 0.95)), "P_a_peor": float((dif > 0).mean())}
