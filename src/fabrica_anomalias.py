"""Serie II · Caldera: anomalías, alertas tempranas y diagnóstico de falla de sensor contra falla de equipo (pregunta 4).

Dos detectores con propósitos distintos, más reglas simples para el jefe de calderas:
1. Verificación de sensores (por redundancia y física): cada sensor se compara con lo que dicen sus pares o un modelo
   físico. Si uno solo se separa de sus pares, la sospecha es el sensor.
2. Monitor del proceso (PCA con ventana móvil de 24 h; T² de Hotelling y error de reconstrucción SPE): detecta
   estados de operación poco comunes.
   Si varias variables acopladas se mueven juntas y los pares coinciden, la sospecha es el equipo o la operación.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA

from fabrica_datos import PRESION_HOGAR, variables_derivadas

MAD_A_SD = 1.4826


# ----------------------------------------------------------------------------- 1. verificación de sensores
def residuos_verificacion(M: pd.DataFrame, vapor_virtual: pd.Series) -> pd.DataFrame:
    """Residuos de 1 min de cada chequeo de redundancia o física (no dependen de la carga)."""
    r = pd.DataFrame(index=M.index)
    for c in PRESION_HOGAR:                                   # cada presión de hogar contra la mediana de las otras 5
        r[c] = M[c] - M[[o for o in PRESION_HOGAR if o != c]].median(axis=1)
    r["O2 izq. − der."] = M["AIR_8301A"] - M["AIR_8301B"]
    r["Lecho izq. − der."] = M["ZCLCCY"] - M["YCLCCY"]
    r["Gases izq. − der."] = M["TE_8319A"] - M["TE_8319B"]
    r["Retorno izq. − der."] = M["FT_8306A"] - M["FT_8306B"]
    r["Vapor medido − virtual"] = M["ZZQBCHLL"] - vapor_virtual
    # la válvula del atemperador y el agua que pasa deben moverse juntas (recta ajustada en la referencia)
    r["Agua − f(válvula)"] = M["YJJWSLL"]
    return r


def ajustar_referencia(R: pd.DataFrame, M: pd.DataFrame, ref: np.ndarray) -> dict:
    """Mediana y desvío robusto de cada residuo en el período de referencia (y la recta válvula → agua)."""
    a, b = np.polyfit(M.loc[ref, "TV_8329ZC"], M.loc[ref, "YJJWSLL"], 1)
    R = R.copy(); R["Agua − f(válvula)"] = M["YJJWSLL"] - (a * M["TV_8329ZC"] + b)
    centro = R[ref].median()
    escala = MAD_A_SD * (R[ref] - centro).abs().median()
    return {"centro": centro, "escala": escala, "valvula": (a, b)}


def puntajes_verificacion(R: pd.DataFrame, M: pd.DataFrame, refp: dict) -> pd.DataFrame:
    """Residuo estandarizado (z robusto) de cada chequeo."""
    R = R.copy(); a, b = refp["valvula"]
    R["Agua − f(válvula)"] = M["YJJWSLL"] - (a * M["TV_8329ZC"] + b)
    return (R - refp["centro"]) / refp["escala"]


def persistente(cond: pd.Series | pd.DataFrame, n: int):
    """Verdadero cuando la condición lleva al menos n muestras seguidas."""
    def _uno(s):
        s = s.fillna(False).astype(bool)
        return s.astype(int).groupby((~s).cumsum()).cumsum() >= n
    return cond.apply(_uno) if isinstance(cond, pd.DataFrame) else _uno(cond)


def con_histeresis(alarma: pd.Series | pd.DataFrame, apagar: int = 15):
    """La alarma se apaga solo después de `apagar` muestras seguidas sin condición (une episodios cercanos)."""
    f = lambda s: s.fillna(False).astype(int).rolling(apagar, min_periods=1).max().astype(bool)
    return alarma.apply(f) if isinstance(alarma, pd.DataFrame) else f(alarma)


def episodios(alarma: pd.Series) -> pd.DataFrame:
    """Tramos continuos en alarma: inicio, fin y duración en muestras."""
    a = alarma.fillna(False).astype(bool)
    g = (a != a.shift()).cumsum()[a]
    if g.empty:
        return pd.DataFrame(columns=["inicio", "fin", "muestras"])
    idx = a[a].index.to_series()
    return pd.DataFrame({"inicio": idx.groupby(g).first(), "fin": idx.groupby(g).last(), "muestras": idx.groupby(g).size()}).reset_index(drop=True)


def sensores_congelados(df: pd.DataFrame, ref: np.ndarray, minimo: int = 12) -> pd.DataFrame:
    """Valor idéntico por más tiempo del que el sensor mostró en la referencia (el doble de su máximo, y al menos 1 min).

    Solo mira hacia atrás: en cada muestra cuenta cuántas lleva repitiendo el mismo valor hasta ese momento.
    Un transmisor ruidoso que deja de cambiar casi siempre está trabado o perdió la señal.
    """
    out = pd.DataFrame(index=df.index)
    for c in df.columns:
        g = df[c].ne(df[c].shift()).cumsum()
        hasta_ahora = df[c].groupby(g).cumcount() + 1
        limite = max(2 * int(g[ref].value_counts().max()), minimo)
        out[c] = hasta_ahora > limite
    return out


# ----------------------------------------------------------------------------- 2. monitor del proceso
VARIABLES_PROCESO = ["vapor", "aire_total", "frac_primario", "o2", "t_hogar", "lecho", "agua_atemp", "t_vapor",
                     "t_gases", "presion_hogar", "corriente_tiro", "retorno_total", "p_domo"]


def tabla_proceso(df: pd.DataFrame) -> pd.DataFrame:
    """Variables de proceso en promedios de 1 min (pares resumidos: lo que mira el monitor de proceso)."""
    d = variables_derivadas(df)
    t = pd.DataFrame({"vapor": df["ZZQBCHLL"], "aire_total": d["aire_total"], "frac_primario": d["frac_primario"],
                      "o2": d["o2"], "t_hogar": df["TE_8313B"], "lecho": d["lecho"], "agua_atemp": df["YJJWSLL"],
                      "t_vapor": df["TE_8332A"], "t_gases": d["t_gases"], "presion_hogar": d["presion_hogar"],
                      "corriente_tiro": df["YFJ3_AI"], "retorno_total": d["retorno_total"], "p_domo": df["PTCA_8322A"]})
    return t.resample("1min").mean().interpolate(limit=3)


def monitor_t2(X: pd.DataFrame, ventana: str = "24h", paso: str = "1h", varianza: float = 0.90, q_t2: float = 0.995,
               q_spe: float = 0.999) -> dict:
    """PCA reentrenada cada `paso` con las últimas `ventana` (solo pasado). Dos estadísticos por minuto:

    - T² de Hotelling: qué tan lejos está el punto dentro del patrón normal de correlaciones (operación inusual).
    - SPE (error de reconstrucción): cuánto se sale del patrón (variables que dejan de moverse juntas).
    Límites: percentiles q_t2 y q_spe de cada estadístico en la ventana de referencia. Los minutos que ya estuvieron en alarma (5 min
    seguidos sobre un límite) no entran a las referencias siguientes: el monitor no aprende lo anormal como si fuera normal. Contribuciones por variable: al T²,
    z_j · Σ_k p_jk·t_k/λ_k (suman el T²); al SPE, el residuo al cuadrado de cada variable (suman el SPE).
    """
    t0 = X.index[0] + pd.Timedelta(ventana)
    out = {k: pd.Series(np.nan, index=X.index) for k in ("T2", "lim_T2", "SPE", "lim_SPE")}
    out["con_T2"] = pd.DataFrame(np.nan, index=X.index, columns=X.columns)
    out["con_SPE"] = pd.DataFrame(np.nan, index=X.index, columns=X.columns)
    anormal = pd.Series(False, index=X.index)
    for ini in pd.date_range(t0, X.index[-1], freq=paso):
        ref = X.loc[ini - pd.Timedelta(ventana): ini - pd.Timedelta("1min")]
        ref = ref[~anormal.loc[ref.index]]
        apl = X.loc[ini: ini + pd.Timedelta(paso) - pd.Timedelta("1min")]
        if len(apl) == 0:
            continue
        mu, sd = ref.mean(), ref.std()
        Zr = (ref - mu) / sd; Za = (apl - mu) / sd
        k = int(np.searchsorted(np.cumsum(PCA().fit(Zr).explained_variance_ratio_), varianza) + 1)
        p = PCA(k).fit(Zr); lam = p.explained_variance_
        Sr, Sa = p.transform(Zr), p.transform(Za)
        Rr = Zr.to_numpy() - p.inverse_transform(Sr); Ra = Za.to_numpy() - p.inverse_transform(Sa)
        t2a, spea = (Sa ** 2 / lam).sum(axis=1), (Ra ** 2).sum(axis=1)
        lt, ls = np.quantile((Sr ** 2 / lam).sum(axis=1), q_t2), np.quantile((Rr ** 2).sum(axis=1), q_spe)
        out["T2"].loc[apl.index] = t2a; out["lim_T2"].loc[apl.index] = lt
        out["SPE"].loc[apl.index] = spea; out["lim_SPE"].loc[apl.index] = ls
        fuera = pd.Series((t2a > lt) | (spea > ls), index=apl.index)
        anormal.loc[apl.index] = persistente(fuera, 5)          # solo lo que sería alarma (5 min seguidos)
        out["con_T2"].loc[apl.index] = Za.to_numpy() * ((Sa / lam) @ p.components_)
        out["con_SPE"].loc[apl.index] = Ra ** 2
    return out


# ----------------------------------------------------------------------------- 3. reglas para el jefe de calderas
def reglas_jefe(df: pd.DataFrame) -> pd.DataFrame:
    """Condiciones físicas simples sobre datos de 5 s (con persistencia). Cada columna es una alerta."""
    d = variables_derivadas(df)
    n = lambda seg: max(1, seg // 5)
    a = pd.DataFrame(index=df.index)
    a["Hogar presurizado (mediana > 0 Pa, 10 s)"] = persistente(d["presion_hogar"] > 0, n(10))
    a["O₂ bajo (< 1.2 %, 2 min)"] = persistente(d["o2"] < 1.2, n(120))
    a["O₂ alto (> 3 %, 10 min)"] = persistente(d["o2"] > 3.0, n(600))
    a["Vapor caliente (> 548 °C, 2 min)"] = persistente(df["TE_8332A"] > 548, n(120))
    a["Vapor frío (< 526 °C, 5 min)"] = persistente(df["TE_8332A"] < 526, n(300))
    a["Lecho alto (> 11,300 Pa, 5 min): descargar"] = persistente(d["lecho"] > 11300, n(300))
    a["Corriente del tiro alta (> 26 A, 1 min)"] = persistente(df["YFJ3_AI"].rolling(12, min_periods=6).mean() > 26, 1)
    return a


# ----------------------------------------------------------------------------- 4. fallas sintéticas
def inyectar(df: pd.DataFrame, desde: str, hasta: str, tipo: str, sensor: str | list[str], magnitud: float = 0.0) -> pd.DataFrame:
    """Copia de los datos con una falla sintética en [desde, hasta].

    tipo: 'sesgo' (suma un valor fijo), 'deriva' (rampa de 0 a `magnitud`), 'congelado' (repite el último valor),
    'proceso' (sesgo igual en varios sensores a la vez: un cambio real que todos ven).
    """
    out = df.copy()
    w = (out.index >= pd.Timestamp(desde)) & (out.index <= pd.Timestamp(hasta))
    sensores = [sensor] if isinstance(sensor, str) else sensor
    for s in sensores:
        if tipo in ("sesgo", "proceso"):
            out.loc[w, s] = out.loc[w, s] + magnitud
        elif tipo == "deriva":
            out.loc[w, s] = out.loc[w, s] + np.linspace(0, magnitud, w.sum())
        elif tipo == "congelado":
            out.loc[w, s] = out.loc[~w & (out.index < pd.Timestamp(desde)), s].iloc[-1]
    return out
