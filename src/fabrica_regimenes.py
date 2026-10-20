"""Serie II · Caldera: regímenes de operación (pregunta 2).

Dos capas:
1. Modos por agrupamiento (k-means sobre promedios de 5 min de variables físicas), con dos pruebas: si hay más
   estructura que una nube gaussiana con la misma correlación, y si el agrupamiento se reproduce al remuestrear
   bloques de 2 horas (bootstrap por bloques, porque las ventanas vecinas no son independientes).
2. Ciclos y eventos que se ven en el tiempo: llenado y descarga del lecho, válvula del atemperador fija y la
   redistribución del aire de retorno.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.signal import find_peaks
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, silhouette_score

from fabrica_datos import banderas, variables_derivadas

# variables físicas del agrupamiento (nombre corto -> descripción)
VARIABLES = {
    "vapor": "Flujo de vapor (t/h)",
    "aire_total": "Aire total (Nm³/h)",
    "frac_primario": "Fracción de aire primario",
    "o2": "O₂ en gases (%)",
    "t_hogar": "Temperatura del hogar (°C)",
    "lecho": "Diferencial del lecho (Pa)",
    "agua_atemp": "Agua de atemperación (t/h)",
    "t_vapor": "Temperatura del vapor (°C)",
    "t_gases": "Temperatura de gases (°C)",
}


def tabla_ventanas(df: pd.DataFrame, freq: str = "5min") -> pd.DataFrame:
    """Promedios por ventana de las variables del agrupamiento y de contexto (válvula, presión de hogar)."""
    d = variables_derivadas(df)
    b = banderas(df)
    t = pd.DataFrame({
        "vapor": df["ZZQBCHLL"], "aire_total": d["aire_total"], "frac_primario": d["frac_primario"], "o2": d["o2"],
        "t_hogar": df["TE_8313B"], "lecho": d["lecho"], "agua_atemp": df["YJJWSLL"], "t_vapor": df["TE_8332A"],
        "t_gases": d["t_gases"], "valvula": df["TV_8329ZC"], "valvula_fija": b["valvula_fija"].astype(float),
        "presion_hogar": d["presion_hogar"],
    })
    return t.resample(freq).mean().dropna()


def estandarizar(X: pd.DataFrame) -> pd.DataFrame:
    """Z-scores por columna."""
    return (X - X.mean()) / X.std()


def nulo_gaussiano(Z: pd.DataFrame, k: int, n_rep: int = 30, semilla: int = 0) -> np.ndarray:
    """Siluetas de k-means sobre datos gaussianos con la misma correlación (una sola nube, sin grupos)."""
    rng = np.random.default_rng(semilla)
    C = np.cov(Z.to_numpy().T)
    out = []
    for r in range(n_rep):
        G = rng.multivariate_normal(np.zeros(Z.shape[1]), C, len(Z))
        out.append(silhouette_score(G, KMeans(k, n_init=4, random_state=r).fit_predict(G)))
    return np.array(out)


def estabilidad_bloques(Z: pd.DataFrame, k: int, bloque: int = 24, n_rep: int = 60, semilla: int = 0) -> np.ndarray:
    """ARI entre el agrupamiento original y el de remuestras por bloques (24 ventanas de 5 min = 2 h)."""
    rng = np.random.default_rng(semilla)
    n = len(Z)
    base = KMeans(k, n_init=20, random_state=0).fit(Z).labels_
    aris = []
    for r in range(n_rep):
        ini = rng.integers(0, n - bloque, n // bloque + 1)
        ii = np.concatenate([np.arange(s, s + bloque) for s in ini])[:n]
        km = KMeans(k, n_init=5, random_state=r).fit(Z.iloc[ii])
        aris.append(adjusted_rand_score(base, km.predict(Z)))
    return np.array(aris)


def nombrar_modos(centros: pd.DataFrame) -> dict[int, str]:
    """Nombres con reglas fijas sobre los centros (z): la carga primero; a carga media, la temperatura del vapor."""
    libres = list(centros.index)
    nombres = {}
    alto = centros.loc[libres, "vapor"].idxmax(); nombres[alto] = "Carga alta"; libres.remove(alto)
    bajo = centros.loc[libres, "vapor"].idxmin(); nombres[bajo] = "Carga baja"; libres.remove(bajo)
    if len(libres) == 1:
        nombres[libres[0]] = "Carga media"
        return nombres
    orden = (centros.loc[libres, "t_vapor"] - centros.loc[libres, "o2"]).sort_values(ascending=False).index
    etiquetas = ["Carga media, vapor en temperatura", "Carga media, más aire y vapor frío"]
    for i, g in enumerate(orden):
        nombres[g] = etiquetas[i] if i < len(etiquetas) else f"Carga media {i + 1}"
    return nombres


def residuos_carga(W: pd.DataFrame, columnas: list[str], carga: str = "vapor") -> pd.DataFrame:
    """Parte de cada variable que no explica la carga (residuo de una recta contra el flujo de vapor)."""
    return pd.DataFrame({c: W[c] - np.polyval(np.polyfit(W[carga], W[c], 1), W[carga]) for c in columnas}, index=W.index)


def correlacion_rezagada(x: pd.Series, y: pd.Series, rezagos: list[int]) -> pd.Series:
    """corr(x_t, y_{t+L}) para cada rezago L (en pasos de la serie). L > 0: x adelanta a y."""
    return pd.Series({L: x.corr(y.shift(-L)) for L in rezagos})


def tramos(etiquetas: pd.Series) -> pd.DataFrame:
    """Tramos consecutivos con la misma etiqueta: inicio, fin, duración en ventanas."""
    g = etiquetas.ne(etiquetas.shift()).cumsum()
    return pd.DataFrame({"etiqueta": etiquetas.groupby(g).first(), "inicio": etiquetas.index.to_series().groupby(g).first(),
                         "fin": etiquetas.index.to_series().groupby(g).last(), "ventanas": etiquetas.groupby(g).size()})


def fases_lecho(lecho_1min: pd.Series, prominencia: float = 700, distancia_min: int = 60) -> tuple[pd.Series, pd.DataFrame]:
    """Fases del ciclo del lecho: 'llenado' (de valle a pico) y 'descarga' (de pico a valle).

    El diferencial del lecho sube mientras se acumula material y cae cuando se descarga ceniza de fondo.
    """
    z = lecho_1min.rolling(5, center=True, min_periods=1).mean()
    pk, _ = find_peaks(z.to_numpy(), prominence=prominencia, distance=distancia_min)
    va, _ = find_peaks(-z.to_numpy(), prominence=prominencia, distance=distancia_min)
    ev = sorted([(i, "pico") for i in pk] + [(i, "valle") for i in va])
    fase = pd.Series(pd.NA, index=z.index, dtype="object")
    filas = []
    for (i, t1), (j, t2) in zip(ev[:-1], ev[1:]):
        if t1 == t2:
            continue
        nombre = "descarga" if t1 == "pico" else "llenado"
        fase.iloc[i:j] = nombre
        filas.append({"fase": nombre, "inicio": z.index[i], "fin": z.index[j], "minutos": j - i,
                      "cambio_pa": float(z.iloc[j] - z.iloc[i])})
    return fase, pd.DataFrame(filas)
