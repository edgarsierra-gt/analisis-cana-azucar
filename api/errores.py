"""Serie IV · errores de validación en español, con el campo que hay que corregir.

pydantic responde en inglés ("Input should be greater than or equal to 0.05") y sin decir el campo en el texto.
Aquí se traduce cada error a una frase en español que nombra el campo: "precio: debe ser mayor o igual a 0.05".
"""
from __future__ import annotations

from typing import Any

PLANTILLAS = {
    "missing": "falta este dato",
    "greater_than_equal": "debe ser mayor o igual a {ge}",
    "greater_than": "debe ser mayor que {gt}",
    "less_than_equal": "debe ser menor o igual a {le}",
    "less_than": "debe ser menor que {lt}",
    "float_parsing": "debe ser un número",
    "float_type": "debe ser un número",
    "int_parsing": "debe ser un número entero",
    "int_type": "debe ser un número entero",
    "int_from_float": "debe ser un número entero",
    "bool_parsing": "debe ser verdadero o falso",
    "bool_type": "debe ser verdadero o falso",
    "string_type": "debe ser texto",
    "string_too_short": "debe tener al menos {min_length} caracteres",
    "string_too_long": "debe tener como mucho {max_length} caracteres",
    "too_short": "necesita al menos {min_length} elementos",
    "too_long": "acepta como mucho {max_length} elementos",
    "list_type": "debe ser una lista",
    "dict_type": "debe ser un objeto",
    "model_type": "debe ser un objeto",
    "model_attributes_type": "debe ser un objeto con campos",
    "json_invalid": "no es un JSON válido",
    "extra_forbidden": "este campo no se acepta",
    "literal_error": "debe ser uno de: {expected}",
    "enum": "debe ser uno de: {expected}",
}


def _campo(loc: tuple[Any, ...]) -> str:
    """('body', 'minutos', 3, 'PTCA_8322A') -> 'minutos[3].PTCA_8322A'; ('query', 'h') -> 'h'."""
    partes = [p for p in loc if p not in ("body", "query", "path", "header")]
    texto = ""
    for p in partes:
        texto += f"[{p}]" if isinstance(p, int) else (f".{p}" if texto else str(p))
    return texto or "cuerpo"


def traducir(errores: list[dict[str, Any]], maximo: int = 10) -> list[str]:
    """Una frase en español por error de pydantic, como mucho `maximo`."""
    frases = []
    for e in errores[:maximo]:
        plantilla = PLANTILLAS.get(e.get("type", ""))
        try:
            texto = plantilla.format(**(e.get("ctx") or {})) if plantilla else e.get("msg", "valor inválido")
        except (KeyError, IndexError):
            texto = e.get("msg", "valor inválido")
        loc = tuple(e.get("loc", ()))
        if e.get("type") == "json_invalid":                   # loc = ("body", posición del error), no un campo
            loc, texto = (), f"{texto} (revise cerca del carácter {loc[-1]})" if loc and isinstance(loc[-1], int) else texto
        frases.append(f"{_campo(loc)}: {texto}")
    if len(errores) > maximo:
        frases.append(f"y {len(errores) - maximo} errores más")
    return frases
