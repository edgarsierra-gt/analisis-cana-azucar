"""
Serie I · Campo — pregunta 4: auditoría de renovaciones con los registros de cosecha que un ingenio ya tiene.

Entrada mínima: una fila por lote y corte, con
    zafra (año de inicio), finca, lote, variedad, corte (0 = plantía; recomendado), tch (t caña/ha),
    rendimiento (kg azúcar/t; opcional).

Qué hace:
1. reconstruir_ciclos: arma los ciclos de cada lote (plantía → socas → renovación).
2. auditar: compara la duración de cada ciclo con el óptimo económico (pregunta 1) y clasifica la renovación.
3. regla_lote: para los ciclos abiertos, decide con los datos del propio lote si conviene otro corte o renovar.

Economía en unidades métricas, con los supuestos de la prueba convertidos (ver SUPUESTOS_METRICOS).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

LB_KG, TC_TM, ACRE_HA = 0.45359237, 0.90718474, 0.40468564
TCA_A_TCH = TC_TM / ACRE_HA          # t cortas/acre -> t métricas/ha (×2.2417)
TRS_A_KG = LB_KG / TC_TM             # lb/t corta -> kg/t métrica (×0.5)


@dataclass(frozen=True)
class SupuestosMetricos:
    """Supuestos de la prueba en unidades métricas (US$/kg, US$/t métrica, US$/ha); se usan en la economía por lote."""
    precio_kg: float = 0.20 / LB_KG            # US$/kg azúcar (= US$0.20/lb)
    corte_t: float = 14.0 / TC_TM              # US$/t métrica de caña (= US$14/t corta)
    mantenimiento_ha: float = 350 / ACRE_HA    # US$/ha/año
    renovacion_ha: float = 1100 / ACRE_HA      # US$/ha en la plantía
    max_cortes: int = 8


def curva_metrica(curva_testigos: list[dict]) -> pd.DataFrame:
    """Curva de los testigos de la pregunta 1 en TCH y kg/t; se extiende a más cortes con la última caída observada."""
    c = pd.DataFrame(curva_testigos).set_index("corte")
    out = pd.DataFrame({"tch": c["tca"] * TCA_A_TCH, "rend": c["trs"] * TRS_A_KG})
    return out


def margen_ciclo(tch: np.ndarray, rend: np.ndarray, s: SupuestosMetricos) -> tuple[np.ndarray, np.ndarray]:
    """Margen de cada corte y margen promedio anual de un ciclo de n cortes (n = 1..len)."""
    m = tch * rend * s.precio_kg - s.corte_t * tch - s.mantenimiento_ha
    m = m - np.r_[s.renovacion_ha, np.zeros(len(m) - 1)]
    return m, np.cumsum(m) / np.arange(1, len(m) + 1)


# ----------------------------------------------------------------------------- 1. ciclos
def reconstruir_ciclos(cos: pd.DataFrame) -> pd.DataFrame:
    """Asigna un número de ciclo a cada fila. Empieza un ciclo nuevo cuando:
    - el corte registrado vuelve a 0 o baja (renovación), o
    - cambia la variedad, o
    - sin columna de corte, hay un hueco de 2 o más zafras.
    """
    c = cos.sort_values(["finca", "lote", "zafra"]).copy()
    tiene_corte = "corte" in c and c["corte"].notna().any()
    g = c.groupby(["finca", "lote"], sort=False)
    nuevo = g.cumcount() == 0
    nuevo |= c["variedad"] != g["variedad"].shift()
    if tiene_corte:
        nuevo |= (c["corte"] == 0) | (c["corte"] <= g["corte"].shift())
    else:
        nuevo |= (c["zafra"] - g["zafra"].shift()) >= 2
    c["ciclo"] = nuevo.groupby([c["finca"], c["lote"]]).cumsum().astype(int)
    if not tiene_corte:   # corte inferido: posición dentro del ciclo (si el ciclo empezó antes de los datos, es un mínimo)
        c["corte"] = c.groupby(["finca", "lote", "ciclo"]).cumcount()
    return c


def resumir_ciclos(c: pd.DataFrame) -> pd.DataFrame:
    """Una fila por ciclo: variedad, zafras, cortes, si está cerrado (hubo renovación después) y TCH por corte."""
    ult = c.groupby(["finca", "lote"])["ciclo"].transform("max")
    c = c.assign(cerrado=c["ciclo"] < ult)
    r = c.groupby(["finca", "lote", "ciclo"]).agg(
        variedad=("variedad", "first"), zafra_inicio=("zafra", "min"), zafra_fin=("zafra", "max"),
        primer_corte=("corte", "min"), ultimo_corte=("corte", "max"), cortes_observados=("corte", "size"),
        cerrado=("cerrado", "first"), tch_medio=("tch", "mean")).reset_index()
    r["cortes_ciclo"] = r["ultimo_corte"] + 1
    r["inicio_observado"] = r["primer_corte"] == 0
    return r


# ----------------------------------------------------------------------------- 2. auditoría
def auditar(ciclos: pd.DataFrame, optimo: dict | int, tolerancia: int = 1) -> pd.DataFrame:
    """Clasifica cada ciclo contra el número óptimo de cortes de su variedad (dict variedad -> n, o un n común)."""
    opt = ciclos["variedad"].map(optimo) if isinstance(optimo, dict) else pd.Series(optimo, index=ciclos.index)
    opt = opt.fillna(np.nanmedian(list(optimo.values())) if isinstance(optimo, dict) else optimo)
    n = ciclos["cortes_ciclo"]
    estado = np.select(
        [ciclos["cerrado"] & (n < opt - tolerancia),
         ciclos["cerrado"] & (n > opt + tolerancia),
         ciclos["cerrado"],
         ~ciclos["cerrado"] & (n > opt + tolerancia),
         ~ciclos["cerrado"] & (n >= opt)],
        ["renovación temprana", "renovación tardía", "renovación a tiempo", "vencido: renovar", "renovar al cerrar la zafra"],
        default="en ciclo")
    return ciclos.assign(optimo=opt, estado=estado)


def resumen_lotes(aud: pd.DataFrame, zafra_ini: int) -> pd.DataFrame:
    """Diagnóstico por lote en la ventana de datos."""
    g = aud.groupby(["finca", "lote"])
    out = pd.DataFrame({
        "renovaciones": g["cerrado"].sum(),
        "tempranas": g["estado"].apply(lambda s: (s == "renovación temprana").sum()),
        "tardias": g["estado"].apply(lambda s: (s == "renovación tardía").sum()),
        "estado_actual": g["estado"].last(),
        "cortes_actuales": g["cortes_ciclo"].last(),
        "inicio_antes_de_datos": g.apply(lambda x: (not x["inicio_observado"].iloc[0]) and x["zafra_inicio"].iloc[0] == zafra_ini,
                                         include_groups=False)})
    out["diagnostico"] = np.select(
        [out["renovaciones"] == 0, out["tempranas"] >= 1, out["tardias"] >= 1,
         out["estado_actual"].str.startswith("vencido")],
        ["sin renovación en el período", "renueva antes de tiempo", "renueva tarde", "ciclo actual vencido"],
        default="renovación en orden")
    return out


# ----------------------------------------------------------------------------- 3. regla por lote
def regla_lote(c: pd.DataFrame, curva: pd.DataFrame, s: SupuestosMetricos = SupuestosMetricos(),
               peso_previo: float = 3.0) -> pd.DataFrame:
    """Para cada ciclo abierto: ¿conviene un corte más o renovar ya?

    Regla de reemplazo: se mantiene la soca mientras el margen esperado del PRÓXIMO corte supere el margen promedio
    anual de un ciclo nuevo en ese mismo lote. La caída del lote se estima con sus propios cortes, encogida hacia la
    caída típica (peso_previo = cortes "ficticios" con la caída típica).
    """
    n_ext = 40                                                         # cortes posibles en un lote que nunca se renovó
    ln_obs = np.log(curva["tch"].to_numpy())
    caida_ext = ln_obs[-1] - ln_obs[-2]
    ln_std = np.r_[ln_obs, ln_obs[-1] + caida_ext * np.arange(1, n_ext - len(ln_obs) + 1)]
    rend_std = np.r_[curva["rend"].to_numpy(), np.repeat(curva["rend"].iloc[-1], n_ext - len(curva))]
    pend_std = np.polyfit(np.arange(len(ln_obs)), ln_obs, 1)[0]        # caída típica por corte (con datos)

    abiertos = c[c["ciclo"] == c.groupby(["finca", "lote"])["ciclo"].transform("max")]
    filas = []
    for (f, l), x in abiertos.groupby(["finca", "lote"]):
        k, y = x["corte"].to_numpy(float), np.log(x["tch"].to_numpy())
        nivel = np.mean(y - ln_std[k.astype(int)])                     # calidad del lote vs curva típica
        if len(x) >= 2 and np.ptp(k) > 0:
            b = np.polyfit(k, y - nivel, 1)[0]
            w = (len(x) - 1) / (len(x) - 1 + peso_previo)
            pend = w * b + (1 - w) * pend_std
        else:
            pend = pend_std
        k_sig = int(k.max()) + 1
        if k_sig >= s.max_cortes:
            filas.append({"finca": f, "lote": l, "variedad": x["variedad"].iloc[-1], "corte_siguiente": k_sig,
                          "decision": "renovar"})                     # más allá de lo que tiene sentido proyectar
            continue
        tch_sig = np.exp(np.log(x["tch"].iloc[-1]) + pend)
        rend_sig = x["rendimiento"].mean() if "rendimiento" in x and x["rendimiento"].notna().any() else rend_std[k_sig]
        m_sig = tch_sig * rend_sig * s.precio_kg - s.corte_t * tch_sig - s.mantenimiento_ha
        tch_nuevo = np.exp(ln_std[:len(curva)] + nivel)
        _, prom = margen_ciclo(tch_nuevo, rend_std[:len(curva)], s)
        mejor_nuevo = np.nanmax(prom[:len(curva)])                   # como en la pregunta 1: hasta donde hay datos
        filas.append({"finca": f, "lote": l, "variedad": x["variedad"].iloc[-1], "corte_siguiente": k_sig,
                      "tch_esperado": tch_sig, "margen_siguiente": m_sig, "margen_ciclo_nuevo": mejor_nuevo,
                      "decision": "otro corte" if m_sig >= mejor_nuevo else "renovar"})
    return pd.DataFrame(filas)


# ----------------------------------------------------------------------------- simulación (solo para probar el código)
def simular_portafolio(curva: pd.DataFrame, n_fincas: int = 60, lotes_por_finca: int = 8,
                       zafras: range = range(2012, 2024), semilla: int = 20261019) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Registros de cosecha SIMULADOS con políticas de renovación conocidas, para validar la auditoría.

    No representan a ningún ingenio: la curva base es la de los testigos de Louisiana en unidades métricas.
    Devuelve (cosechas, politica_real_por_lote).
    """
    rng = np.random.default_rng(semilla)
    ln_std = np.log(curva["tch"].to_numpy())
    caida_ext = ln_std[-1] - ln_std[-2]
    ln_std = np.r_[ln_std, ln_std[-1] + caida_ext * np.arange(1, 20)]
    rend_std = np.r_[curva["rend"].to_numpy(), np.repeat(curva["rend"].iloc[-1], 19)]
    variedades = {"VAR-A": (0.00, 0.00), "VAR-B": (0.06, 0.02), "VAR-C": (-0.03, -0.03), "VAR-D": (0.08, 0.01)}
    politicas = {"temprana": 2, "a tiempo": 4, "tardía": 7, "nunca": 99}
    efecto_anio = dict(zip(zafras, rng.normal(0, 0.08, len(zafras))))
    filas, verdad = [], []
    for f in range(n_fincas):
        q_finca = rng.normal(0, 0.10)
        for l in range(lotes_por_finca):
            pol = rng.choice(list(politicas), p=[0.15, 0.50, 0.20, 0.15])
            n_pol = politicas[pol]
            q = q_finca + rng.normal(0, 0.06)
            var = rng.choice(list(variedades))
            k = int(rng.integers(2, 6)) if pol == "nunca" else int(rng.integers(0, n_pol))
            for z in zafras:
                if k >= n_pol:                                   # renovación
                    k, var = 0, rng.choice(list(variedades))
                a, b = variedades[var]
                tch = np.exp(ln_std[k] + q + a + b * k + efecto_anio[z] + rng.normal(0, 0.10))
                rend = rend_std[k] * np.exp(rng.normal(0, 0.04))
                filas.append({"zafra": z, "finca": f"F{f:02d}", "lote": f"F{f:02d}-L{l}", "variedad": var,
                              "corte": k, "tch": tch, "rendimiento": rend})
                k += 1
            verdad.append({"finca": f"F{f:02d}", "lote": f"F{f:02d}-L{l}", "politica": pol, "cortes_politica": n_pol})
    return pd.DataFrame(filas), pd.DataFrame(verdad)
