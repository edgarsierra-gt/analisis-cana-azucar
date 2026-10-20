"""
Serie IV · lógica de la API de la caldera (Serie II), sin FastAPI: funciones puras sobre los artefactos JSON.

Lee los JSON que dejan los notebooks 06-09 y calcula igual que ellos:
    outputs/models/serie2_sensores.json        diccionario corregido de los 30 sensores (notebook 06)
    outputs/models/serie2_modos.json           zonas de carga: medias, desvíos y centros (notebook 07)
    outputs/models/serie2_sensor_virtual.json  Ridge final, fórmula hidráulica y de dos variables (notebook 08)
    outputs/models/serie2_verificacion.json    centro, escala y umbral de cada chequeo de sensores (notebook 09)

Las entradas son promedios de 1 min (vapor y verificación) o de 5 min (modo), como en los notebooks. La API no
guarda estado: quien la llama manda la ventana de minutos que hace falta.
"""
from __future__ import annotations

import json
import math
from functools import lru_cache

import numpy as np

from api.servicios import MODELOS, ROOT, ErrorEntrada

TABLAS = ROOT / "outputs" / "tables"
PRESION_HOGAR = [f"PT_8313{x}" for x in "ABCDEF"]
MINUTOS_VAPOR = 10                       # el Ridge usa el valor actual, rezagos de 1, 2 y 5 min y la media de 10 min


@lru_cache
def artefactos() -> dict:
    leer = lambda n: json.loads((MODELOS / n).read_text(encoding="utf-8"))
    vapor = leer("serie2_sensor_virtual.json")
    p3 = json.loads((TABLAS / "serie2_resumen_p3.json").read_text(encoding="utf-8"))
    return {"sensores": leer("serie2_sensores.json"), "modos": leer("serie2_modos.json"), "vapor": vapor,
            "verificacion": leer("serie2_verificacion.json"),
            "mae_ridge": p3["metricas"]["Ridge completo"]["MAE_t_h"]}


def _num(x: float, d: int = 3) -> float | None:
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), d)


def raiz_dp_rho(p_domo: float, p_colector: float, t_vapor: float) -> float:
    """√(ΔP·ρ) del sobrecalentador: ΔP = domo − colector, ρ ∝ P/T (como fabrica_sensor_virtual.tabla_minuto)."""
    return math.sqrt(max((p_domo - p_colector) * p_colector / (t_vapor + 273.15), 0.0))


# ----------------------------------------------------------------------------- diccionario
def sensores() -> dict:
    s = artefactos()["sensores"]
    return {"descripcion": s["descripcion"], "periodo_s": s["periodo_s"], "archivo_base": s["archivo_base"],
            "excluidos_de_modelos": s["excluir_modelos"], "sensores": s["sensores"]}


# ----------------------------------------------------------------------------- pregunta 2: zona de carga
def modo(ventana: dict[str, float]) -> dict:
    """Zona de carga de una ventana de 5 min: estandariza con media y desvío del JSON y asigna el centro más cercano."""
    m = artefactos()["modos"]
    z = {v: (ventana[v] - m["media"][v]) / m["desvio"][v] for v in m["variables"]}
    dist = {g: math.sqrt(sum((z[v] - c[v]) ** 2 for v in m["variables"])) for g, c in m["centros_z"].items()}
    orden = sorted(dist, key=dist.get)
    return {"modo": orden[0], "distancias": {g: _num(dist[g]) for g in orden},
            "variables_estandarizadas": {v: _num(z[v]) for v in m["variables"]},
            "aviso": "No hay modos discretos (notebook 07): son tres zonas de un continuo dominado por la carga."}


# ----------------------------------------------------------------------------- pregunta 3: sensor virtual
def vapor_virtual(minutos: list[dict[str, float]]) -> dict:
    """Flujo de vapor estimado para el último minuto con el Ridge final (rezagos de 0, 1, 2 y 5 min y media de 10 min).

    `minutos`: promedios de 1 min, del más antiguo al más reciente; se usan los últimos 10.
    """
    a = artefactos(); mv = a["vapor"]
    if len(minutos) < MINUTOS_VAPOR:
        raise ErrorEntrada(f"Se necesitan al menos {MINUTOS_VAPOR} minutos consecutivos; llegaron {len(minutos)}.")
    filas = [dict(f) for f in minutos[-MINUTOS_VAPOR:]]
    for f in filas:
        f["raiz_dp_rho"] = raiz_dp_rho(f["PTCA_8322A"], f["PTCA_8324"], f["TE_8332A"])
    x = []
    for nombre in mv["variables_modelo"]:
        var, cual = nombre.split("|")
        serie = [f[var] for f in filas]
        x.append(float(np.mean(serie)) if cual.startswith("media") else serie[-1 - int(cual.removeprefix("t-"))])
    r = mv["ridge"]
    pred = float(((np.array(x) - np.array(r["media"])) / np.array(r["escala"])) @ np.array(r["coef"]) + r["intercepto"])
    ult = filas[-1]
    hid = mv["hidraulico"]["a"] + mv["hidraulico"]["b"] * ult["raiz_dp_rho"]
    dv = mv["dos_variables"]
    dos = dv["a"] + dv["b"] * ult["raiz_dp_rho"] + dv["c"] * ult["YJJWSLL"]
    out = {
        "vapor_t_h": _num(pred, 2),
        "banda_90_t_h": [_num(pred + mv["banda_t_h"]["p05"], 2), _num(pred + mv["banda_t_h"]["p95"], 2)],
        "error_tipico_t_h": _num(a["mae_ridge"], 2),
        "otras_estimaciones": {"hidraulico_una_variable": _num(hid, 2), "formula_dos_variables": _num(dos, 2)},
        "raiz_dp_rho": _num(ult["raiz_dp_rho"], 5),
        "minutos_usados": MINUTOS_VAPOR,
    }
    if ult.get("ZZQBCHLL") is not None:
        out["vapor_medido_t_h"] = _num(ult["ZZQBCHLL"], 2)
        out["medido_menos_estimado_t_h"] = _num(ult["ZZQBCHLL"] - pred, 2)
    return out


# ----------------------------------------------------------------------------- pregunta 4: verificación de sensores
def _residuos(f: dict[str, float], v: dict) -> dict[str, float]:
    """Residuos de los 12 chequeos para un minuto (igual que fabrica_anomalias.residuos_verificacion)."""
    r = {c: f[c] - float(np.median([f[o] for o in PRESION_HOGAR if o != c])) for c in PRESION_HOGAR}
    r["O2 izq. − der."] = f["AIR_8301A"] - f["AIR_8301B"]
    r["Lecho izq. − der."] = f["ZCLCCY"] - f["YCLCCY"]
    r["Gases izq. − der."] = f["TE_8319A"] - f["TE_8319B"]
    r["Retorno izq. − der."] = f["FT_8306A"] - f["FT_8306B"]
    vd = v["virtual_dos_variables"]
    virtual = vd["a"] + vd["b"] * raiz_dp_rho(f["PTCA_8322A"], f["PTCA_8324"], f["TE_8332A"]) + vd["c"] * f["YJJWSLL"]
    r["Vapor medido − virtual"] = f["ZZQBCHLL"] - virtual
    a, b = v["valvula_a_agua"]
    r["Agua − f(válvula)"] = f["YJJWSLL"] - (a * f["TV_8329ZC"] + b)
    return r


def verificar(minutos: list[dict[str, float]], retorno_confirmado: bool = True) -> dict:
    """z robusto de cada chequeo en cada minuto y alarma si el último tramo fuera de umbral dura la persistencia.

    retorno_confirmado: usar el centro del aire de retorno después de la redistribución confirmada del 30/03.
    """
    v = artefactos()["verificacion"]
    centro = dict(v["centro"])
    if retorno_confirmado:
        centro["Retorno izq. − der."] = v["centro_confirmado_retorno"]
    zs = []
    for f in minutos:
        r = _residuos(f, v)
        zs.append({c: (r[c] - centro[c]) / v["escala"][c] for c in centro})
    persist = v["persistencia_min"]
    chequeos, en_alarma = {}, []
    for c in centro:
        fuera = [abs(z[c]) > v["umbrales_z"][c] for z in zs]
        seguidos = 0
        for x in reversed(fuera):
            if not x:
                break
            seguidos += 1
        alarma = seguidos >= persist
        chequeos[c] = {"z": _num(zs[-1][c], 2), "umbral_z": v["umbrales_z"][c], "fuera_de_umbral": fuera[-1],
                       "minutos_seguidos_fuera": seguidos, "alarma": alarma,
                       "falla_minima_detectable": _num(v["escala"][c] * v["umbrales_z"][c], 3)}
        if alarma:
            en_alarma.append(c)
    presiones = [c for c in en_alarma if c.startswith("PT_8313")]
    if len(presiones) >= 2 and len(presiones) == len(en_alarma):
        diagnostico = "proceso: varias presiones de hogar a la vez (evento del hogar, no sensores dañados)"
    elif en_alarma:
        diagnostico = "sensor: " + ", ".join(en_alarma)
    else:
        diagnostico = "sin falla de sensor"
    return {"diagnostico": diagnostico, "chequeos_en_alarma": en_alarma, "minutos_evaluados": len(minutos),
            "persistencia_min": persist, "retorno_confirmado": retorno_confirmado, "chequeos": chequeos,
            "aviso": "Un sensor se separa de sus pares; un problema del equipo mueve variables acopladas y los pares "
                     "coinciden. Las fallas de proceso las detecta el monitor PCA del notebook 09, que no está en la API."}
