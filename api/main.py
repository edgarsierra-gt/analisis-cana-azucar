"""
Serie IV · API REST de la Serie I (campo): variedades, renovación, pronóstico, segmentos y auditoría.

Correr en local:   uvicorn api.main:app --reload        (documentación en http://localhost:8000/docs)
Con Docker:        docker compose up --build
"""
from __future__ import annotations

import io
import os

import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import TypeAdapter, ValidationError

from api import servicios
from api.esquemas import AuditoriaEntrada, CicloEntrada, Cosecha, PronosticoEntrada, SegmentoEntrada
from campo_economia import Supuestos

VERSION = "1.0.0"
DESCRIPCION = """
Modelos de la **Serie I · Campo** (ensayos de variedades de caña de Louisiana, 2010-2021) expuestos como servicio.

| Pregunta | Endpoint | Para qué sirve |
|---|---|---|
| 1 | `GET /campo/variedades`, `POST /campo/ciclo` | ranking de variedades, cada cuántos cortes renovar y precio de equilibrio |
| 2 | `POST /campo/pronostico` | azúcar por acre esperado de una variedad en una finca y corte, con banda |
| 3 | `POST /campo/segmento` | grupo de comportamiento de una variedad por sus 4 indicadores |
| 4 | `POST /campo/auditoria`, `POST /campo/auditoria/csv` | revisar renovaciones de lotes con registros de cosecha |

La API no re-entrena: lee los JSON que dejan los notebooks y reproduce sus cifras (lo comprueban las pruebas de `tests/test_api.py`).
Las cifras vienen de ensayos de Louisiana: sirven para el método y el orden de variedades, no como valores para otra región.
"""

app = FastAPI(title="API · Análisis de caña de azúcar", version=VERSION, description=DESCRIPCION,
              openapi_tags=[{"name": "General"}, {"name": "Pregunta 1 · Variedades y renovación"},
                            {"name": "Pregunta 2 · Pronóstico"}, {"name": "Pregunta 3 · Segmentos"},
                            {"name": "Pregunta 4 · Auditoría de renovaciones"}])
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_methods=["GET", "POST"], allow_headers=["*"])


@app.exception_handler(servicios.ErrorEntrada)
def _error_entrada(_: Request, exc: servicios.ErrorEntrada) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


# ----------------------------------------------------------------------------- general
@app.get("/", include_in_schema=False)
def inicio() -> RedirectResponse:
    return RedirectResponse("/docs")


@app.get("/salud", tags=["General"], summary="Estado del servicio")
def salud() -> dict:
    """Confirma que la API corre y que los artefactos cargaron."""
    a = servicios.artefactos()
    return {"estado": "ok", "version": VERSION, "variedades_ciclo": len(a["params"]),
            "variedades_pronostico": len(a["p2"]["variedades"]), "grupos": len(a["seg"]["centros_z"])}


# ----------------------------------------------------------------------------- pregunta 1
@app.get("/campo/variedades", tags=["Pregunta 1 · Variedades y renovación"], summary="Ranking de variedades y catálogo")
def variedades(precio: float = Query(0.20, ge=0.05, le=1.0, description="Precio del azúcar, US$/lb")) -> dict:
    """Las 23 variedades con evidencia suficiente, ordenadas por margen anual en su ciclo óptimo, más el catálogo de
    variedades y fincas que acepta cada endpoint. La certeza (P_top3, IC90) es la del bootstrap con los supuestos base."""
    s = Supuestos(precio=precio)
    return {**servicios.ranking(s), "catalogo": servicios.catalogo()}


@app.post("/campo/ciclo", tags=["Pregunta 1 · Variedades y renovación"], summary="Ciclo óptimo de renovación")
def ciclo(e: CicloEntrada) -> dict:
    """Cada cuántos cortes conviene renovar una variedad, su margen anual, la ganancia contra el testigo promedio y el
    precio del azúcar con el que deja de cubrir costos. Cambie los supuestos para simular otro precio o costos."""
    s = Supuestos(e.precio, e.corte, e.mantenimiento, e.renovacion, e.barbecho)
    return servicios.ciclo(e.variedad, s, e.extrapolar)


# ----------------------------------------------------------------------------- pregunta 2
@app.post("/campo/pronostico", tags=["Pregunta 2 · Pronóstico"], summary="Azúcar por acre esperado")
def pronostico(e: PronosticoEntrada) -> dict:
    """Azúcar esperado de una variedad en una finca y corte para la siguiente zafra, con banda de error (~75 % de
    cobertura real en la validación). Con `finca = "nueva"` usa el modelo sin historia de la finca (escenario 2)."""
    return servicios.pronostico(e.variedad, e.finca, e.corte, e.ventaja_lote_anterior)


# ----------------------------------------------------------------------------- pregunta 3
@app.post("/campo/segmento", tags=["Pregunta 3 · Segmentos"], summary="Grupo de una variedad")
def segmento(e: SegmentoEntrada) -> dict:
    """Asigna una variedad al grupo más cercano según productividad, calidad, longevidad y estabilidad (en % contra
    los testigos núcleo, como en la tabla del notebook 04)."""
    return servicios.segmento(e.cana_vs_testigos_pct, e.trs_vs_testigos_pct, e.cana_por_corte_vs_testigos_pct,
                              e.sigma_interaccion_pct)


# ----------------------------------------------------------------------------- pregunta 4
@app.post("/campo/auditoria", tags=["Pregunta 4 · Auditoría de renovaciones"], summary="Auditoría desde JSON")
def auditoria(e: AuditoriaEntrada) -> dict:
    """Reconstruye los ciclos de cada lote, los compara con el óptimo económico y decide, para cada ciclo abierto,
    si conviene otro corte o renovar."""
    cos = pd.DataFrame([c.model_dump() for c in e.cosechas])
    return servicios.auditoria(cos, e.tolerancia)


COLUMNAS_CSV = ["zafra", "finca", "lote", "variedad", "tch"]


@app.post("/campo/auditoria/csv", tags=["Pregunta 4 · Auditoría de renovaciones"], summary="Auditoría desde un CSV")
async def auditoria_csv(archivo: UploadFile = File(..., description="CSV con columnas zafra, finca, lote, variedad, "
                                                                     "corte (opcional), tch, rendimiento (opcional)"),
                        tolerancia: int = Query(1, ge=0, le=3)) -> dict:
    """Lo mismo que `/campo/auditoria`, pero recibe el archivo de cosechas tal como sale de una hoja de cálculo."""
    contenido = await archivo.read()
    if len(contenido) > 10_000_000:
        raise HTTPException(413, "El archivo supera 10 MB.")
    try:
        df = pd.read_csv(io.BytesIO(contenido), encoding="utf-8-sig", dtype=str)
    except Exception as exc:  # noqa: BLE001 — cualquier error de lectura es un CSV inválido para el usuario
        raise HTTPException(422, f"No se pudo leer el CSV: {exc}") from exc
    df.columns = [c.strip().lower() for c in df.columns]
    faltan = [c for c in COLUMNAS_CSV if c not in df.columns]
    if faltan:
        raise HTTPException(422, f"Faltan columnas: {', '.join(faltan)}.")
    filas = df.where(df.notna(), None).to_dict("records")
    try:
        cosechas = TypeAdapter(list[Cosecha]).validate_python(filas)
    except ValidationError as exc:
        errores = [f"fila {err['loc'][0] + 2}, {err['loc'][-1]}: {err['msg']}" for err in exc.errors()[:10]]
        raise HTTPException(422, {"mensaje": "Hay valores inválidos en el CSV.", "errores": errores}) from exc
    if not cosechas:
        raise HTTPException(422, "El CSV no tiene filas.")
    return auditoria(AuditoriaEntrada(tolerancia=tolerancia, cosechas=cosechas))
