"""
Serie IV · límite de uso de la API pública: cuántas consultas puede hacer cada visitante (por IP) al día y por minuto,
más un tope global diario para todo el servicio.

Por qué así: la API está en internet sin usuarios ni llaves (es una demo pública), así que el límite se aplica por IP.
Vive en memoria de cada instancia: con Cloud Run limitado a 2 instancias, el tope real es como mucho el doble del
configurado, lo cual basta para evitar abusos y acotar el costo. El día se cuenta en hora de Guatemala (UTC−6).

Variables de entorno (todas opcionales):
    LIMITES_ACTIVOS        1 (por defecto) o 0 para apagarlo (pruebas automáticas)
    LIMITE_IP_DIA          consultas por IP por día (300)
    LIMITE_IP_MINUTO       consultas por IP por minuto (40)
    LIMITE_GLOBAL_DIA      consultas por día para todo el servicio, por instancia (5000)
    ASISTENTE_LIMITE_*     lo mismo para el asistente (30 por IP al día, 5 por minuto, 300 en total)
"""
from __future__ import annotations

import os
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

GUATEMALA = timezone(timedelta(hours=-6))


@dataclass
class Veredicto:
    permitido: bool
    mensaje: str = ""
    reintentar_en_s: int = 0
    restantes_dia: int = 0


@dataclass
class Limitador:
    """Cuenta consultas por IP por día y por minuto, y un total diario. Seguro para varios hilos."""
    por_ip_dia: int = 300
    por_ip_minuto: int = 40
    global_dia: int = 5000
    activo: bool = True
    unidad: str = "consultas"                 # cómo se nombran en los mensajes
    servicio: str = "La API"
    _dia: str = ""
    _por_ip: dict[str, int] = field(default_factory=dict)
    _minuto: dict[tuple[str, str], int] = field(default_factory=dict)
    _total: int = 0
    _candado: threading.Lock = field(default_factory=threading.Lock)

    @classmethod
    def desde_entorno(cls, prefijo: str = "LIMITE", por_ip_dia: int = 300, por_ip_minuto: int = 40,
                      global_dia: int = 5000, **textos: str) -> "Limitador":
        """Lee los límites de variables de entorno ({prefijo}_IP_DIA, _IP_MINUTO, _GLOBAL_DIA)."""
        leer = lambda nombre, d: int(os.environ.get(f"{prefijo}_{nombre}", d))
        return cls(por_ip_dia=leer("IP_DIA", por_ip_dia), por_ip_minuto=leer("IP_MINUTO", por_ip_minuto),
                   global_dia=leer("GLOBAL_DIA", global_dia), activo=os.environ.get("LIMITES_ACTIVOS", "1") != "0",
                   **textos)

    def registrar(self, ip: str, ahora: datetime | None = None, contar_dia: bool = True) -> Veredicto:
        """Decide si la consulta pasa y, si pasa, la cuenta. `contar_dia=False` solo aplica el límite por minuto."""
        if not self.activo:
            return Veredicto(True, restantes_dia=self.por_ip_dia)
        ahora = (ahora or datetime.now(timezone.utc)).astimezone(GUATEMALA)
        dia, minuto = ahora.strftime("%Y-%m-%d"), ahora.strftime("%Y-%m-%d %H:%M")
        manana = (ahora + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        hasta_manana = int((manana - ahora).total_seconds()) + 1
        with self._candado:
            if dia != self._dia:                          # día nuevo: se reinicia todo
                self._dia, self._por_ip, self._minuto, self._total = dia, {}, {}, 0
            self._minuto = {k: v for k, v in self._minuto.items() if k[1] == minuto}   # solo el minuto actual
            usadas_min = self._minuto.get((ip, minuto), 0)
            usadas_dia = self._por_ip.get(ip, 0)
            if usadas_min >= self.por_ip_minuto:
                return Veredicto(False, f"Demasiadas {self.unidad} seguidas: el límite es {self.por_ip_minuto} por minuto. "
                                        "Se puede volver a intentar en unos segundos.", 60 - ahora.second,
                                 max(self.por_ip_dia - usadas_dia, 0))
            if contar_dia and usadas_dia >= self.por_ip_dia:
                return Veredicto(False, f"Se alcanzó el límite de {self.por_ip_dia} {self.unidad} por día. Se reinicia a "
                                        "la medianoche, hora de Guatemala.", hasta_manana, 0)
            if contar_dia and self._total >= self.global_dia:
                return Veredicto(False, f"{self.servicio} llegó a su límite de {self.unidad} de hoy. Se reinicia a la "
                                        "medianoche, hora de Guatemala.", hasta_manana, 0)
            self._minuto[(ip, minuto)] = usadas_min + 1
            if contar_dia:
                self._por_ip[ip] = usadas_dia + 1
                self._total += 1
            return Veredicto(True, restantes_dia=self.por_ip_dia - self._por_ip.get(ip, 0))

    def devolver(self, ip: str) -> None:
        """Devuelve a la cuota diaria una consulta que falló por causa del servicio (por ejemplo, el modelo no respondió).
        El conteo por minuto no se devuelve: sigue frenando los reintentos seguidos."""
        if not self.activo:
            return
        with self._candado:
            if self._por_ip.get(ip, 0) > 0:
                self._por_ip[ip] -= 1
                self._total = max(self._total - 1, 0)

    def restantes(self, ip: str, ahora: datetime | None = None) -> int:
        """Consultas que le quedan hoy a una IP, sin gastar ninguna (lo que muestra el sitio antes de preguntar)."""
        if not self.activo:
            return self.por_ip_dia
        dia = (ahora or datetime.now(timezone.utc)).astimezone(GUATEMALA).strftime("%Y-%m-%d")
        with self._candado:
            if dia != self._dia:                          # nadie ha consultado hoy
                return self.por_ip_dia
            if self._total >= self.global_dia:
                return 0
            return max(self.por_ip_dia - self._por_ip.get(ip, 0), 0)


def ip_cliente(cabeceras: dict[str, str], directa: str | None) -> str:
    """IP de quien consulta. Detrás de Cloud Run, la primera de X-Forwarded-For; en local, la de la conexión."""
    reenviada = cabeceras.get("x-forwarded-for", "")
    return reenviada.split(",")[0].strip() or directa or "desconocida"
