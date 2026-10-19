"""
Serie I · Campo — carga y limpieza del dataset de ensayos de caña de Louisiana (2010-2021).

Uso:
    from campo_data import load_raw, clean
    raw = load_raw("data/raw/All_Genotypes_2010_onwards.csv")
    df, log = clean(raw)

Cada regla de limpieza deja rastro en `log` (dict regla -> filas afectadas) para
documentarlo en la bitácora y en el notebook. Ninguna regla modifica el archivo original.

Unidades (verificadas con identidades, ver notebook 01):
    T_SPACRE : libras de azúcar por acre  (= TCA × TRS_TON, error < 0.3 %)
    TRS_TON  : libras de azúcar teórico recuperable por tonelada corta de caña
    TCA      : toneladas cortas de caña por acre
    POPN     : tallos por acre (2010-2019; = TCA × 2000 / MSTWT). En 2020-2021 la unidad no cuadra -> NaN
    MSTWT    : libras por tallo
    FIBER    : % de fibra en caña
"""
from __future__ import annotations

import csv
import re

import numpy as np
import pandas as pd

MEASURES = ["T_SPACRE", "TRS_TON", "TCA", "POPN", "MSTWT", "FIBER"]
INT_COLS = ["YEAR", "STAGE", "CROP", "REP"]

# Límites de plausibilidad física (Louisiana). Fuera de estos rangos el valor es un error de captura.
LIMITS = {
    "TCA": (0, 100),        # p99.9 observado = 84 t/acre; 518 es un error ×10
    "TRS_TON": (120, 400),  # 400 lb/t = 20 % de azúcar recuperable: tope físico razonable
    "MSTWT": (0, 6),        # p99.9 observado = 4.1 lb/tallo
    "FIBER": (6, 22),       # fibra en caña típica 10-16 %; < 6 % no es físicamente creíble
}

LOC_FIXES = {"DOMINGUES": "DOMINGUE"}  # mismo ensayo: plantía 2019 con nombre mal escrito


def load_raw(path: str) -> pd.DataFrame:
    """Lee el CSV tal cual viene (texto), sin interpretar números.

    - Quita el BOM del encabezado.
    - Descarta las 3 columnas finales vacías (la última trae un mini-diccionario de 6 notas, no datos).
    """
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    header = rows[0][:12]
    return pd.DataFrame([r[:12] for r in rows[1:]], columns=header)


def repair_decimal_comma(raw: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Repara las filas donde T_SPACRE venía con coma decimal ("821,10").

    Esa coma partió el campo: T_SPACRE quedó con la parte entera y TRS_TON con
    "<decimales><espacios><TRS>". Se reconstruye T_SPACRE = entero.decimales y TRS_TON = TRS.
    La reparación se valida en el notebook con la identidad T_SPACRE ≈ TCA × TRS_TON.
    """
    df = raw.copy()
    m = df["TRS_TON"].str.extract(r"^(\d+)\s+(\d+(?:\.\d+)?)$")
    bad = m[0].notna()
    df.loc[bad, "T_SPACRE"] = df.loc[bad, "T_SPACRE"] + "." + m.loc[bad, 0]
    df.loc[bad, "TRS_TON"] = m.loc[bad, 1]
    return df, bad


def to_numeric(df: pd.DataFrame) -> pd.DataFrame:
    """'.' y '' significan faltante en este archivo."""
    out = df.copy()
    for c in MEASURES:
        out[c] = pd.to_numeric(out[c].replace({".": np.nan, "": np.nan}))
    for c in INT_COLS:
        out[c] = out[c].astype(int)
    return out


def clean(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Aplica las reglas de limpieza en orden y devuelve (df_limpio, log)."""
    log: dict[str, int] = {"filas_originales": len(raw)}

    df, bad = repair_decimal_comma(raw)
    log["reparadas_coma_decimal"] = int(bad.sum())
    df = to_numeric(df)
    df["fila_reparada"] = bad.values

    # 1) Ceros = medición ausente (vienen junto a TCA vacío, p. ej.)
    for c in ["T_SPACRE", "TRS_TON", "TCA", "POPN", "MSTWT"]:
        z = df[c].eq(0)
        log[f"cero_a_nan_{c}"] = int(z.sum())
        df.loc[z, c] = np.nan

    # 2) POPN 2020-2021 viene en otra unidad (≈12 vs ≈33,000 tallos/acre) y no cumple la identidad
    m = df["YEAR"] >= 2020
    log["popn_2020_2021_a_nan"] = int(df.loc[m, "POPN"].notna().sum())
    df.loc[m, "POPN"] = np.nan

    # 3) Valores físicamente imposibles
    lo, hi = LIMITS["TCA"]
    bad_tca = (df["TCA"] > hi) | (df["MSTWT"] > LIMITS["MSTWT"][1])
    log["tca_o_mstwt_imposible_fila_a_nan"] = int(bad_tca.sum())
    df.loc[bad_tca, ["T_SPACRE", "TCA", "TRS_TON", "POPN", "MSTWT"]] = np.nan

    lo, hi = LIMITS["TRS_TON"]
    bad_trs = (df["TRS_TON"] < lo) | (df["TRS_TON"] > hi)
    log["trs_imposible_a_nan"] = int(bad_trs.sum())
    df.loc[bad_trs, ["TRS_TON", "T_SPACRE"]] = np.nan  # T_SPACRE se deriva de TRS

    lo, hi = LIMITS["FIBER"]
    bad_fib = (df["FIBER"] < lo) | (df["FIBER"] > hi)
    log["fibra_imposible_a_nan"] = int(bad_fib.sum())
    df.loc[bad_fib, "FIBER"] = np.nan

    # 4) Nombres de localidad
    log["loc_renombrada"] = int(df["LOC"].isin(list(LOC_FIXES)).sum())
    df["LOC"] = df["LOC"].replace(LOC_FIXES)

    # 5) Duplicados exactos (misma llave y mismas mediciones): doble captura
    key = ["CLONE", "YEAR", "STAGE", "LOC", "CROP", "REP"]
    dup = df.duplicated(key + MEASURES, keep="first")
    log["duplicados_exactos_eliminados"] = int(dup.sum())
    df = df.loc[~dup].copy()

    # 6) Filas sin variable objetivo
    no_y = df["T_SPACRE"].isna()
    log["sin_T_SPACRE_eliminadas"] = int(no_y.sum())
    df = df.loc[~no_y].copy()

    # Variables de estructura del diseño
    df["PLANT_YEAR"] = df["YEAR"] - df["CROP"]              # cohorte de siembra
    df["TRIAL"] = (df["STAGE"].astype(str) + "|" + df["LOC"] + "|" + df["PLANT_YEAR"].astype(str))
    df["ENV"] = df["LOC"] + "|" + df["YEAR"].astype(str)      # ambiente = localidad × año

    log["filas_finales"] = len(df)
    return df.reset_index(drop=True), log


def identity_checks(df: pd.DataFrame) -> pd.DataFrame:
    """Cocientes que deben valer 1 si las unidades son las documentadas."""
    out = pd.DataFrame(index=df.index)
    out["azucar"] = df["T_SPACRE"] / (df["TCA"] * df["TRS_TON"])
    out["cana"] = df["TCA"] / (df["POPN"] * df["MSTWT"] / 2000)
    return out


def check_varieties(df: pd.DataFrame, min_cohorts: int = 4) -> list[str]:
    """Testigos: clones sembrados en ensayos de etapa 2-3 en al menos `min_cohorts` años distintos.

    Un candidato normal pasa por las etapas tempranas en 1-3 cohortes y avanza o se descarta.
    Solo las variedades comerciales de referencia se vuelven a sembrar ahí año tras año.
    (No sirve "aparece en las 4 etapas": eso también lo cumple un candidato que fue avanzando.)
    """
    early = df[df["STAGE"] <= 3].groupby("CLONE")["PLANT_YEAR"].nunique()
    return sorted(early[early >= min_cohorts].index)
