"""Configuración común de las pruebas: el límite de uso se apaga para que las pruebas puedan hacer cientos de
consultas seguidas. Su propia prueba (tests/test_limites.py) lo enciende con límites chicos."""
import os

os.environ.setdefault("LIMITES_ACTIVOS", "0")
