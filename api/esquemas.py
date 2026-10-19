"""Serie IV · esquemas de entrada (pydantic). Cada campo trae rango físico o económico plausible y un ejemplo."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


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
