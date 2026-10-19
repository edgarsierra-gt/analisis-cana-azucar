"""Prueba de punta a punta del esquema de campo (Serie I · P4) contra un PostgreSQL real.

Uso:  CAMPO_PG_DSN="host=... port=... user=... dbname=..." pytest tests/test_esquema_postgres.py
Sin la variable CAMPO_PG_DSN (o sin psycopg) la prueba se omite. Crea un esquema temporal y lo borra al terminar,
así que se puede repetir en la misma base.
"""
import json
import os
import sys
import uuid
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
psycopg = pytest.importorskip("psycopg")
DSN = os.environ.get("CAMPO_PG_DSN")
pytestmark = pytest.mark.skipif(not DSN, reason="definir CAMPO_PG_DSN para correr contra PostgreSQL")

from campo_renovacion import auditar, curva_metrica, reconstruir_ciclos, resumir_ciclos, simular_portafolio  # noqa: E402


@pytest.fixture(scope="module")
def conexion():
    cx = psycopg.connect(DSN, autocommit=True)
    esquema = f"prueba_{uuid.uuid4().hex[:8]}"          # esquema temporal: la prueba se puede repetir en la misma base
    cx.execute(f"CREATE SCHEMA {esquema}")
    cx.execute(f"SET search_path TO {esquema}")
    cx.execute((ROOT / "sql" / "esquema_campo.sql").read_text(encoding="utf-8"))
    yield cx
    cx.execute(f"DROP SCHEMA {esquema} CASCADE")
    cx.close()


@pytest.fixture(scope="module")
def cargado(conexion):
    curvas = json.loads((ROOT / "outputs" / "models" / "serie1_curvas.json").read_text(encoding="utf-8"))
    cos, _ = simular_portafolio(curva_metrica(curvas["curva_testigos"]), n_fincas=12)
    cos = reconstruir_ciclos(cos)
    cur = conexion.cursor()
    for f in cos["finca"].unique():
        cur.execute("INSERT INTO finca (finca_id, nombre, estrato_altitudinal, distancia_ingenio_km) VALUES (%s,%s,'bajo',20)", (f, f))
    for f, l in cos[["finca", "lote"]].drop_duplicates().itertuples(index=False):
        cur.execute("INSERT INTO lote (lote_id, finca_id, area_ha, drenaje) VALUES (%s,%s,10,'bueno')", (l, f))
    ids = {}
    for (l, ci), g in cos.groupby(["lote", "ciclo"]):
        z0 = int(g["zafra"].min()) - int(g["corte"].min())
        cur.execute("INSERT INTO siembra (lote_id, fecha_siembra, variedad, motivo) VALUES (%s,%s,%s,'renovacion') "
                    "RETURNING siembra_id", (l, f"{z0 - 1}-12-01", g["variedad"].iloc[0]))
        ids[(l, ci)] = cur.fetchone()[0]
    with cur.copy("COPY cosecha (lote_id, siembra_id, zafra, fecha_corte, corte, area_cosechada_ha, toneladas_cana, "
                  "rendimiento_kg_t) FROM STDIN") as cp:
        for r in cos.itertuples():
            cp.write_row((r.lote, ids[(r.lote, r.ciclo)], r.zafra, f"{r.zafra + 1}-02-15", r.corte, 10,
                          round(r.tch * 10, 2), round(r.rendimiento, 2)))
    return cos


@pytest.mark.parametrize("sql", [
    "INSERT INTO cosecha (lote_id, siembra_id, zafra, fecha_corte, corte, area_cosechada_ha, toneladas_cana) "
    "SELECT lote_id, siembra_id, zafra, fecha_corte, corte, area_cosechada_ha, toneladas_cana FROM cosecha LIMIT 1",
    "UPDATE cosecha SET rendimiento_kg_t = 520 WHERE cosecha_id = (SELECT min(cosecha_id) FROM cosecha)",
    "UPDATE cosecha SET toneladas_cana = '821,10' WHERE cosecha_id = (SELECT min(cosecha_id) FROM cosecha)",
    "UPDATE finca SET estrato_altitudinal = 'costa' WHERE finca_id = 'F00'",
], ids=["doble_captura", "rendimiento_imposible", "coma_decimal", "estrato_invalido"])
def test_reglas_rechazan_errores(conexion, cargado, sql):
    with pytest.raises(psycopg.Error):
        conexion.execute(sql)


def test_vista_reproduce_auditoria(conexion, cargado):
    filas = conexion.execute("SELECT zafra, finca, lote, variedad, corte, tch, rendimiento FROM v_cosecha_ciclo").fetchall()
    v = pd.DataFrame(filas, columns=["zafra", "finca", "lote", "variedad", "corte", "tch", "rendimiento"])
    v[["tch", "rendimiento"]] = v[["tch", "rendimiento"]].astype(float)
    a_sql = auditar(resumir_ciclos(reconstruir_ciclos(v)), 4).sort_values(["lote", "ciclo"])
    a_pd = auditar(resumir_ciclos(cargado), 4).sort_values(["lote", "ciclo"])
    assert len(a_sql) == len(a_pd)
    assert (a_sql["estado"].to_numpy() == a_pd["estado"].to_numpy()).all()
