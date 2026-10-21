"""Serie IV · pruebas de la API de la caldera (Serie II) y del mercado (Serie III).

Usan las muestras que exportan los notebooks 07 y 08 (`outputs/tables/serie2_muestra_api_*.csv`) y el resumen del
notebook 12, así que no necesitan los datasets.
"""
import json
import math
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.main import VERSION, app
from fabrica_anomalias import puntajes_verificacion, residuos_verificacion

ROOT = Path(__file__).resolve().parents[1]
TAB, MOD = ROOT / "outputs" / "tables", ROOT / "outputs" / "models"
cliente = TestClient(app)
VAPOR = pd.read_csv(TAB / "serie2_muestra_api_vapor.csv", index_col=0)
ENTRADA_VAPOR = ["PTCA_8322A", "PTCA_8324", "TE_8313B", "TE_8303", "TE_8304", "TV_8329ZC", "FT_8301", "FT_8302", "YFJ3_AI",
                 "YFJ3_ZD1", "SXLTCYY", "YJJWSLL", "TE_8332A", "presion_hogar", "lecho", "o2", "t_gases", "retorno_total"]
ENTRADA_VERIF = [f"PT_8313{x}" for x in "ABCDEF"] + ["AIR_8301A", "AIR_8301B", "ZCLCCY", "YCLCCY", "TE_8319A", "TE_8319B",
                                                     "FT_8306A", "FT_8306B", "ZZQBCHLL", "YJJWSLL", "TV_8329ZC",
                                                     "PTCA_8322A", "PTCA_8324", "TE_8332A"]


def post(ruta, cuerpo):
    r = cliente.post(ruta, json=cuerpo)
    assert r.status_code == 200, r.text
    return r.json()


def minutos(desde, hasta, columnas):
    return VAPOR.iloc[desde:hasta][columnas].to_dict("records")


# ----------------------------------------------------------------------------- general
def test_salud_y_openapi():
    assert cliente.get("/salud").json()["version"] == VERSION
    rutas = cliente.get("/openapi.json").json()["paths"]
    for r in ["/caldera/sensores", "/caldera/modo", "/caldera/vapor-virtual", "/caldera/verificar", "/mercado/pronostico"]:
        assert r in rutas


# ----------------------------------------------------------------------------- caldera · sensores y modo
def test_sensores_diccionario_corregido():
    r = cliente.get("/caldera/sensores").json()
    assert len(r["sensores"]) == 30
    assert set(r["excluidos_de_modelos"]) == {"SXLTCYZ", "YFJ3_ZD2"}
    assert r["sensores"]["TV_8329ZC"]["unidad"] == "%"          # el diccionario original la describía como temperatura


def test_modo_reproduce_el_100_por_ciento_de_las_ventanas():
    """Notebook 07: el JSON reproduce el 100 % de las 1,441 asignaciones de 5 min."""
    m = pd.read_csv(TAB / "serie2_muestra_api_modos.csv", index_col=0)
    variables = [c for c in m.columns if c != "modo"]
    asignado = [post("/caldera/modo", fila)["modo"] for fila in m[variables].to_dict("records")]
    assert len(asignado) == 1441
    assert (pd.Series(asignado, index=m.index) == m["modo"]).all()


# ----------------------------------------------------------------------------- caldera · sensor virtual
def test_vapor_virtual_reproduce_el_ridge_final():
    """Notebook 08: con 10 minutos de historia, la API da lo mismo que el Ridge final (la salida se redondea a 0.01)."""
    dif = []
    for i in range(9, len(VAPOR)):
        r = post("/caldera/vapor-virtual", {"minutos": minutos(i - 9, i + 1, ENTRADA_VAPOR)})
        dif.append(abs(r["vapor_t_h"] - VAPOR["pred_ridge"].iloc[i]))
    assert len(dif) == 171 and max(dif) <= 0.006


def test_vapor_virtual_compara_con_el_medido_y_usa_solo_los_ultimos_10():
    filas = minutos(0, 30, ENTRADA_VAPOR + ["ZZQBCHLL"])
    r = post("/caldera/vapor-virtual", {"minutos": filas})
    assert r["vapor_t_h"] == post("/caldera/vapor-virtual", {"minutos": filas[-10:]})["vapor_t_h"]
    assert r["medido_menos_estimado_t_h"] == pytest.approx(r["vapor_medido_t_h"] - r["vapor_t_h"], abs=0.011)
    assert r["banda_90_t_h"][0] < r["vapor_t_h"] < r["banda_90_t_h"][1]
    assert abs(r["otras_estimaciones"]["formula_dos_variables"] - r["vapor_t_h"]) < 2   # las tres estimaciones coinciden


# ----------------------------------------------------------------------------- caldera · verificación
def _z_esperado():
    """z de cada chequeo calculado con src/fabrica_anomalias (el código del notebook 09) sobre la muestra."""
    v = json.loads((MOD / "serie2_verificacion.json").read_text(encoding="utf-8"))
    vd = v["virtual_dos_variables"]
    virtual = vd["a"] + vd["b"] * VAPOR["raiz_dp_rho"] + vd["c"] * VAPOR["YJJWSLL"]
    R = residuos_verificacion(VAPOR, virtual)
    refp = {"centro": pd.Series(v["centro"]), "escala": pd.Series(v["escala"]), "valvula": tuple(v["valvula_a_agua"])}
    Z = puntajes_verificacion(R, VAPOR, refp)
    c = "Retorno izq. − der."                        # la muestra es del 01/04, después de la redistribución confirmada
    Z[c] = (R[c] - v["centro_confirmado_retorno"]) / v["escala"][c]
    return Z


def test_verificar_coincide_con_el_codigo_del_notebook_09():
    Z = _z_esperado()
    filas = minutos(0, len(VAPOR), ENTRADA_VERIF)
    peor = 0.0
    for i, f in enumerate(filas):
        r = post("/caldera/verificar", {"minutos": [f]})
        peor = max(peor, max(abs(ch["z"] - Z[c].iloc[i]) for c, ch in r["chequeos"].items()))
    assert peor <= 0.01                                  # z se redondea a 0.01


def test_verificar_operacion_normal_no_alarma():
    r = post("/caldera/verificar", {"minutos": minutos(100, 130, ENTRADA_VERIF)})
    assert r["diagnostico"] == "sin falla de sensor" and r["chequeos_en_alarma"] == []


def _con_falla(n_min, sensores, magnitud):
    filas = minutos(100, 100 + n_min, ENTRADA_VERIF)
    for f in filas:
        for s in sensores:
            f[s] += magnitud
    return filas


def test_verificar_sensor_con_falla_persistente():
    """Una presión de hogar desplazada 300 Pa: alarma solo después de 5 minutos seguidos (persistencia)."""
    r4 = post("/caldera/verificar", {"minutos": _con_falla(4, ["PT_8313C"], 300)})
    assert r4["chequeos"]["PT_8313C"]["fuera_de_umbral"] and not r4["chequeos"]["PT_8313C"]["alarma"]
    r6 = post("/caldera/verificar", {"minutos": _con_falla(6, ["PT_8313C"], 300)})
    assert r6["chequeos_en_alarma"] == ["PT_8313C"] and r6["diagnostico"] == "sensor: PT_8313C"


def test_verificar_varias_presiones_es_evento_del_hogar():
    """Tres presiones de una misma familia desplazadas juntas: no son tres sensores dañados (criterio del notebook 09)."""
    r = post("/caldera/verificar", {"minutos": _con_falla(6, ["PT_8313D", "PT_8313E", "PT_8313F"], 300)})
    assert len(r["chequeos_en_alarma"]) >= 2 and r["diagnostico"].startswith("proceso")


def test_verificar_deriva_del_medidor_de_vapor():
    """El medidor de vapor 3 t/h arriba de lo que dice la física: lo señala el chequeo medido − virtual."""
    r = post("/caldera/verificar", {"minutos": _con_falla(6, ["ZZQBCHLL"], 3.0)})
    assert r["chequeos_en_alarma"] == ["Vapor medido − virtual"]


# ----------------------------------------------------------------------------- mercado
@pytest.mark.parametrize("h, mes", [(1, "junio 2024"), (3, "agosto 2024")])
def test_pronostico_reproduce_la_banda_del_notebook_12(h, mes):
    """Las bandas vigentes del notebook 12 (cuantiles guardados con 4 decimales; tolerancia 0.02 ¢/lb)."""
    vig = json.loads((TAB / "serie3_resumen_p3.json").read_text(encoding="utf-8"))["vigente"][mes]
    r = cliente.get(f"/mercado/pronostico?h={h}").json()
    assert r["mes_objetivo"] == mes and r["centro_centavos_lb"] == pytest.approx(vig["centro"], abs=0.01)
    lo80, hi80 = r["bandas_centavos_lb"]["80"]
    lo95, hi95 = r["bandas_centavos_lb"]["95"]
    for api_v, nb in [(lo80, vig["p10"]), (hi80, vig["p90"]), (lo95, vig["p2.5"]), (hi95, vig["p97.5"])]:
        assert api_v == pytest.approx(nb, abs=0.02)


def test_pronostico_cifras_del_readme():
    """Notebook 12 (conclusión) y bitácora: banda 80 % de −6 % a +7 % a 1 mes y de −14 % a +17 % a 3 meses; 1 ¢/lb = US$22/t."""
    b1 = cliente.get("/mercado/pronostico?h=1").json()["bandas_pct"]["80"]
    b3 = cliente.get("/mercado/pronostico?h=3").json()["bandas_pct"]["80"]
    entero = lambda x: math.floor(x + 0.5)                 # redondeo convencional (16.5 → 17), como en el texto
    assert [entero(x) for x in b1] == [-6, 7] and [entero(x) for x in b3] == [-14, 17]
    r = cliente.get("/mercado/pronostico?h=1&toneladas=1000").json()
    assert r["centro_usd_t"] == pytest.approx(r["centro_centavos_lb"] * 22.05, abs=0.5)
    assert r["ingreso_usd"]["80"][0] < r["ingreso_usd"]["centro"] < r["ingreso_usd"]["80"][1]


# ----------------------------------------------------------------------------- validación de entradas
def test_entradas_invalidas_devuelven_422():
    pocos = minutos(0, 5, ENTRADA_VAPOR)
    assert cliente.post("/caldera/vapor-virtual", json={"minutos": pocos}).status_code == 422          # menos de 10 min
    falta = minutos(0, 10, ENTRADA_VAPOR); del falta[-1]["o2"]
    assert cliente.post("/caldera/vapor-virtual", json={"minutos": falta}).status_code == 422          # falta una variable
    mal = minutos(0, 10, ENTRADA_VAPOR); mal[-1]["PTCA_8322A"] = 9800                                   # kPa en vez de MPa
    assert cliente.post("/caldera/vapor-virtual", json={"minutos": mal}).status_code == 422
    assert cliente.post("/caldera/verificar", json={"minutos": []}).status_code == 422
    assert cliente.post("/caldera/modo", json={"vapor": 60}).status_code == 422
    for q in ["h=2", "h=6", "h=1&toneladas=-5"]:
        assert cliente.get(f"/mercado/pronostico?{q}").status_code == 422


# ----------------------------------------------------------------------------- ejemplos de docs/api.md
def test_ejemplos_de_la_documentacion():
    """Las cifras de los ejemplos de caldera y mercado en docs/api.md salen de la API."""
    m = pd.read_csv(TAB / "serie2_muestra_api_modos.csv", index_col=0)
    r = post("/caldera/modo", m.drop(columns="modo").iloc[0].round(2).to_dict())
    assert r["modo"] == "Carga media" and r["distancias"]["Carga media"] == 2.091
    r = post("/caldera/vapor-virtual", {"minutos": minutos(len(VAPOR) - 10, len(VAPOR), ENTRADA_VAPOR + ["ZZQBCHLL"])})
    assert (r["vapor_t_h"], r["banda_90_t_h"], r["medido_menos_estimado_t_h"]) == (60.71, [60.35, 61.08], -0.19)
    filas = minutos(100, 106, ENTRADA_VERIF)
    for f in filas:
        f["ZZQBCHLL"] += 3
    r = post("/caldera/verificar", {"minutos": filas})
    assert r["chequeos"]["Vapor medido − virtual"]["z"] == 11.8
    r = cliente.get("/mercado/pronostico?h=3&toneladas=10000").json()
    assert r["ingreso_usd"]["centro"] == 4034454 and r["bandas_usd_t"]["80"] == [346.9, 470.1]
