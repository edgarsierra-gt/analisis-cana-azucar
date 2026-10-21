"""
Serie IV · API REST de las Series I (campo), II (caldera) y III (mercado).

Correr en local:   uvicorn api.main:app --reload        (documentación en http://localhost:8000/docs)
Con Docker:        docker compose up --build
"""
from __future__ import annotations

import io
import logging
import os

import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import TypeAdapter, ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from api import asistente, caldera, errores, mercado, servicios
from api.esquemas import (AsistenteEntrada, AuditoriaEntrada, CicloEntrada, Cosecha, PronosticoEntrada, SegmentoEntrada,
                          VaporEntrada, VentanaModo, VerificarEntrada)
from api.limites import Limitador, ip_cliente
from campo_economia import Supuestos

VERSION = "1.2.0"
DESCRIPCION = """
Modelos de la prueba expuestos como servicio: **Serie I · Campo** (ensayos de variedades de caña de Louisiana,
2010-2021), **Serie II · Caldera** (5 días de una caldera de cogeneración) y **Serie III · Mercado** (azúcar No. 11).

| Serie y pregunta | Endpoint | Para qué sirve |
|---|---|---|
| I · 1 | `GET /campo/variedades`, `POST /campo/ciclo` | ranking de variedades, cada cuántos cortes renovar y precio de equilibrio |
| I · 2 | `POST /campo/pronostico` | azúcar por acre esperado de una variedad en una finca y corte, con banda |
| I · 3 | `POST /campo/segmento` | grupo de comportamiento de una variedad por sus 4 indicadores |
| I · 4 | `POST /campo/auditoria`, `POST /campo/auditoria/csv` | revisar renovaciones de lotes con registros de cosecha |
| II · 1 | `GET /caldera/sensores` | diccionario corregido de los 30 sensores, con unidad, estado y tratamiento |
| II · 2 | `POST /caldera/modo` | zona de carga de una ventana de 5 min |
| II · 3 | `POST /caldera/vapor-virtual` | flujo de vapor estimado con los demás sensores (sensor virtual) |
| II · 4 | `POST /caldera/verificar` | chequeos de redundancia: ¿falla un sensor o es el proceso? |
| III · 3 | `GET /mercado/pronostico` | precio esperado a 1 y 3 meses con bandas de 80 % y 95 % |
| Asistente | `POST /asistente`, `GET /asistente/estado` | preguntas en español sobre los tres análisis (Gemini en Vertex AI, responde solo con estos endpoints) |

**Límite de uso:** es una API pública de demostración, así que cada IP tiene un límite de consultas por minuto y por
día (respuesta 429 con un mensaje en español si se pasa). El asistente tiene su propia cuota, más corta: 30 preguntas
por IP al día. Los errores de validación (422) dicen en español qué campo
corregir.

La API no re-entrena: lee los JSON que dejan los notebooks y reproduce sus cifras (lo comprueban las pruebas de `tests/`).
Los datos son públicos y de otros lugares (Louisiana, una caldera a carbón, el mercado mundial): sirven para el
método, no como valores para otra operación.
"""

app = FastAPI(title="API · Análisis de caña de azúcar", version=VERSION, description=DESCRIPCION,
              openapi_tags=[{"name": "General"}, {"name": "Campo · Variedades y renovación"},
                            {"name": "Campo · Pronóstico"}, {"name": "Campo · Segmentos"},
                            {"name": "Campo · Auditoría de renovaciones"}, {"name": "Caldera"},
                            {"name": "Mercado"}, {"name": "Asistente"}])
# Límite de uso por IP (api/limites.py). Va antes que CORS en el código para quedar por dentro de él: así una respuesta
# 429 también lleva las cabeceras de CORS y el navegador puede mostrar el mensaje.
app.state.limitador = Limitador.desde_entorno()
SIN_CUOTA_DIARIA = {"/", "/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect", "/salud", "/asistente/estado"}
# El asistente gasta un modelo de lenguaje en cada pregunta: cuota aparte de 30 por IP al día, 5 por minuto y 300 en total.
app.state.limitador_asistente = Limitador.desde_entorno(prefijo="ASISTENTE_LIMITE", por_ip_dia=30, por_ip_minuto=5,
                                                        global_dia=300, unidad="preguntas", servicio="El asistente")
log = logging.getLogger("api")


@app.middleware("http")
async def limitar(request: Request, siguiente):
    if request.method == "OPTIONS":                      # las verificaciones previas de CORS no cuentan
        return await siguiente(request)
    ip = ip_cliente({k.lower(): v for k, v in request.headers.items()}, request.client.host if request.client else None)
    v = request.app.state.limitador.registrar(ip, contar_dia=request.url.path not in SIN_CUOTA_DIARIA)
    if not v.permitido:
        return JSONResponse(status_code=429, content={"detail": v.mensaje},
                            headers={"Retry-After": str(v.reintentar_en_s)})
    respuesta = await siguiente(request)
    respuesta.headers["X-Consultas-Restantes-Hoy"] = str(v.restantes_dia)
    return respuesta


# CORS: lista exacta de sitios (CORS_ORIGINS, separados por coma) y, opcional, un patrón para los dominios de vista
# previa de Vercel (CORS_ORIGIN_REGEX). En local, sin variables, acepta cualquier origen.
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_origin_regex=os.environ.get("CORS_ORIGIN_REGEX") or None,
                   allow_methods=["GET", "POST"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
def _error_validacion(_: Request, exc: RequestValidationError) -> JSONResponse:
    frases = errores.traducir(list(exc.errors()))
    return JSONResponse(status_code=422, content={"detail": "; ".join(frases), "errores": frases})


# Mensajes que FastAPI y Starlette dan en inglés antes de llegar a una ruta
MENSAJES_HTTP = {
    "There was an error parsing the body": "No se pudo leer el cuerpo de la petición: debe ser JSON válido en UTF-8.",
    "Not Found": "No existe esa ruta. Las consultas disponibles están en /docs.",
    "Method Not Allowed": "Esa ruta no acepta este método (GET o POST). Ver /docs.",
}


@app.exception_handler(StarletteHTTPException)
async def _error_http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    if isinstance(exc.detail, str) and exc.detail in MENSAJES_HTTP:
        exc = StarletteHTTPException(exc.status_code, MENSAJES_HTTP[exc.detail], exc.headers)
    return await http_exception_handler(request, exc)


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
@app.get("/campo/variedades", tags=["Campo · Variedades y renovación"], summary="Ranking de variedades y catálogo")
def variedades(precio: float = Query(0.20, ge=0.05, le=1.0, description="Precio del azúcar, US$/lb")) -> dict:
    """Las 23 variedades con evidencia suficiente, ordenadas por margen anual en su ciclo óptimo, más el catálogo de
    variedades y fincas que acepta cada endpoint. La certeza (P_top3, IC90) es la del bootstrap con los supuestos base."""
    s = Supuestos(precio=precio)
    return {**servicios.ranking(s), "catalogo": servicios.catalogo()}


@app.post("/campo/ciclo", tags=["Campo · Variedades y renovación"], summary="Ciclo óptimo de renovación")
def ciclo(e: CicloEntrada) -> dict:
    """Cada cuántos cortes conviene renovar una variedad, su margen anual, la ganancia contra el testigo promedio y el
    precio del azúcar con el que deja de cubrir costos. Cambie los supuestos para simular otro precio o costos."""
    s = Supuestos(e.precio, e.corte, e.mantenimiento, e.renovacion, e.barbecho)
    return servicios.ciclo(e.variedad, s, e.extrapolar)


# ----------------------------------------------------------------------------- pregunta 2
@app.post("/campo/pronostico", tags=["Campo · Pronóstico"], summary="Azúcar por acre esperado")
def pronostico(e: PronosticoEntrada) -> dict:
    """Azúcar esperado de una variedad en una finca y corte para la siguiente zafra, con banda de error (~75 % de
    cobertura real en la validación). Con `finca = "nueva"` usa el modelo sin historia de la finca (escenario 2)."""
    return servicios.pronostico(e.variedad, e.finca, e.corte, e.ventaja_lote_anterior)


# ----------------------------------------------------------------------------- pregunta 3
@app.post("/campo/segmento", tags=["Campo · Segmentos"], summary="Grupo de una variedad")
def segmento(e: SegmentoEntrada) -> dict:
    """Asigna una variedad al grupo más cercano según productividad, calidad, longevidad y estabilidad (en % contra
    los testigos núcleo, como en la tabla del notebook 04)."""
    return servicios.segmento(e.cana_vs_testigos_pct, e.trs_vs_testigos_pct, e.cana_por_corte_vs_testigos_pct,
                              e.sigma_interaccion_pct)


# ----------------------------------------------------------------------------- pregunta 4
@app.post("/campo/auditoria", tags=["Campo · Auditoría de renovaciones"], summary="Auditoría desde JSON")
def auditoria(e: AuditoriaEntrada) -> dict:
    """Reconstruye los ciclos de cada lote, los compara con el óptimo económico y decide, para cada ciclo abierto,
    si conviene otro corte o renovar."""
    cos = pd.DataFrame([c.model_dump() for c in e.cosechas])
    return servicios.auditoria(cos, e.tolerancia)


COLUMNAS_CSV = ["zafra", "finca", "lote", "variedad", "tch"]


@app.post("/campo/auditoria/csv", tags=["Campo · Auditoría de renovaciones"], summary="Auditoría desde un CSV")
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


# ----------------------------------------------------------------------------- Serie II · caldera
@app.get("/caldera/sensores", tags=["Caldera"], summary="Diccionario corregido de los sensores")
def caldera_sensores() -> dict:
    """Los 30 sensores con nombre en español, unidad inferida, grupo, cada cuánto se actualizan, estado y tratamiento
    (notebook 06). El diccionario original no traía unidades y describía mal al menos un sensor."""
    return caldera.sensores()


@app.post("/caldera/modo", tags=["Caldera"], summary="Zona de carga de una ventana de 5 min")
def caldera_modo(e: VentanaModo) -> dict:
    """Asigna una ventana de 5 min a la zona de carga más cercana (baja, media o alta), con los promedios de sus 9
    variables físicas (notebook 07)."""
    return caldera.modo(e.model_dump())


@app.post("/caldera/vapor-virtual", tags=["Caldera"], summary="Sensor virtual del flujo de vapor")
def caldera_vapor(e: VaporEntrada) -> dict:
    """Estima el flujo de vapor del último minuto con el Ridge final del notebook 08 (0.18 t/h de error típico,
    validado hacia adelante por día). Pide al menos 10 minutos consecutivos de promedios de 1 min, porque el modelo usa
    rezagos de 1, 2 y 5 min y la media de 10 min. Nunca usa el vapor medido: si se manda `ZZQBCHLL`, solo se compara."""
    return caldera.vapor_virtual([m.model_dump() for m in e.minutos])


@app.post("/caldera/verificar", tags=["Caldera"], summary="Verificación de sensores por redundancia")
def caldera_verificar(e: VerificarEntrada) -> dict:
    """Los 12 chequeos del notebook 09: cada presión de hogar contra la mediana de las otras 5, pares izquierda-derecha,
    vapor medido contra virtual y agua contra la apertura de la válvula. Un chequeo entra en alarma si lleva 5 minutos
    seguidos fuera de su umbral. Si varias presiones de hogar alarman a la vez, es un evento del hogar, no sensores."""
    return caldera.verificar([m.model_dump() for m in e.minutos], e.retorno_confirmado)


# ----------------------------------------------------------------------------- Serie III · mercado
@app.get("/mercado/pronostico", tags=["Mercado"], summary="Precio del azúcar No. 11 a 1 y 3 meses")
def mercado_pronostico(h: int = Query(1, ge=1, le=3, description="Horizonte en meses: 1 o 3"),
                       toneladas: float | None = Query(None, gt=0, le=10_000_000,
                                                       description="Opcional: toneladas sin fijar, para ver el rango de ingreso")) -> dict:
    """Centro (último cierre) y bandas de 80 % y 95 % del promedio del mes objetivo, en ¢/lb, % y US$/t (notebook 12).
    Ningún modelo probado le ganó al último cierre: el valor del pronóstico está en el rango."""
    if h == 2:
        raise HTTPException(422, "El horizonte debe ser 1 o 3 meses.")
    return mercado.pronostico(h, toneladas)


# ----------------------------------------------------------------------------- asistente
def _ip(request: Request) -> str:
    return ip_cliente({k.lower(): v for k, v in request.headers.items()}, request.client.host if request.client else None)


@app.get("/asistente/estado", tags=["Asistente"], summary="Disponibilidad y preguntas restantes hoy")
def asistente_estado(request: Request) -> dict:
    """Dice si el asistente está configurado y cuántas preguntas le quedan hoy a quien consulta. No gasta la cuota."""
    lim = request.app.state.limitador_asistente
    return {"disponible": asistente.disponible(), "modelo": asistente.MODELO, "limite_dia": lim.por_ip_dia,
            "restantes_hoy": lim.restantes(_ip(request)), "max_caracteres": asistente.MAX_CARACTERES,
            "max_pasos": asistente.MAX_PASOS}


@app.post("/asistente", tags=["Asistente"], summary="Pregunta en lenguaje natural sobre los análisis")
def asistente_preguntar(e: AsistenteEntrada, request: Request) -> dict:
    """Responde en español con Gemini (Vertex AI). El modelo no calcula ni inventa cifras: consulta las mismas funciones
    de esta API (ranking, ciclo, pronóstico, sensores, sensor virtual, precio, resúmenes) y redacta con lo que devuelven,
    citando el notebook de origen. Mande los últimos mensajes en `historial` para seguir una conversación; el servidor
    no guarda nada. Cuota: 30 preguntas por IP al día y 5 por minuto."""
    if not asistente.disponible():
        raise HTTPException(503, "El asistente no está disponible en este entorno.")
    lim, ip = request.app.state.limitador_asistente, _ip(request)
    v = lim.registrar(ip)
    if not v.permitido:
        return JSONResponse(status_code=429, content={"detail": v.mensaje}, headers={"Retry-After": str(v.reintentar_en_s)})
    try:
        r = asistente.responder(e.pregunta, [m.model_dump() for m in e.historial])
    except asistente.AsistenteNoDisponible as exc:
        raise HTTPException(503, "El asistente no está disponible en este entorno.") from exc
    except asistente.FalloModelo as exc:
        log.warning("asistente: el modelo falló: %s", exc)        # sin la pregunta: no se guarda lo que escriben
        lim.devolver(ip)                                          # una falla del servicio no gasta la cuota del día
        raise HTTPException(502, "El modelo no respondió. Intente de nuevo en unos segundos.") from exc
    return {**r, "restantes_hoy": v.restantes_dia}
