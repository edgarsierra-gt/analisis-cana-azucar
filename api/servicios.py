"""
Serie IV · lógica de la API de campo (Serie I), sin FastAPI: funciones puras sobre los artefactos JSON.

La API no re-entrena nada ni necesita los datasets. Al arrancar lee los JSON que dejaron los notebooks:
    outputs/models/serie1_curvas.json      pregunta 1: curvas por variedad y supuestos económicos
    outputs/models/serie1_modelo_p2.json   pregunta 2: modelo de azúcar por acre (Ridge en dos piezas)
    outputs/models/serie1_segmentos.json   pregunta 3: medias, desvíos y centros de los 5 grupos
y usa los mismos módulos de `src/` que los notebooks, así que reproduce sus cifras.
"""
from __future__ import annotations

import json
import math
import os
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from campo_economia import Supuestos, best_cycle, clone_curve, cycle_economics  # noqa: E402
from campo_renovacion import (ACRE_HA, SupuestosMetricos, auditar, curva_metrica, margen_ciclo,  # noqa: E402
                              reconstruir_ciclos, regla_lote, resumen_lotes, resumir_ciclos)

MODELOS = Path(os.environ.get("CAMPO_MODELOS", ROOT / "outputs" / "models"))
NUEVA = "nueva"                    # finca sin historia (escenario 2 de la pregunta 2)
LB_ACRE_A_T_HA = 0.00112085        # lb de azúcar por acre -> t de azúcar por hectárea


class ErrorEntrada(ValueError):
    """Entrada válida en forma pero imposible de responder (p. ej. variedad sin datos). La API la devuelve como 422."""


@lru_cache
def artefactos() -> dict:
    """Lee los tres JSON una sola vez por proceso."""
    leer = lambda n: json.loads((MODELOS / n).read_text(encoding="utf-8"))
    curvas, p2, seg = leer("serie1_curvas.json"), leer("serie1_modelo_p2.json"), leer("serie1_segmentos.json")
    curva = pd.DataFrame(curvas["curva_testigos"]).set_index("corte")
    params = pd.DataFrame(curvas["variedades"]).T
    return {"curvas": curvas, "curva": curva, "params": params, "p2": p2, "seg": seg}


def _num(x: float, d: int = 4) -> float | None:
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), d)


# ----------------------------------------------------------------------------- catálogo
def catalogo() -> dict:
    """Variedades y fincas que acepta cada endpoint."""
    a = artefactos()
    return {"variedades_ciclo": sorted(a["params"].index), "variedades_pronostico": sorted(a["p2"]["variedades"]),
            "fincas_pronostico": sorted(a["p2"]["fincas_loc_rel"]) + [NUEVA],
            "testigos_nucleo": a["curvas"]["testigos_nucleo"], "grupos": list(a["seg"]["centros_z"]),
            "supuestos_por_defecto": a["curvas"]["supuestos"]}


# ----------------------------------------------------------------------------- pregunta 1: ciclo y economía
def _curva_variedad(variedad: str | None, extrapolar: bool) -> pd.DataFrame:
    a = artefactos()
    if variedad is None:                                  # testigo núcleo promedio
        return clone_curve(a["curva"])
    p = a["params"].loc[variedad]
    ultimo = None if extrapolar else int(p["ultimo_corte_medido"])
    return clone_curve(a["curva"], float(p["a"]), float(p["b"]), float(p["trs_rel"]), ultimo)


def _precio_equilibrio(cc: pd.DataFrame, s: Supuestos, lo: float = 0.02, hi: float = 0.60) -> float:
    """Precio mínimo (US$/lb) con el que el mejor ciclo tiene margen ≥ 0 (bisección, como campo_economia)."""
    f = lambda precio: best_cycle(cc, Supuestos(precio, s.corte, s.mantenimiento, s.renovacion, s.barbecho))[1]
    if f(hi) < 0:
        return float("nan")
    for _ in range(50):
        mid = (lo + hi) / 2
        lo, hi = (lo, mid) if f(mid) >= 0 else (mid, hi)
    return hi


def ciclo(variedad: str, s: Supuestos, extrapolar: bool = False) -> dict:
    """Ciclo óptimo de renovación, margen y precio de equilibrio de una variedad, con los supuestos dados."""
    a = artefactos()
    if variedad not in a["params"].index:
        raise ErrorEntrada(f"'{variedad}' no está entre las 23 variedades con evidencia suficiente (ver /campo/variedades).")
    cc = _curva_variedad(variedad, extrapolar)
    n, v = best_cycle(cc, s)
    n_ref, v_ref = best_cycle(_curva_variedad(None, False), s)
    eco = cycle_economics(cc, s)
    p = a["params"].loc[variedad]
    return {
        "variedad": variedad,
        "ciclo_optimo_cortes": n,
        "margen_anual_usd_acre": _num(v, 2), "margen_anual_usd_ha": _num(v / ACRE_HA, 2),
        "ganancia_vs_testigos_usd_acre": _num(v - v_ref, 2),
        "testigo_promedio": {"ciclo_optimo_cortes": n_ref, "margen_anual_usd_acre": _num(v_ref, 2)},
        "precio_equilibrio_usd_lb": _num(_precio_equilibrio(cc, s), 4),
        "margen_por_ciclo": [{"cortes": int(r.cortes), "margen_anual_usd_acre": _num(r.margen_anual_promedio, 2)}
                             for r in eco.itertuples()],
        "curva": [{"corte": int(k), "azucar_lb_acre": _num(r.sugar, 1), "cana_t_acre": _num(r.tca, 2), "trs_lb_t": _num(r.trs, 1)}
                  for k, r in cc.iterrows()],
        "evidencia": {"anios": int(p["anios"]), "ensayos": int(p["ensayos"]), "ultimo_corte_medido": int(p["ultimo_corte_medido"]),
                      "es_testigo": bool(p["testigo"]), "ventaja_extrapolada": extrapolar},
        "certeza_con_supuestos_base": {"P_top3": _num(p["P_top3"], 3), "ganancia_ic90_usd_acre": [_num(p["ganancia_p05"], 1), _num(p["ganancia_p95"], 1)]},
        "supuestos": s.__dict__,
    }


def ranking(s: Supuestos) -> dict:
    """Las 23 variedades ordenadas por margen anual en su ciclo óptimo (pregunta 1)."""
    a = artefactos()
    n_ref, v_ref = best_cycle(_curva_variedad(None, False), s)
    filas = []
    for c, p in a["params"].iterrows():
        n, v = best_cycle(_curva_variedad(c, False), s)
        filas.append({"variedad": c, "ciclo_optimo_cortes": n, "margen_anual_usd_acre": _num(v, 2),
                      "ganancia_vs_testigos_usd_acre": _num(v - v_ref, 2), "es_testigo": bool(p["testigo"]),
                      "P_top3": _num(p["P_top3"], 3), "ganancia_ic90_usd_acre": [_num(p["ganancia_p05"], 1), _num(p["ganancia_p95"], 1)]})
    filas.sort(key=lambda f: -f["margen_anual_usd_acre"])
    for i, f in enumerate(filas, 1):
        f["puesto"] = i
    return {"supuestos": s.__dict__, "testigo_promedio": {"ciclo_optimo_cortes": n_ref, "margen_anual_usd_acre": _num(v_ref, 2)},
            "variedades": filas}


# ----------------------------------------------------------------------------- pregunta 2: pronóstico
def pronostico(variedad: str, finca: str, corte: int, ventaja_lote_anterior: float | None = None) -> dict:
    """Azúcar por acre esperado para la siguiente zafra (igual que `predict` del HTML y `predecir_json` del notebook 03).

    log(azúcar) = base del corte + efecto de la finca + constante + coef·ventaja histórica de la variedad
                  [+ coef·log(ventaja del mismo lote el año pasado) + coef·1 si se conoce el lote]
    """
    mp = artefactos()["p2"]
    v = mp["variedades"].get(variedad)
    if v is None:
        raise ErrorEntrada(f"'{variedad}' no tiene historia en etapa 5. Una variedad nueva es el escenario 3, "
                           "que no está implementado (ver README).")
    nueva = finca == NUEVA
    if not nueva and finca not in mp["fincas_loc_rel"]:
        raise ErrorEntrada(f"Finca '{finca}' desconocida. Use una de /campo/variedades o '{NUEVA}' si no tiene historia.")
    e = mp["escenario_2" if nueva else "escenario_1"]
    var_rel = v["a"] + v["b"] * min(corte, v["kmax"])
    base = mp["base_corte_log"][str(corte)]
    finca_rel = 0.0 if nueva else mp["fincas_loc_rel"][finca]
    rel_var = e["constante"] + e["coef"]["var_rel"] * var_rel
    usa_lote = (not nueva) and ventaja_lote_anterior is not None
    rel_lote = e["coef"]["lote_ant_rel"] * math.log(ventaja_lote_anterior) + e["coef"]["tiene_lote_ant"] if usa_lote else 0.0
    p = math.exp(base + finca_rel + rel_var + rel_lote)
    lo, hi = (p * math.exp(x) for x in e["banda80_log"])
    return {
        "variedad": variedad, "finca": finca, "corte": corte,
        "escenario": 2 if nueva else 1,
        "azucar_lb_acre": _num(p, 1), "banda_lb_acre": [_num(lo, 1), _num(hi, 1)],
        "azucar_t_ha": _num(p * LB_ACRE_A_T_HA, 3), "banda_t_ha": [_num(lo * LB_ACRE_A_T_HA, 3), _num(hi * LB_ACRE_A_T_HA, 3)],
        "cobertura_real_banda": _num(mp["validacion"]["cobertura_banda80"]["Escenario 2" if nueva else "Escenario 1"], 3),
        "desglose_log": {"base_del_corte": _num(base), "efecto_finca": _num(finca_rel), "ventaja_variedad": _num(rel_var),
                         "ventaja_lote_anterior": _num(rel_lote)},
        "uso_lote_anterior": usa_lote,
        "aviso": "Modelo entrenado con ensayos de Louisiana (2011-2021): orienta el orden de variedades; el nivel absoluto "
                 "depende del clima y el manejo de la zafra.",
    }


# ----------------------------------------------------------------------------- pregunta 3: segmento
def segmento(cana_pct: float, trs_pct: float, longevidad_pct: float, sigma_pct: float) -> dict:
    """Grupo de una variedad por sus 4 indicadores (en % contra los testigos núcleo, como la tabla del notebook 04).

    Se pasan a logaritmo, se estandarizan con la media y el desvío del JSON y se asignan al centro más cercano.
    """
    seg = artefactos()["seg"]
    x = {"productividad": math.log1p(cana_pct / 100), "calidad": math.log1p(trs_pct / 100),
         "longevidad": math.log1p(longevidad_pct / 100), "estabilidad": -sigma_pct / 100}
    z = {k: (x[k] - seg["media"][k]) / seg["desvio"][k] for k in seg["indicadores"]}
    dist = {g: math.sqrt(sum((z[k] - c[k]) ** 2 for k in seg["indicadores"])) for g, c in seg["centros_z"].items()}
    orden = sorted(dist, key=dist.get)
    return {"grupo": orden[0], "segundo_grupo": orden[1],
            "distancias": {g: _num(dist[g], 3) for g in orden},
            "indicadores_estandarizados": {k: _num(v, 3) for k, v in z.items()},
            "estabilidad_del_grupo_jaccard": _num(seg["jaccard"][orden[0]], 3),
            "aviso": "No hay grupos naturales (notebook 04): si la distancia al segundo grupo es parecida, decida con la "
                     "economía de la pregunta 1 y no con la etiqueta."}


# ----------------------------------------------------------------------------- pregunta 4: auditoría
def auditoria(cosechas: pd.DataFrame, tolerancia: int = 1) -> dict:
    """Ciclos de cada lote contra el óptimo económico, diagnóstico por lote y decisión para los ciclos abiertos.

    cosechas: una fila por lote y corte con zafra, finca, lote, variedad, corte (opcional), tch y rendimiento (opcional).
    """
    s = SupuestosMetricos()
    curva = curva_metrica(artefactos()["curvas"]["curva_testigos"])
    _, prom = margen_ciclo(curva["tch"].to_numpy(), curva["rend"].to_numpy(), s)
    optimo = int(np.argmax(prom)) + 1
    cos = cosechas.copy()
    if "corte" in cos and cos["corte"].isna().all():
        cos = cos.drop(columns="corte")
    if "rendimiento" in cos and cos["rendimiento"].isna().all():
        cos = cos.drop(columns="rendimiento")
    cic = reconstruir_ciclos(cos)
    aud = auditar(resumir_ciclos(cic), optimo, tolerancia)
    lotes = resumen_lotes(aud, int(cos["zafra"].min())).reset_index()
    regla = regla_lote(cic, curva, s).round(2)
    limpiar = lambda d: json.loads(d.to_json(orient="records", force_ascii=False))
    return {
        "optimo_cortes": optimo, "tolerancia": tolerancia, "corte_registrado": "corte" in cos,
        "resumen": {"lotes": int(cos.groupby(["finca", "lote"]).ngroups), "registros": len(cos), "ciclos": len(aud),
                    "ciclos_cerrados": int(aud["cerrado"].sum()), "estados": aud["estado"].value_counts().to_dict()},
        "ciclos": limpiar(aud[["finca", "lote", "ciclo", "variedad", "zafra_inicio", "zafra_fin", "cortes_ciclo",
                               "inicio_observado", "cerrado", "optimo", "estado"]]),
        "lotes": limpiar(lotes),
        "decisiones": limpiar(regla),
    }
