"""Serie III · Mercado — precio del azúcar No. 11: auditoría, cambio de contrato, volatilidad, regímenes y extremos.

La serie `Sugar_data.csv` es el contrato más próximo (front month) de Yahoo Finance (SB=F), pegado sin ajustar.
El contrato No. 11 vence el último día hábil del mes anterior al de entrega (marzo, mayo, julio y octubre), así que el
pegado cambia de contrato después del último día hábil de febrero, abril, junio y septiembre.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

MESES_VENCIMIENTO = (2, 4, 6, 9)   # último día hábil de estos meses vence el contrato próximo (H, K, N, V)


# ----------------------------------------------------------------------------- 1. carga y auditoría
def cargar_precio(ruta) -> pd.DataFrame:
    s = pd.read_csv(ruta, parse_dates=["date"]).set_index("date").sort_index()
    s.index.name = "fecha"
    return s


def auditoria_precio(s: pd.DataFrame) -> dict:
    inc = (s.high < s.low) | (s.close > s.high + 1e-9) | (s.close < s.low - 1e-9) | (s.open > s.high + 1e-9) | (s.open < s.low - 1e-9)
    hueco = s.index.to_series().diff().dt.days
    return {
        "filas": len(s), "desde": f"{s.index.min():%Y-%m-%d}", "hasta": f"{s.index.max():%Y-%m-%d}",
        "fechas_duplicadas": int(s.index.duplicated().sum()), "fines_de_semana": int((s.index.dayofweek >= 5).sum()),
        "faltantes": int(s.isna().sum().sum()), "ohlc_imposible": int(inc.sum()),
        "volumen_cero": int((s.volume == 0).sum()), "dias_planos_ohlc": int(((s.open == s.high) & (s.high == s.low) & (s.low == s.close)).sum()),
        "huecos_mayores_a_4_dias": int((hueco > 4).sum()),
        "rango_cierre": [float(s.close.min()), float(s.close.max())],
    }


def ohlc_imposible(s: pd.DataFrame) -> pd.Series:
    return (s.high < s.low) | (s.close > s.high + 1e-9) | (s.close < s.low - 1e-9) | (s.open > s.high + 1e-9) | (s.open < s.low - 1e-9)


# ----------------------------------------------------------------------------- 2. cambio de contrato
def vencimientos(s: pd.DataFrame, meses=MESES_VENCIMIENTO) -> pd.DatetimeIndex:
    """Último día con datos de cada mes de vencimiento (último día de negociación del contrato próximo).

    Si la serie termina antes de fin de mes, ese último mes incompleto no cuenta como vencimiento.
    """
    ult = s.groupby(s.index.to_period("M")).tail(1).index
    if s.index[-1] < s.index[-1] + pd.offsets.BMonthEnd(0):
        ult = ult[:-1]
    return ult[ult.month.isin(meses)]


def dias_de_cambio(s: pd.DataFrame) -> pd.DatetimeIndex:
    """Primer día hábil después de cada vencimiento: el pegado ya muestra el contrato siguiente."""
    pos = [s.index.get_loc(d) + 1 for d in vencimientos(s)]
    return pd.DatetimeIndex([s.index[i] for i in pos if i < len(s)])


def clasificar_dias(s: pd.DataFrame) -> pd.Series:
    lab = pd.Series("normal", index=s.index)
    ult = s.groupby(s.index.to_period("M")).tail(1).index
    lab[ult] = "fin de mes sin vencimiento"
    lab[vencimientos(s)] = "vencimiento"
    lab[dias_de_cambio(s)] = "cambio de contrato"
    return lab


def retornos(s: pd.DataFrame) -> pd.DataFrame:
    """Retornos logarítmicos diarios.

    - crudo: cierre contra cierre anterior (mezcla dos contratos el día del cambio).
    - brecha: apertura contra cierre anterior (la noche; el día del cambio incluye la diferencia entre contratos).
    - intradia: cierre contra apertura del mismo día (siempre un solo contrato).
    - ajustado: igual al crudo, salvo el día del cambio, donde se usa el intradía del contrato nuevo. Así se quita el
      salto entre contratos (a costa de perder el movimiento de esa noche, que en promedio es ~0). Los días de
      vencimiento con volumen cero (el contrato que vence casi sin negociarse, p. ej. el −18 % del 28/04/2000) quedan
      fuera: no representan al mercado.
    """
    c = s.close
    out = pd.DataFrame({"crudo": np.log(c).diff(), "brecha": np.log(s.open / c.shift()), "intradia": np.log(c / s.open)})
    out["ajustado"] = out.crudo
    cambio = dias_de_cambio(s)
    out.loc[cambio, "ajustado"] = out.loc[cambio, "intradia"]
    out["tipo"] = clasificar_dias(s)
    out.loc[(out.tipo == "vencimiento") & (s.volume == 0), "ajustado"] = np.nan
    return out


def indice_ajustado(s: pd.DataFrame, r: pd.DataFrame | None = None) -> pd.Series:
    """Precio ajustado hacia atrás: coincide con el último cierre y acumula solo movimientos de mercado."""
    r = retornos(s) if r is None else r
    acum = r.ajustado.fillna(0).cumsum()
    return s.close.iloc[-1] * np.exp(acum - acum.iloc[-1])


# ----------------------------------------------------------------------------- 3. volatilidad y regímenes
def vol_anualizada(r: pd.Series, por: str = "YE") -> pd.Series:
    return r.groupby(pd.Grouper(freq=por)).std() * np.sqrt(252)


def markov_volatilidad(r_diario: pd.Series, regimenes: int = 2, semilla: int = 20261019):
    """Markov con media y varianza que cambian por régimen, sobre retornos semanales (en %)."""
    from statsmodels.tsa.regime_switching.markov_regression import MarkovRegression
    w = r_diario.resample("W-FRI").sum(min_count=1).dropna() * 100
    np.random.seed(semilla)
    m = MarkovRegression(w, k_regimes=regimenes, trend="c", switching_variance=True).fit(disp=False, search_reps=30)
    return w, m


def tramos(estado: pd.Series) -> pd.DataFrame:
    """Tramos consecutivos de un estado booleano o categórico."""
    g = (estado != estado.shift()).cumsum()
    t = pd.DataFrame({"estado": estado.groupby(g).first(), "inicio": estado.index.to_series().groupby(g).first(),
                      "fin": estado.index.to_series().groupby(g).last(), "semanas": estado.groupby(g).size()})
    return t.reset_index(drop=True)


def fases_20(p: pd.Series, umbral: float = 0.20) -> pd.DataFrame:
    """Fases alcistas y bajistas: un giro se confirma cuando el precio se aleja ≥ 20 % del último extremo.

    Es la definición de mercado alcista y bajista que usan los operadores. Devuelve los extremos (picos y valles).
    """
    lp = np.log(p.dropna())
    lu, ld = np.log(1 + umbral), np.log(1 - umbral)
    piv = []
    est, ext_i = None, 0
    hi_i = lo_i = 0
    for i in range(1, len(lp)):
        v = lp.iloc[i]
        if v > lp.iloc[hi_i]: hi_i = i
        if v < lp.iloc[lo_i]: lo_i = i
        if est != "baja" and v <= lp.iloc[hi_i] + ld:        # confirma un pico
            piv.append(("pico", lp.index[hi_i], float(np.exp(lp.iloc[hi_i]))))
            est, lo_i = "baja", i
        elif est != "sube" and v >= lp.iloc[lo_i] + lu:      # confirma un valle
            piv.append(("valle", lp.index[lo_i], float(np.exp(lp.iloc[lo_i]))))
            est, hi_i = "sube", i
    f = pd.DataFrame(piv, columns=["tipo", "fecha", "precio"])
    f["cambio_al_siguiente_%"] = 100 * (f.precio.shift(-1) / f.precio - 1)
    if pd.api.types.is_datetime64_any_dtype(f.fecha):
        f["semanas_al_siguiente"] = (f.fecha.shift(-1) - f.fecha).dt.days / 7
    return f


def fases_en_paseo_aleatorio(n: int, sd: float, reps: int = 500, umbral: float = 0.20, semilla: int = 20261019) -> np.ndarray:
    """¿Cuántos giros de 20 % produce un paseo aleatorio con la misma volatilidad y largo?"""
    rng = np.random.default_rng(semilla)
    idx = pd.RangeIndex(n)
    return np.array([len(fases_20(pd.Series(np.exp(np.cumsum(rng.normal(0, sd, n))), index=idx), umbral)) for _ in range(reps)])


# ----------------------------------------------------------------------------- 4. extremos
def z_robusto(r: pd.Series) -> pd.Series:
    r = r.dropna()
    return (r - r.median()) / (1.4826 * (r - r.median()).abs().median())


def extremos(r: pd.Series, n: int = 15) -> pd.DataFrame:
    z = z_robusto(r)
    top = z.abs().sort_values(ascending=False).index[:n]
    return pd.DataFrame({"retorno_%": 100 * r[top], "z_robusto": z[top]}).sort_index()


def caidas_maximas(p: pd.Series, n: int = 5) -> pd.DataFrame:
    """Peores caídas desde un máximo previo (drawdowns), sin solaparse."""
    pico = p.cummax(); dd = p / pico - 1
    filas, usado = [], pd.Series(False, index=p.index)
    for _ in range(n):
        d = dd[~usado]
        if d.empty or d.min() >= 0: break
        fondo = d.idxmin(); ini = p[:fondo].idxmax()
        rec = p[fondo:][p[fondo:] >= p[ini]]
        fin = rec.index[0] if len(rec) else p.index[-1]
        filas.append({"pico": ini, "precio_pico": p[ini], "fondo": fondo, "precio_fondo": p[fondo],
                      "caida_%": 100 * (p[fondo] / p[ini] - 1), "recupera": fin if len(rec) else pd.NaT})
        usado[ini:fin] = True
    return pd.DataFrame(filas)
