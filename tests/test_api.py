"""Serie IV · pruebas de la API: reproduce las cifras de control de la Serie I y valida las entradas.

Uso:  pytest tests/test_api.py      (no necesita los datasets: usa los JSON y CSV de outputs/)
"""
import io
import json
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.main import app
from campo_renovacion import (auditar, curva_metrica, reconstruir_ciclos, resumir_ciclos, simular_portafolio)

ROOT = Path(__file__).resolve().parents[1]
TAB = ROOT / "outputs" / "tables"
cliente = TestClient(app)


def post(ruta, **cuerpo):
    r = cliente.post(ruta, json=cuerpo)
    assert r.status_code == 200, r.text
    return r.json()


# ----------------------------------------------------------------------------- general
def test_salud():
    assert cliente.get("/salud").json() == {"estado": "ok", "version": "1.1.0", "variedades_ciclo": 23,
                                            "variedades_pronostico": 40, "grupos": 5}


def test_openapi_documenta_los_endpoints():
    rutas = cliente.get("/openapi.json").json()["paths"]
    for r in ["/campo/variedades", "/campo/ciclo", "/campo/pronostico", "/campo/segmento", "/campo/auditoria",
              "/campo/auditoria/csv"]:
        assert r in rutas


# ----------------------------------------------------------------------------- pregunta 1
REC = pd.read_csv(TAB / "serie1_recomendacion.csv", index_col=0)


def test_p1_margen_de_referencia():
    """Testigo núcleo promedio con los supuestos de la prueba: 4 cortes y US$526.3/acre/año (notebooks 02 y 05)."""
    ref = cliente.get("/campo/variedades").json()["testigo_promedio"]
    assert ref["ciclo_optimo_cortes"] == 4 and round(ref["margen_anual_usd_acre"], 1) == 526.3


@pytest.mark.parametrize("variedad", REC.index.tolist())
def test_p1_cada_variedad_reproduce_el_notebook(variedad):
    r = post("/campo/ciclo", variedad=variedad)
    fila = REC.loc[variedad]
    assert r["ciclo_optimo_cortes"] == fila["ciclo_optimo"]
    assert r["margen_anual_usd_acre"] == pytest.approx(fila["margen_anual"], abs=0.01)
    assert r["ganancia_vs_testigos_usd_acre"] == pytest.approx(fila["ganancia_vs_testigos"], abs=0.01)
    assert r["precio_equilibrio_usd_lb"] == pytest.approx(fila["precio_equilibrio"], abs=1e-4)


def test_p1_ranking_top3():
    top = [v["variedad"] for v in cliente.get("/campo/variedades").json()["variedades"][:3]]
    assert top == ["HOCP14-885", "HOL15-508", "L15-306"]


def test_p1_precio_cambia_cuanto_se_gana_no_cual_variedad():
    """Notebook 02 (D20): con precio de US$0.10 a 0.30/lb las mismas tres variedades encabezan."""
    for precio in [0.10, 0.30]:
        top = [v["variedad"] for v in cliente.get(f"/campo/variedades?precio={precio}").json()["variedades"][:3]]
        assert set(top) == {"HOCP14-885", "HOL15-508", "L15-306"}


def test_p1_barbecho_y_extrapolacion():
    """D17 y D18: HOL15-508 pasa de 4 a 5 cortes con barbecho o con extrapolación; HOCP14-885 se queda en 4."""
    assert post("/campo/ciclo", variedad="HOL15-508", barbecho=1)["ciclo_optimo_cortes"] == 5
    assert post("/campo/ciclo", variedad="HOL15-508", extrapolar=True)["ciclo_optimo_cortes"] == 5
    assert post("/campo/ciclo", variedad="HOCP14-885", barbecho=1)["ciclo_optimo_cortes"] == 4


# ----------------------------------------------------------------------------- pregunta 2
def test_p2_reproduce_las_509_predicciones_2022():
    """467 lotes en pie + 42 plantías (14 fincas × 3 variedades) del notebook 03; las tablas están redondeadas."""
    lotes = pd.read_csv(TAB / "serie1_pronostico_2022_lotes.csv")
    pl = pd.read_csv(TAB / "serie1_pronostico_2022_plantia.csv", index_col=0)
    sin_dato = lambda x: None if pd.isna(x) else float(x)          # lote sin ventaja medida el año pasado
    dif = [abs(post("/campo/pronostico", variedad=r.CLONE, finca=r.LOC, corte=int(r.corte_2022),
                    ventaja_lote_anterior=sin_dato(r.ventaja_2021))["azucar_lb_acre"] - r.pred) for r in lotes.itertuples()]
    dif += [abs(post("/campo/pronostico", variedad=v, finca=loc, corte=0)["azucar_lb_acre"] - pl.loc[loc, v])
            for loc in pl.index for v in ["HOCP14-885", "HOL15-508", "L15-306"]]
    assert len(dif) == 509
    assert max(dif) <= 1.0


def test_p2_finca_nueva_usa_escenario_2():
    r = post("/campo/pronostico", variedad="HOL15-508", finca="nueva", corte=1, ventaja_lote_anterior=1.2)
    assert r["escenario"] == 2 and r["desglose_log"]["efecto_finca"] == 0 and not r["uso_lote_anterior"]
    assert r["banda_lb_acre"][0] < r["azucar_lb_acre"] < r["banda_lb_acre"][1]


# ----------------------------------------------------------------------------- pregunta 3
def test_p3_reproduce_el_100_por_ciento_de_las_asignaciones():
    seg = pd.read_csv(TAB / "serie1_segmentos.csv", index_col=0)
    for v, f in seg.iterrows():
        r = post("/campo/segmento", cana_vs_testigos_pct=f["caña vs testigos %"], trs_vs_testigos_pct=f["TRS vs testigos %"],
                 cana_por_corte_vs_testigos_pct=f["caña por corte vs testigos %"],
                 sigma_interaccion_pct=f["σ interacción %"])
        assert r["grupo"] == f["grupo"], v


# ----------------------------------------------------------------------------- pregunta 4
@pytest.fixture(scope="module")
def portafolio():
    curvas = json.loads((ROOT / "outputs" / "models" / "serie1_curvas.json").read_text(encoding="utf-8"))
    return simular_portafolio(curva_metrica(curvas["curva_testigos"]), semilla=20261019)


def test_p4_auditoria_api_igual_a_pandas_y_1143_ciclos(portafolio):
    """La API clasifica igual que el notebook 05: 1,143 de 1,143 ciclos cerrados según la política simulada."""
    cos, verdad = portafolio
    r = post("/campo/auditoria", cosechas=cos.to_dict("records"))
    assert r["optimo_cortes"] == 4
    api = pd.DataFrame(r["ciclos"])
    local = auditar(resumir_ciclos(reconstruir_ciclos(cos)), 4)
    assert api["estado"].tolist() == local["estado"].tolist()
    cerr = api[api["cerrado"]].merge(verdad, on=["finca", "lote"])
    esperado = cerr["politica"].map({"temprana": "renovación temprana", "a tiempo": "renovación a tiempo",
                                     "tardía": "renovación tardía"})
    assert len(cerr) == 1143 and (cerr["estado"] == esperado).sum() == 1143


def test_p4_csv_igual_a_json(portafolio):
    cos = portafolio[0].query("finca in ['F00', 'F01', 'F02']")
    buf = io.BytesIO(cos.to_csv(index=False).encode("utf-8"))
    r_csv = cliente.post("/campo/auditoria/csv", files={"archivo": ("cosechas.csv", buf, "text/csv")})
    assert r_csv.status_code == 200, r_csv.text
    assert r_csv.json() == post("/campo/auditoria", cosechas=cos.to_dict("records"))


def test_p4_sin_numero_de_corte_pierde_renovaciones(portafolio):
    """Notebook 05: sin la columna de corte se detectan 856 de 1,143 renovaciones."""
    cos = portafolio[0].drop(columns="corte")
    r = post("/campo/auditoria", cosechas=cos.to_dict("records"))
    assert not r["corte_registrado"] and r["resumen"]["ciclos_cerrados"] == 856


# ----------------------------------------------------------------------------- ejemplos de docs/api.md
def test_ejemplos_de_la_documentacion():
    """Las cifras que muestra docs/api.md salen de la API."""
    r = post("/campo/ciclo", variedad="HOCP14-885", precio=0.15)
    assert (r["ciclo_optimo_cortes"], r["margen_anual_usd_acre"], r["ganancia_vs_testigos_usd_acre"]) == (4, 331.4, 190.4)
    assert r["testigo_promedio"] == {"ciclo_optimo_cortes": 5, "margen_anual_usd_acre": 141.01}
    r = post("/campo/pronostico", variedad="L01-299", finca="MAGNOLIA", corte=2, ventaja_lote_anterior=1.05)
    assert (r["azucar_lb_acre"], r["banda_lb_acre"]) == (6092.1, [4299.6, 8047.0])
    r = post("/campo/segmento", cana_vs_testigos_pct=9.9, trs_vs_testigos_pct=7.5, cana_por_corte_vs_testigos_pct=1.7,
             sigma_interaccion_pct=8.5)
    assert (r["grupo"], r["segundo_grupo"]) == ("Completas: caña, calidad y longevidad", "Sin ventaja clara")
    filas = [(2016, "CG02-163", 0, 125.0), (2017, "CG02-163", 1, 112.0), (2018, "CP72-2086", 0, 130.0),
             (2019, "CP72-2086", 1, 118.0), (2020, "CP72-2086", 2, 105.0), (2021, "CP72-2086", 3, 96.0)]
    r = post("/campo/auditoria", cosechas=[{"zafra": z, "finca": "F01", "lote": "F01-L1", "variedad": v, "corte": k, "tch": t}
                                           for z, v, k, t in filas])
    assert [c["estado"] for c in r["ciclos"]] == ["renovación temprana", "renovar al cerrar la zafra"]
    assert r["decisiones"][0]["decision"] == "renovar" and r["decisiones"][0]["tch_esperado"] == 87.21


# ----------------------------------------------------------------------------- validación de entradas
@pytest.mark.parametrize("ruta, cuerpo", [
    ("/campo/ciclo", {"variedad": "NO-EXISTE"}),
    ("/campo/ciclo", {"variedad": "HOCP14-885", "precio": -0.2}),
    ("/campo/ciclo", {"variedad": "HOCP14-885", "barbecho": 5}),
    ("/campo/pronostico", {"variedad": "HOCP14-885", "finca": "RHEBERT", "corte": 7}),
    ("/campo/pronostico", {"variedad": "HOCP14-885", "finca": "NO-EXISTE", "corte": 0}),
    ("/campo/pronostico", {"variedad": "VARIEDAD-NUEVA", "finca": "RHEBERT", "corte": 0}),
    ("/campo/pronostico", {"variedad": "HOCP14-885", "finca": "RHEBERT", "corte": 1, "ventaja_lote_anterior": 0}),
    ("/campo/segmento", {"cana_vs_testigos_pct": 5, "trs_vs_testigos_pct": 2, "cana_por_corte_vs_testigos_pct": 1}),
    ("/campo/auditoria", {"cosechas": []}),
    ("/campo/auditoria", {"cosechas": [{"zafra": 2020, "finca": "F", "lote": "L", "variedad": "V", "tch": -5}]}),
])
def test_entradas_invalidas_devuelven_422(ruta, cuerpo):
    r = cliente.post(ruta, json=cuerpo)
    assert r.status_code == 422
    assert r.json()["detail"]


def test_csv_sin_columnas_devuelve_422():
    buf = io.BytesIO(b"zafra,finca,lote\n2020,F,L\n")
    r = cliente.post("/campo/auditoria/csv", files={"archivo": ("x.csv", buf, "text/csv")})
    assert r.status_code == 422 and "Faltan columnas" in r.json()["detail"]
