"""Serie II · Caldera: oportunidades de eficiencia con supuestos explícitos (pregunta 5).

Los datos no traen flujo de combustible, temperatura de chimenea ni CO. Por eso todo impacto sale de un cálculo con
supuestos declarados, y cada supuesto se puede cambiar en `SupuestosCaldera`.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
from iapws import IAPWS97


@dataclass(frozen=True)
class SupuestosCaldera:
    """Supuestos del cálculo de impacto (referenciales; se reemplazan con datos de planta)."""
    t_agua_alimentacion_c: float = 215.0   # °C, típico de calderas de 9.8 MPa con calentador de alta
    p_agua_alimentacion_mpa: float = 10.5
    eficiencia: float = 0.88               # CFB a carbón: 87-90 %
    pci_mj_kg: float = 23.0                # carbón térmico
    precio_combustible_t: float = 120.0    # US$/t
    horas_ano: float = 8000.0
    perdida_por_k: float = 0.04            # puntos de eficiencia por K de temperatura de chimenea (λ ≈ 1.11)
    dt_chimenea_amb_k: float = 120.0       # chimenea ~145 °C, ambiente ~25 °C
    fraccion_a_chimenea: float = 0.5       # de cada °C extra a la salida del economizador superior, cuánto llega a la chimenea
    tension_tiro_kv: float = 6.0
    factor_potencia: float = 0.85
    precio_kwh: float = 0.10               # US$/kWh

    def dict(self) -> dict:
        """Supuestos como diccionario (para guardar junto a los resultados)."""
        return asdict(self)


def calor_util_gj_h(vapor_t_h: float, p_vapor_mpa: float, t_vapor_c: float, s: SupuestosCaldera) -> float:
    """Calor que absorbe el agua para volverse vapor (GJ/h), con tablas de vapor IAPWS-97."""
    h_v = IAPWS97(P=p_vapor_mpa, T=t_vapor_c + 273.15).h
    h_a = IAPWS97(P=s.p_agua_alimentacion_mpa, T=s.t_agua_alimentacion_c + 273.15).h
    return vapor_t_h * 1000 * (h_v - h_a) / 1e6


def combustible_t_h(calor_util: float, s: SupuestosCaldera, eficiencia: float | None = None) -> float:
    """Combustible necesario (t/h) para un calor útil dado."""
    e = s.eficiencia if eficiencia is None else eficiencia
    return calor_util / e / s.pci_mj_kg


def exceso_aire(o2: float | np.ndarray) -> float | np.ndarray:
    """Factor de aire λ ≈ 21 / (21 − O₂) (gases secos, combustión completa)."""
    return 21.0 / (21.0 - np.asarray(o2))


def puntos_por_chimenea(dt_chimenea_k: float, s: SupuestosCaldera) -> float:
    """Puntos de eficiencia que se pierden por subir la chimenea dt K."""
    return s.perdida_por_k * dt_chimenea_k


def puntos_por_exceso_aire(o2_antes: float, o2_despues: float, s: SupuestosCaldera) -> float:
    """Puntos de eficiencia que se ganan al bajar el O₂: la pérdida en gases escala con λ."""
    perdida_ref = s.perdida_por_k * s.dt_chimenea_amb_k
    return perdida_ref * (exceso_aire(o2_antes) - exceso_aire(o2_despues)) / exceso_aire(o2_antes)


def ahorro(puntos: float, calor_util: float, s: SupuestosCaldera) -> dict:
    """Combustible y dinero que ahorra subir la eficiencia `puntos` (puntos porcentuales)."""
    c0 = combustible_t_h(calor_util, s)
    c1 = combustible_t_h(calor_util, s, s.eficiencia + puntos / 100)
    t_h = c0 - c1
    return {"puntos_eficiencia": puntos, "combustible_%": 100 * t_h / c0, "t_dia": 24 * t_h,
            "us_ano": t_h * s.horas_ano * s.precio_combustible_t}


def kw_tiro(delta_amperios: float, s: SupuestosCaldera) -> float:
    """Potencia eléctrica (kW) equivalente a un cambio de corriente del motor del tiro inducido (trifásico)."""
    return np.sqrt(3) * s.tension_tiro_kv * delta_amperios * s.factor_potencia
