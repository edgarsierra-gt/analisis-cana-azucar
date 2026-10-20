"""
Serie IV · lógica de la API del mercado (Serie III): pronóstico del precio del azúcar No. 11 a 1 y 3 meses.

Lee `outputs/models/serie3_pronostico.json` (notebook 12). Centro = último cierre; banda = cuantiles de los errores
pasados medidos en unidades de la volatilidad de 3 meses × √h, aplicados en logaritmo:
    precio = exp(log(último cierre) + z · vol_3m · √h)
Es el pronóstico con los datos de la prueba (último cierre del 31/05/2024); para actualizarlo hay que volver a correr
el notebook 12 con datos nuevos.
"""
from __future__ import annotations

import json
import math
from datetime import date
from functools import lru_cache

from api.servicios import MODELOS

USD_T_POR_CENTAVO_LB = 2204.62 / 100      # 1 ¢/lb = US$22.05 por tonelada métrica
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre"]


@lru_cache
def artefacto() -> dict:
    return json.loads((MODELOS / "serie3_pronostico.json").read_text(encoding="utf-8"))


def pronostico(h: int, toneladas: float | None = None) -> dict:
    """Centro y bandas de 80 % y 95 % para el promedio del mes h (1 o 3) después del último cierre."""
    m = artefacto()
    q = m["cuantiles_z"][str(h)]
    centro = m["ultimo_cierre"]
    esc = m["vol_3m_mensual"] * math.sqrt(h)
    precio = {k: centro * math.exp(z * esc) for k, z in q.items()}
    origen = date.fromisoformat(m["fecha_origen"])
    k = origen.month - 1 + h
    objetivo = f"{MESES[k % 12]} {origen.year + k // 12}"
    bandas = {"80": ("p10", "p90"), "95": ("p2.5", "p97.5")}
    out = {
        "horizonte_meses": h, "mes_objetivo": objetivo, "fecha_ultimo_cierre": m["fecha_origen"],
        "centro_centavos_lb": round(centro, 2),
        "bandas_centavos_lb": {n: [round(precio[a], 2), round(precio[b], 2)] for n, (a, b) in bandas.items()},
        "bandas_pct": {n: [round(100 * (precio[a] / centro - 1), 1), round(100 * (precio[b] / centro - 1), 1)]
                       for n, (a, b) in bandas.items()},
        "centro_usd_t": round(centro * USD_T_POR_CENTAVO_LB, 1),
        "bandas_usd_t": {n: [round(precio[a] * USD_T_POR_CENTAVO_LB, 1), round(precio[b] * USD_T_POR_CENTAVO_LB, 1)]
                         for n, (a, b) in bandas.items()},
        "volatilidad_3m_mensual_pct": round(100 * m["vol_3m_mensual"], 2),
        "aviso": "Ningún modelo probado le gana al último cierre (notebook 12): el valor está en el rango. Precio No. 11 "
                 "sin primas, flete ni tipo de cambio.",
    }
    if toneladas is not None:
        usd = lambda c: round(c * USD_T_POR_CENTAVO_LB * toneladas)
        out["ingreso_usd"] = {"toneladas": toneladas, "centro": usd(centro),
                              "80": [usd(precio["p10"]), usd(precio["p90"])], "95": [usd(precio["p2.5"]), usd(precio["p97.5"])]}
    return out
