"""Serie IV · esquemas de entrada (pydantic). Cada campo trae rango físico o económico plausible y un ejemplo."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, create_model


class SupuestosEntrada(BaseModel):
    """Supuestos económicos. Por defecto, los de la prueba."""
    precio: float = Field(0.20, ge=0.05, le=1.0, description="Precio del azúcar, US$ por libra recuperable")
    corte: float = Field(14.0, ge=0, le=100, description="Corte, alce y transporte, US$ por tonelada corta de caña")
    mantenimiento: float = Field(350, ge=0, le=3000, description="Mantenimiento del cultivo, US$ por acre por año")
    renovacion: float = Field(1100, ge=0, le=10000, description="Renovación (preparación y siembra), US$ por acre en la plantía")
    barbecho: int = Field(0, ge=0, le=2, description="Años sin caña antes de resembrar")


class CicloEntrada(SupuestosEntrada):
    model_config = ConfigDict(json_schema_extra={"examples": [{"variedad": "HOCP14-885", "precio": 0.20}]})
    variedad: str = Field(..., min_length=1, max_length=40, description="Una de las 23 variedades de /campo/variedades")
    extrapolar: bool = Field(False, description="Extender la ventaja por corte más allá del último corte medido (sensibilidad)")


class PronosticoEntrada(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [
        {"variedad": "HOCP14-885", "finca": "RHEBERT", "corte": 0},
        {"variedad": "L01-299", "finca": "MAGNOLIA", "corte": 2, "ventaja_lote_anterior": 1.05},
        {"variedad": "HOL15-508", "finca": "nueva", "corte": 1}]})
    variedad: str = Field(..., min_length=1, max_length=40, description="Variedad con historia en etapa 5")
    finca: str = Field(..., min_length=1, max_length=40, description="Finca conocida, o 'nueva' si no tiene historia")
    corte: int = Field(..., ge=0, le=4, description="0 = plantía, 1 a 4 = número de soca")
    ventaja_lote_anterior: float | None = Field(
        None, gt=0.2, lt=5.0,
        description="Opcional. Azúcar de la variedad ÷ testigos núcleo en el mismo lote el año pasado (1.10 = 10 % arriba)")


class SegmentoEntrada(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [
        {"cana_vs_testigos_pct": 9.9, "trs_vs_testigos_pct": 7.5, "cana_por_corte_vs_testigos_pct": 1.7, "sigma_interaccion_pct": 8.5}]})
    cana_vs_testigos_pct: float = Field(..., gt=-90, lt=300, description="Productividad: caña por acre en plantía vs testigos, %")
    trs_vs_testigos_pct: float = Field(..., gt=-90, lt=300, description="Calidad: TRS promedio vs testigos, %")
    cana_por_corte_vs_testigos_pct: float = Field(..., gt=-90, lt=300, description="Longevidad: cambio de la caña por corte vs testigos, %")
    sigma_interaccion_pct: float = Field(..., ge=0, lt=100, description="Estabilidad: desvío de la ventaja entre fincas y años, % (menor = más estable)")


class Cosecha(BaseModel):
    zafra: int = Field(..., ge=1950, le=2100, description="Año de inicio de la zafra")
    finca: str = Field(..., min_length=1, max_length=60)
    lote: str = Field(..., min_length=1, max_length=60)
    variedad: str = Field(..., min_length=1, max_length=40)
    corte: int | None = Field(None, ge=0, le=40, description="0 = plantía. Recomendado: sin él se pierden renovaciones")
    tch: float = Field(..., gt=0, le=400, description="Toneladas métricas de caña por hectárea")
    rendimiento: float | None = Field(None, gt=20, le=250, description="Kg de azúcar por tonelada de caña (opcional)")


class AuditoriaEntrada(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"tolerancia": 1, "cosechas": [
        {"zafra": 2019, "finca": "F01", "lote": "F01-L1", "variedad": "CG02-163", "corte": 0, "tch": 120.5, "rendimiento": 112},
        {"zafra": 2020, "finca": "F01", "lote": "F01-L1", "variedad": "CG02-163", "corte": 1, "tch": 110.2, "rendimiento": 115},
        {"zafra": 2021, "finca": "F01", "lote": "F01-L1", "variedad": "CG02-163", "corte": 2, "tch": 98.7, "rendimiento": 114}]}]})
    tolerancia: int = Field(1, ge=0, le=3, description="Cortes de diferencia con el óptimo que aún cuentan como 'a tiempo'")
    cosechas: list[Cosecha] = Field(..., min_length=1, max_length=50000)


# ============================================================================= Serie II · caldera
# Rangos amplios alrededor de lo observado en los 5 días (notebook 06): rechazan errores de unidades, no operación rara.
def _campos(spec: dict[str, tuple[float, float, str]], opcionales: tuple[str, ...] = ()) -> dict:
    return {k: ((float | None) if k in opcionales else float,
                Field(None if k in opcionales else ..., ge=lo, le=hi, description=d)) for k, (lo, hi, d) in spec.items()}


VAPOR_SPEC = {
    "PTCA_8322A": (0, 20, "Presión del domo, MPa"),
    "PTCA_8324": (0, 20, "Presión de vapor a la salida del colector, MPa"),
    "TE_8313B": (0, 1200, "Temperatura del hogar, parte superior, °C"),
    "TE_8303": (0, 500, "Temperatura del aire primario precalentado, °C"),
    "TE_8304": (0, 500, "Temperatura del aire secundario precalentado, °C"),
    "TV_8329ZC": (0, 100, "Apertura de la válvula del atemperador, %"),
    "FT_8301": (0, 200000, "Flujo de aire primario, Nm³/h"),
    "FT_8302": (0, 200000, "Flujo de aire secundario, Nm³/h"),
    "YFJ3_AI": (0, 200, "Corriente del motor del tiro inducido, A"),
    "YFJ3_ZD1": (0, 100, "Vibración de chumacera del tiro inducido A"),
    "SXLTCYY": (-5000, 5000, "Diferencial de presión hogar superior-inferior (der.), Pa"),
    "YJJWSLL": (0, 50, "Agua de atemperación, t/h"),
    "TE_8332A": (0, 700, "Temperatura del vapor a la salida, °C"),
    "presion_hogar": (-3000, 3000, "Mediana de las 6 presiones de hogar (promedio del minuto), Pa"),
    "lecho": (0, 30000, "Promedio de los diferenciales del lecho ZCLCCY y YCLCCY, Pa"),
    "o2": (0, 21, "Promedio de O₂ izquierdo y derecho, % vol"),
    "t_gases": (0, 800, "Promedio de la temperatura de gases izquierda y derecha, °C"),
    "retorno_total": (0, 20000, "Suma del aire a las cámaras de retorno, Nm³/h"),
    "ZZQBCHLL": (0, 300, "Opcional: vapor medido, t/h, para compararlo con el estimado"),
}
MinutoVapor = create_model("MinutoVapor", **_campos(VAPOR_SPEC, opcionales=("ZZQBCHLL",)))

VERIF_SPEC = {**{f"PT_8313{x}": (-3000, 3000, f"Presión de hogar {x}, Pa") for x in "ABCDEF"},
              "AIR_8301A": (0, 21, "O₂ izquierdo, % vol"), "AIR_8301B": (0, 21, "O₂ derecho, % vol"),
              "ZCLCCY": (0, 30000, "Diferencial del lecho izquierdo, Pa"), "YCLCCY": (0, 30000, "Diferencial del lecho derecho, Pa"),
              "TE_8319A": (0, 800, "Gases a la salida del economizador (izq.), °C"),
              "TE_8319B": (0, 800, "Gases a la salida del economizador (der.), °C"),
              "FT_8306A": (0, 20000, "Aire a la cámara de retorno izquierda, Nm³/h"),
              "FT_8306B": (0, 20000, "Aire a la cámara de retorno derecha, Nm³/h"),
              "ZZQBCHLL": (0, 300, "Vapor medido, t/h"), "YJJWSLL": (0, 50, "Agua de atemperación, t/h"),
              "TV_8329ZC": (0, 100, "Apertura de la válvula del atemperador, %"),
              "PTCA_8322A": (0, 20, "Presión del domo, MPa"), "PTCA_8324": (0, 20, "Presión del colector, MPa"),
              "TE_8332A": (0, 700, "Temperatura del vapor, °C")}
MinutoVerificacion = create_model("MinutoVerificacion", **_campos(VERIF_SPEC))

MODO_SPEC = {"vapor": (0, 300, "Flujo de vapor, t/h"), "aire_total": (0, 300000, "Aire primario + secundario, Nm³/h"),
             "frac_primario": (0, 1, "Fracción de aire primario"), "o2": (0, 21, "O₂ en gases (promedio), % vol"),
             "t_hogar": (0, 1200, "Temperatura del hogar, °C"), "lecho": (0, 30000, "Diferencial del lecho (promedio), Pa"),
             "agua_atemp": (0, 50, "Agua de atemperación, t/h"), "t_vapor": (0, 700, "Temperatura del vapor, °C"),
             "t_gases": (0, 800, "Temperatura de gases (promedio), °C")}
VentanaModo = create_model("VentanaModo", **_campos(MODO_SPEC))


class VaporEntrada(BaseModel):
    minutos: list[MinutoVapor] = Field(..., min_length=10, max_length=120,
                                       description="Promedios de 1 min consecutivos, del más antiguo al más reciente (al menos 10)")


class VerificarEntrada(BaseModel):
    minutos: list[MinutoVerificacion] = Field(..., min_length=1, max_length=120,
                                              description="Promedios de 1 min consecutivos; con 5 o más se aplica la persistencia")
    retorno_confirmado: bool = Field(True, description="Usar el centro del aire de retorno después de la redistribución "
                                                       "confirmada del 30/03 (la operación vigente)")


class MensajeHistorial(BaseModel):
    rol: Literal["usuario", "asistente"] = Field(..., description="Quién escribió el mensaje")
    texto: str = Field(..., min_length=1, max_length=2000)


class AsistenteEntrada(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "pregunta": "¿Qué variedad conviene ampliar y cada cuántos cortes se renueva?", "historial": []}})
    pregunta: str = Field(..., min_length=1, max_length=500, description="Pregunta sobre los análisis, en español")
    historial: list[MensajeHistorial] = Field([], max_length=8,
                                              description="Últimos mensajes de la conversación (el servidor no guarda nada)")
