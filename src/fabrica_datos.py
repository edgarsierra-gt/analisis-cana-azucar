"""Serie II · Caldera: carga de archivos, diccionario corregido, auditoría de sensores y limpieza.

La caldera es de lecho fluidizado circulante (CFB) a carbón, con 30 sensores cada 5 s durante 5 días.
Reglas que salen de la auditoría (notebook 06):
- Se trabaja con `data.csv`. `data_AutoReg.csv` es idéntico salvo 30 valores imputados de YJJWSLL; esos 30 quedan
  como faltantes (la imputación no ve el escalón que sigue al segundo hueco).
- Cinco sensores se actualizan cada 10 s (el valor se repite en la fila siguiente): el análisis va a 10 s o más.
- YFJ3_AI (corriente del tiro inducido) tiene picos de una muestra: son la respuesta del control de tiro a golpes
  de presión del hogar (físicos), no errores. Se conservan; los modelos usan promedios de 1 min o más.
- SXLTCYZ no se usa en modelos: copia la presión de hogar (r = 0.99 con PT_8313A), no es un diferencial.
- YFJ3_ZD2 no se usa en modelos: es ruido sin relación con la carga ni con su par ZD1.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

PERIODO_S = 5

# tag -> (nombre en español, unidad inferida, grupo físico)
# Las unidades no vienen en el diccionario: se infieren de las magnitudes y del diseño típico de una CFB de
# ~75 t/h, 9.8 MPa y 540 °C. Las marcadas con "?" no se pueden confirmar con los datos.
SENSORES: dict[str, tuple[str, str, str]] = {
    "PT_8313A": ("Presión de hogar superior A", "Pa", "hogar"),
    "PT_8313B": ("Presión de hogar superior B", "Pa", "hogar"),
    "PT_8313C": ("Presión de hogar superior C", "Pa", "hogar"),
    "PT_8313D": ("Presión de hogar superior D", "Pa", "hogar"),
    "PT_8313E": ("Presión de hogar superior E", "Pa", "hogar"),
    "PT_8313F": ("Presión de hogar superior F", "Pa", "hogar"),
    "PTCA_8322A": ("Presión del domo (izq.)", "MPa", "vapor"),
    "PTCA_8324": ("Presión de vapor a la salida del colector", "MPa", "vapor"),
    "TE_8319A": ("Temperatura de gases a la salida del economizador superior (izq.)", "°C", "gases"),
    "TE_8319B": ("Temperatura de gases a la salida del economizador superior (der.)", "°C", "gases"),
    "TE_8313B": ("Temperatura del hogar, parte superior (der.)", "°C", "hogar"),
    "TE_8303": ("Temperatura del aire primario a la salida del precalentador", "°C", "aire"),
    "TE_8304": ("Temperatura del aire secundario a la salida del precalentador", "°C", "aire"),
    "TE_8332A": ("Temperatura del vapor a la salida de la caldera", "°C", "vapor"),
    "TV_8329ZC": ("Apertura de la válvula del atemperador primario", "%", "vapor"),
    "FT_8301": ("Flujo de aire primario", "Nm³/h", "aire"),
    "FT_8302": ("Flujo de aire secundario", "Nm³/h", "aire"),
    "FT_8306A": ("Flujo de aire a la cámara de retorno (izq.)", "Nm³/h", "aire"),
    "FT_8306B": ("Flujo de aire a la cámara de retorno (der.)", "Nm³/h", "aire"),
    "AIR_8301A": ("O₂ en gases a la entrada del economizador superior (izq.)", "% vol", "gases"),
    "AIR_8301B": ("O₂ en gases a la entrada del economizador superior (der.)", "% vol", "gases"),
    "YFJ3_AI": ("Corriente del motor del ventilador de tiro inducido", "A", "tiro"),
    "YFJ3_ZD1": ("Vibración de chumacera del tiro inducido A", "mm/s?", "tiro"),
    "YFJ3_ZD2": ("Vibración de chumacera del tiro inducido B", "mm/s?", "tiro"),
    "SXLTCYZ": ("Diferencial de presión hogar superior-inferior (izq.)", "Pa", "lecho"),
    "SXLTCYY": ("Diferencial de presión hogar superior-inferior (der.)", "Pa", "lecho"),
    "ZCLCCY": ("Diferencial de presión del lecho (izq.)", "Pa", "lecho"),
    "YCLCCY": ("Diferencial de presión del lecho (der.)", "Pa", "lecho"),
    "YJJWSLL": ("Flujo de agua de atemperación primaria", "t/h", "vapor"),
    "ZZQBCHLL": ("Flujo de vapor principal (compensado)", "t/h", "vapor"),
}
PRESION_HOGAR = [f"PT_8313{x}" for x in "ABCDEF"]
OBJETIVO = "ZZQBCHLL"


def _tag(col: str) -> str:
    """Quita el sufijo del historiador: 'PT_8313A.AV_0#' -> 'PT_8313A'."""
    return col.replace(".AV_0#", "").replace(".AV_0", "")


def cargar(ruta: str | Path) -> pd.DataFrame:
    """Lee un archivo de operación con índice de fecha y nombres de sensor limpios (sin sufijo)."""
    df = pd.read_csv(ruta, parse_dates=["date"]).set_index("date")
    df.columns = [_tag(c) for c in df.columns]
    return df


def revisar_diccionario(ruta: str | Path, columnas_datos: list[str]) -> dict:
    """Problemas del diccionario `columns.csv` frente a los datos (encabezado, orden, nombres, unidades)."""
    crudo = Path(ruta).read_bytes()
    dic = pd.read_csv(ruta)
    tags = [_tag(t) for t in dic.iloc[:, 0]]
    return {
        "encabezado": dic.columns.tolist(),
        "campos_por_fila": int(dic.notna().sum(axis=1).max()),
        "columna_vacia": [c for c in dic.columns if dic[c].isna().all()],
        "fin_de_linea_windows": b"\r\n" in crudo,
        "mismos_sensores": sorted(tags) == sorted(columnas_datos),
        "mismo_orden": tags == list(columnas_datos),
        "con_unidades": False,  # ninguna fila trae unidad
        "descripciones": dict(zip(tags, dic.iloc[:, 1])),
    }


def comparar_archivos(a: pd.DataFrame, b: pd.DataFrame) -> pd.DataFrame:
    """Celdas en que dos archivos difieren (un faltante en ambos no cuenta como diferencia)."""
    distinto = (a != b) & ~(a.isna() & b.isna())
    filas = []
    for c in a.columns[distinto.any()]:
        for t in a.index[distinto[c]]:
            filas.append({"fecha": t, "sensor": c, "original": a.at[t, c], "otro": b.at[t, c]})
    return pd.DataFrame(filas)


def picos_aislados(x: pd.Series, ventana: int = 13, k: float = 8.0, max_muestras: int = 2) -> pd.Series:
    """Picos de 1-2 muestras: residuo contra la mediana móvil (~1 min) mayor que k desvíos del residuo.

    Un tramo más largo no se marca: puede ser físico (por ejemplo, un golpe de presión en el hogar).
    """
    med = x.rolling(ventana, center=True, min_periods=3).median()
    res = x - med
    fuera = (res.abs() > k * res.std()) & x.notna()
    largo = fuera.groupby((~fuera).cumsum()).transform("sum")
    return fuera & (largo <= max_muestras)


def tramos_constantes(x: pd.Series) -> pd.Series:
    """Largo (en muestras) del tramo de valores idénticos al que pertenece cada fila."""
    grupo = x.ne(x.shift()).cumsum()
    return grupo.map(grupo.value_counts())


def auditoria_sensores(df: pd.DataFrame) -> pd.DataFrame:
    """Una fila por sensor: faltantes, rango, actualización real, resolución, tramos congelados y picos."""
    filas = []
    for c in df.columns:
        x = df[c]
        cambia = x.ne(x.shift()).to_numpy()
        par = np.arange(len(x)) % 2 == 0
        solo_pares = cambia[~par].mean() < 0.01 and cambia[par].mean() > 0.9
        pasos = np.abs(np.diff(x.dropna().to_numpy()))
        tramos = tramos_constantes(x)
        nombre, unidad, grupo = SENSORES[c]
        filas.append({
            "sensor": c, "descripcion": nombre, "unidad": unidad, "grupo": grupo,
            "faltantes": int(x.isna().sum()),
            "min": x.min(), "p01": x.quantile(0.01), "mediana": x.median(), "p99": x.quantile(0.99), "max": x.max(),
            "actualiza_s": 2 * PERIODO_S if solo_pares else PERIODO_S,
            "resolucion": float(pasos[pasos > 0].min()) if (pasos > 0).any() else np.nan,
            "valores_distintos": int(x.nunique()),
            "pct_repetido": 100 * (1 - cambia.mean()),
            "congelado_max_min": tramos.max() * PERIODO_S / 60,
            "picos_aislados": int(picos_aislados(x).sum()),
        })
    return pd.DataFrame(filas).set_index("sensor")


def banderas(df: pd.DataFrame) -> pd.DataFrame:
    """Marcas por fila que salen de la auditoría. No se borra ni se interpola nada: los modelos deciden qué usar.

    - faltante_agua: YJJWSLL sin dato (30 filas; `data_AutoReg.csv` las rellena, aquí no).
    - transitorio_tiro: pico de 1-2 muestras en la corriente del tiro inducido. Es físico: sube cuando la presión de
      hogar está alta y baja cuando está baja, y la presión cambia más rápido justo después (respuesta del control).
    - valvula_fija: la válvula del atemperador no se mueve por 30 min o más (lazo en manual o sin acción).
    """
    b = pd.DataFrame(index=df.index)
    b["faltante_agua"] = df["YJJWSLL"].isna()
    b["transitorio_tiro"] = picos_aislados(df["YFJ3_AI"])
    b["valvula_fija"] = tramos_constantes(df["TV_8329ZC"]) >= 30 * 60 // PERIODO_S
    return b


# Sensores que entran a los modelos: se excluye SXLTCYZ (copia la presión de hogar) y YFJ3_ZD2 (ruido sin relación
# con la operación). Ambos se conservan para detectar fallas de sensor (pregunta 4).
EXCLUIR_MODELOS = ["SXLTCYZ", "YFJ3_ZD2"]


def variables_derivadas(df: pd.DataFrame) -> pd.DataFrame:
    """Variables físicas que resumen sensores redundantes o pares (se usan en las preguntas 2 a 5)."""
    d = pd.DataFrame(index=df.index)
    d["presion_hogar"] = df[PRESION_HOGAR].median(axis=1)          # mediana: robusta a un sensor malo
    d["aire_total"] = df["FT_8301"] + df["FT_8302"]
    d["frac_primario"] = df["FT_8301"] / d["aire_total"]
    d["o2"] = df[["AIR_8301A", "AIR_8301B"]].mean(axis=1)
    d["t_gases"] = df[["TE_8319A", "TE_8319B"]].mean(axis=1)
    d["lecho"] = df[["ZCLCCY", "YCLCCY"]].mean(axis=1)
    d["retorno_total"] = df["FT_8306A"] + df["FT_8306B"]
    d["retorno_izq_menos_der"] = df["FT_8306A"] - df["FT_8306B"]
    return d


def agregar(df: pd.DataFrame, freq: str = "1min") -> pd.DataFrame:
    """Promedio por ventana de tiempo (ignora faltantes)."""
    return df.resample(freq).mean()
