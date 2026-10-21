"""Serie IV · pruebas del límite de uso (429) y de los errores de validación en español (422)."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from api.limites import GUATEMALA, Limitador, ip_cliente
from api.main import app

cliente = TestClient(app)
MEDIODIA = datetime(2026, 10, 20, 12, 0, 30, tzinfo=GUATEMALA)


# ----------------------------------------------------------------------------- el limitador
def test_limite_por_ip_al_dia_y_reinicio_a_medianoche():
    lim = Limitador(por_ip_dia=3, por_ip_minuto=100, global_dia=100)
    for i in range(3):
        assert lim.registrar("1.1.1.1", MEDIODIA + timedelta(minutes=i)).permitido
    v = lim.registrar("1.1.1.1", MEDIODIA + timedelta(minutes=5))
    assert not v.permitido and "3 consultas por día" in v.mensaje
    assert v.reintentar_en_s == int(timedelta(hours=11, minutes=54, seconds=30).total_seconds()) + 1
    assert lim.registrar("2.2.2.2", MEDIODIA).permitido                       # otra IP no se ve afectada
    assert lim.registrar("1.1.1.1", MEDIODIA + timedelta(days=1)).permitido   # día nuevo, cuenta nueva


def test_limite_por_minuto_y_tope_global():
    lim = Limitador(por_ip_dia=100, por_ip_minuto=2, global_dia=3)
    assert lim.registrar("a", MEDIODIA).permitido and lim.registrar("a", MEDIODIA).permitido
    v = lim.registrar("a", MEDIODIA)
    assert not v.permitido and "por minuto" in v.mensaje and v.reintentar_en_s == 30
    assert lim.registrar("a", MEDIODIA + timedelta(minutes=1)).permitido     # minuto nuevo
    v = lim.registrar("b", MEDIODIA + timedelta(minutes=1))                    # el tope global ya va en 3
    assert not v.permitido and "límite de consultas de hoy" in v.mensaje


def test_cuota_diaria_opcional_y_limitador_apagado():
    lim = Limitador(por_ip_dia=1, por_ip_minuto=100, global_dia=100)
    assert lim.registrar("a", MEDIODIA).permitido
    assert lim.registrar("a", MEDIODIA, contar_dia=False).permitido           # /salud y /docs no gastan la cuota
    assert not lim.registrar("a", MEDIODIA).permitido
    assert Limitador(por_ip_dia=0, activo=False).registrar("a", MEDIODIA).permitido


def test_ip_detras_de_cloud_run():
    assert ip_cliente({"x-forwarded-for": "201.0.0.5, 169.254.1.1"}, "10.0.0.1") == "201.0.0.5"
    assert ip_cliente({}, "127.0.0.1") == "127.0.0.1"


# ----------------------------------------------------------------------------- la API con límite encendido
@pytest.fixture
def limite_chico():
    original = app.state.limitador
    app.state.limitador = Limitador(por_ip_dia=2, por_ip_minuto=100, global_dia=100)
    yield
    app.state.limitador = original


def test_api_responde_429_en_espanol_con_cors(limite_chico):
    cab = {"X-Forwarded-For": "203.0.113.7", "Origin": "https://edgarsierra.com"}
    for _ in range(2):
        r = cliente.get("/mercado/pronostico?h=1", headers=cab)
        assert r.status_code == 200 and "x-consultas-restantes-hoy" in r.headers
    r = cliente.get("/mercado/pronostico?h=1", headers=cab)
    assert r.status_code == 429
    assert "límite de 2 consultas por día" in r.json()["detail"]
    assert int(r.headers["retry-after"]) > 0
    assert r.headers.get("access-control-allow-origin")            # el navegador puede leer el mensaje
    assert cliente.get("/salud", headers=cab).status_code == 200    # /salud no gasta la cuota diaria
    otra = {"X-Forwarded-For": "198.51.100.9"}
    assert cliente.get("/mercado/pronostico?h=1", headers=otra).status_code == 200


# ----------------------------------------------------------------------------- 422 en español
@pytest.mark.parametrize("metodo, ruta, cuerpo, esperado", [
    ("post", "/campo/ciclo", {"variedad": "HOCP14-885", "precio": -0.2}, "precio: debe ser mayor o igual a 0.05"),
    ("post", "/campo/ciclo", {"precio": 0.2}, "variedad: falta este dato"),
    ("post", "/campo/pronostico", {"variedad": "HOCP14-885", "finca": "RHEBERT", "corte": 7}, "corte: debe ser menor o igual a 4"),
    ("post", "/campo/ciclo", {"variedad": "HOCP14-885", "precio": "mucho"}, "precio: debe ser un número"),
    ("post", "/caldera/vapor-virtual", {"minutos": []}, "minutos: necesita al menos 10 elementos"),
    ("get", "/mercado/pronostico?h=6", None, "h: debe ser menor o igual a 3"),
    ("get", "/mercado/pronostico?h=1&toneladas=-5", None, "toneladas: debe ser mayor que 0"),
])
def test_errores_de_validacion_en_espanol(metodo, ruta, cuerpo, esperado):
    r = getattr(cliente, metodo)(ruta, json=cuerpo) if cuerpo is not None else getattr(cliente, metodo)(ruta)
    assert r.status_code == 422
    assert esperado in r.json()["detail"], r.json()


@pytest.mark.parametrize("metodo, ruta, cuerpo, codigo, esperado", [
    ("post", "/campo/ciclo", b'{"variedad": ', 422, "cuerpo: no es un JSON válido (revise cerca del carácter"),
    ("post", "/campo/ciclo", b"[1, 2]", 422, "cuerpo: debe ser un objeto con campos"),
    ("post", "/asistente", '{"pregunta": "¿Hola?"}'.encode("cp1252"), 400, "debe ser JSON válido en UTF-8"),
    ("get", "/no-existe", None, 404, "No existe esa ruta"),
    ("get", "/campo/ciclo", None, 405, "no acepta este método"),
])
def test_errores_de_forma_tambien_en_espanol(metodo, ruta, cuerpo, codigo, esperado):
    extra = {"content": cuerpo, "headers": {"Content-Type": "application/json"}} if cuerpo is not None else {}
    r = getattr(cliente, metodo)(ruta, **extra)
    assert r.status_code == codigo and esperado in r.json()["detail"], r.json()


def test_error_de_un_minuto_dice_cual_y_que_campo():
    from tests.test_api_caldera_mercado import ENTRADA_VAPOR, minutos
    filas = minutos(0, 10, ENTRADA_VAPOR)
    filas[3]["PTCA_8322A"] = 9800                                   # kPa en vez de MPa
    r = cliente.post("/caldera/vapor-virtual", json={"minutos": filas})
    assert r.status_code == 422 and "minutos[3].PTCA_8322A: debe ser menor o igual a 20" in r.json()["detail"]
