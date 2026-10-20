"""Serie III · Mercado — FAOSTAT: carga, limpieza, calidad de datos y trayectorias de la caña de azúcar.

Uso típico (desde un notebook):
    L = cargar_fao(RAW / "Production_Crops_Livestock_E_All_Data.csv")
    P = panel_paises(L)                      # países reales, sucesores encadenados, sin agregados
    Q = calidad_por_pais(P)                  # banderas, rachas constantes, saltos y huecos de reporte
    sel = seleccionar(P)                     # productores con historia larga y tamaño relevante
    F = descriptores(P, sel)                 # 6 descriptores de trayectoria por país
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import theilslopes
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, silhouette_score

ITEM_CANA = 156                      # "Sugar cane" en FAOSTAT
ANIOS = list(range(1961, 2024))
ELEMENTOS = {"Area harvested": "area", "Production": "prod", "Yield": "rend_fao"}
BANDERAS = {"A": "Oficial", "E": "Estimado", "I": "Imputado", "M": "Faltante", "X": "Organismo internacional"}

# "China" de FAOSTAT es la suma de China continental, Taiwán y las RAE: contarla duplica.
AGREGADOS_DOBLES = ["China"]
# Estados que se partieron. Se encadenan para conservar la trayectoria 1961-2023. Sudán del Sur reporta cero caña.
SUCESORES = {"Ethiopia PDR": "Ethiopia", "Sudan (former)": "Sudan", "South Sudan": "Sudan"}

DESCRIPTORES = ["crec_area", "crec_rend", "rend_rel", "giro_area", "giro_rend", "inestab"]
NOMBRE_DESCRIPTOR = {
    "crec_area": "Crecimiento del área (% anual)",
    "crec_rend": "Crecimiento del rendimiento (% anual)",
    "rend_rel": "Rendimiento 2014-2023 frente a la mediana (log)",
    "giro_area": "Cambio de ritmo del área después de 1991 (pp)",
    "giro_rend": "Cambio de ritmo del rendimiento después de 1991 (pp)",
    "inestab": "Inestabilidad del rendimiento (% año a año)",
}

ES = {  # nombres en español para figuras y tablas
    "Angola": "Angola", "Argentina": "Argentina", "Australia": "Australia", "Bangladesh": "Bangladés",
    "Belize": "Belice", "Bolivia (Plurinational State of)": "Bolivia", "Brazil": "Brasil", "Cambodia": "Camboya",
    "Cameroon": "Camerún", "China, mainland": "China continental", "China, Taiwan Province of": "Taiwán",
    "Colombia": "Colombia", "Congo": "Congo", "Costa Rica": "Costa Rica", "Côte d'Ivoire": "Costa de Marfil",
    "Cuba": "Cuba", "Democratic Republic of the Congo": "RD del Congo", "Dominican Republic": "Rep. Dominicana",
    "Ecuador": "Ecuador", "Egypt": "Egipto", "El Salvador": "El Salvador", "Eswatini": "Eswatini",
    "Ethiopia": "Etiopía", "Fiji": "Fiyi", "Ghana": "Ghana", "Guatemala": "Guatemala", "Guinea": "Guinea",
    "Guyana": "Guyana", "Haiti": "Haití", "Honduras": "Honduras", "India": "India", "Indonesia": "Indonesia",
    "Iran (Islamic Republic of)": "Irán", "Jamaica": "Jamaica", "Japan": "Japón", "Kenya": "Kenia",
    "Lao People's Democratic Republic": "Laos", "Liberia": "Liberia", "Madagascar": "Madagascar",
    "Malawi": "Malaui", "Mali": "Malí", "Mauritius": "Mauricio", "Mexico": "México", "Morocco": "Marruecos",
    "Mozambique": "Mozambique", "Myanmar": "Myanmar", "Nepal": "Nepal", "Nicaragua": "Nicaragua", "Niger": "Níger",
    "Nigeria": "Nigeria", "Pakistan": "Pakistán", "Panama": "Panamá", "Papua New Guinea": "Papúa Nueva Guinea",
    "Paraguay": "Paraguay", "Peru": "Perú", "Philippines": "Filipinas", "Rwanda": "Ruanda", "Senegal": "Senegal",
    "Somalia": "Somalia", "South Africa": "Sudáfrica", "Sri Lanka": "Sri Lanka", "Sudan": "Sudán",
    "Thailand": "Tailandia", "Uganda": "Uganda", "United Republic of Tanzania": "Tanzania",
    "United States of America": "Estados Unidos", "Uruguay": "Uruguay",
    "Venezuela (Bolivarian Republic of)": "Venezuela", "Viet Nam": "Vietnam", "Zambia": "Zambia",
    "Zimbabwe": "Zimbabue", "Réunion": "Reunión", "Guadeloupe": "Guadalupe", "Martinique": "Martinica",
    "French Guiana": "Guayana Francesa", "Puerto Rico": "Puerto Rico", "Saint Kitts and Nevis": "San Cristóbal y Nieves",
    "Trinidad and Tobago": "Trinidad y Tobago",
}
es = lambda p: ES.get(p, p)


# ----------------------------------------------------------------------------- 1. carga
def cargar_fao(ruta, item: int = ITEM_CANA) -> pd.DataFrame:
    """Formato largo de un cultivo: una fila por país (incluye agregados) y año, con valor y bandera por elemento."""
    f = pd.read_csv(ruta, encoding="utf-8", dtype=str)
    f = f[f["Item Code"] == str(item)]
    filas = []
    for _, r in f.iterrows():
        nom = ELEMENTOS.get(r["Element"])
        if nom is None:
            continue
        for y in ANIOS:
            v = r.get(f"Y{y}")
            filas.append((r["Area"], int(r["Area Code"]), r["Unit"], nom, y,
                          float(v) if isinstance(v, str) else np.nan, r.get(f"Y{y}F")))
    L = pd.DataFrame(filas, columns=["pais", "codigo", "unidad", "elemento", "anio", "valor", "bandera"])
    V = L.pivot_table(index=["pais", "codigo", "anio"], columns="elemento", values="valor")
    B = L.pivot_table(index=["pais", "codigo", "anio"], columns="elemento", values="bandera", aggfunc="first")
    B.columns = [f"f_{c}" for c in B.columns]
    out = V.join(B).reset_index()
    out.columns.name = None
    return out


def unidades(ruta, item: int = ITEM_CANA) -> pd.DataFrame:
    f = pd.read_csv(ruta, encoding="utf-8", dtype=str, usecols=["Item Code", "Element Code", "Element", "Unit"])
    return f[f["Item Code"] == str(item)].drop_duplicates().drop(columns="Item Code")


def comparar_noflag(ruta_flag, ruta_noflag, item: int = ITEM_CANA) -> dict:
    """¿El archivo sin banderas trae los mismos valores que el completo?"""
    a = pd.read_csv(ruta_flag, encoding="utf-8", dtype=str)
    b = pd.read_csv(ruta_noflag, encoding="utf-8", dtype=str)
    clave = ["Area Code", "Item Code", "Element Code"]
    a, b = a[a["Item Code"] == str(item)].set_index(clave), b[b["Item Code"] == str(item)].set_index(clave)
    cols = [f"Y{y}" for y in ANIOS]
    va, vb = a[cols].astype(float), b.reindex(a.index)[cols].astype(float)
    dif = ~((va == vb) | (va.isna() & vb.isna()))
    return {"filas_completo": len(a), "filas_sin_banderas": len(b), "celdas_distintas": int(dif.values.sum()),
            "todas_las_filas_del_noflag_estan": bool(b.index.isin(a.index).all())}


def consistencia(L: pd.DataFrame) -> dict:
    """Rendimiento contra producción / área, y combinaciones imposibles."""
    d = L[L.codigo < 5000].copy()
    ok = d.dropna(subset=["area", "prod", "rend_fao"])
    ok = ok[ok.area > 0]
    rel = (ok.rend_fao / (ok["prod"] / ok.area * 1000) - 1).abs()
    grandes = ok.area >= 1000
    return {"filas_con_los_tres": len(ok), "rend_difiere_>1%": float((rel > 0.01).mean()),
            "rend_difiere_>1%_area>=1000ha": float((rel[grandes] > 0.01).mean()),
            "area_0_con_produccion": int(((d.area == 0) & (d["prod"] > 0)).sum()),
            "produccion_0_con_area": int(((d["prod"] == 0) & (d.area > 0)).sum())}


# ----------------------------------------------------------------------------- 2. panel limpio
def panel_paises(L: pd.DataFrame) -> pd.DataFrame:
    """Países reales: sin agregados regionales (código ≥ 5000), sin 'China' agregada y con sucesores encadenados.

    El rendimiento se recalcula como producción / área (t/ha). Para los encadenados, la bandera es la de la entidad
    que reporta ese año.
    """
    d = L[(L.codigo < 5000) & (~L.pais.isin(AGREGADOS_DOBLES))].copy()
    d["pais"] = d.pais.replace(SUCESORES)
    suma = lambda x: x.sum(min_count=1)
    P = d.groupby(["pais", "anio"], as_index=False).agg(
        area=("area", suma), prod=("prod", suma),
        f_area=("f_area", lambda x: x.dropna().iloc[0] if x.notna().any() else np.nan),
        f_prod=("f_prod", lambda x: x.dropna().iloc[0] if x.notna().any() else np.nan))
    P["rend"] = np.where(P.area > 0, P["prod"] / P.area, np.nan)   # t/ha
    return P.sort_values(["pais", "anio"]).reset_index(drop=True)


def _racha_max(x: pd.Series) -> int:
    x = x.dropna()
    x = x[x > 0]
    if len(x) < 2:
        return 0
    g = (x != x.shift()).cumsum()
    return int(x.groupby(g).size().max())


def calidad_por_pais(P: pd.DataFrame) -> pd.DataFrame:
    """Indicadores de confiabilidad por país (solo años con producción positiva)."""
    filas = {}
    for p, g in P[(P["prod"] > 0) & (P.area > 0)].groupby("pais"):
        no_of = lambda col: float((~g[col].isin(["A"])).mean())
        dl = np.log(g.set_index("anio").rend).diff().dropna()
        filas[p] = {
            "desde": int(g.anio.min()), "hasta": int(g.anio.max()), "anios": len(g),
            "area_2014_2023": g[g.anio >= 2014].area.mean(), "prod_2014_2023": g[g.anio >= 2014]["prod"].mean(),
            "rend_2014_2023": g[g.anio >= 2014].rend.mean(),
            "pct_no_oficial_prod": 100 * no_of("f_prod"), "pct_no_oficial_area": 100 * no_of("f_area"),
            "pct_imputado": 100 * float(g[["f_area", "f_prod"]].isin(["I"]).any(axis=1).mean()),
            "racha_constante_rend": _racha_max(g.rend.round(1)),
            "racha_constante_prod": _racha_max(g["prod"]),
            "saltos_rend_50pct": int((dl.abs() > np.log(1.5)).sum()),
            "variacion_rend": float(1.4826 * np.median(np.abs(dl - dl.median()))) * 100 if len(dl) > 3 else np.nan,
        }
    Q = pd.DataFrame(filas).T
    for c in ["desde", "hasta", "anios", "racha_constante_rend", "racha_constante_prod", "saltos_rend_50pct"]:
        Q[c] = Q[c].astype(int)
    return Q.astype({c: float for c in Q.columns if Q[c].dtype == object})


def huecos_de_reporte(P: pd.DataFrame, fin: int = 2023) -> pd.DataFrame:
    """Países que dejan de reportar antes del último año."""
    pos = P[P["prod"] > 0].groupby("pais").agg(desde=("anio", "min"), hasta=("anio", "max"),
                                                prod_ultimo=("prod", "last"))
    return pos[pos.hasta < fin].sort_values("hasta")


def seleccionar(P: pd.DataFrame, desde_max: int = 1976, anios_min: int = 45, area_min: float = 5000) -> list[str]:
    """Productores con historia larga (desde 1976 o antes, hasta 2023) y al menos 5,000 ha en 2014-2023."""
    pos = P[(P["prod"] > 0) & (P.area > 0)]
    cob = pos.groupby("pais").anio.agg(["min", "max", "size"])
    rec = pos[pos.anio >= 2014].groupby("pais").area.mean()
    ok = cob[(cob["min"] <= desde_max) & (cob["max"] == ANIOS[-1]) & (cob["size"] >= anios_min)].index
    return sorted(p for p in ok if rec.get(p, 0) >= area_min)


# ----------------------------------------------------------------------------- 3. trayectorias
def _pend(y: pd.Series) -> float:
    """Pendiente robusta (Theil-Sen) de una serie en logaritmos, en % anual."""
    y = y.dropna()
    return 100 * theilslopes(y.values, y.index.values)[0] if len(y) >= 8 else np.nan


def descriptores(P: pd.DataFrame, paises: list[str], corte: int = 1991) -> pd.DataFrame:
    """Seis descriptores de la trayectoria 1961-2023 de cada país.

    - crec_area / crec_rend: pendiente robusta del log del área y del rendimiento en todo el período (% anual).
      La producción es área × rendimiento, así que su crecimiento es la suma de los dos: no se agrega aparte.
    - rend_rel: log del rendimiento 2014-2023 frente a la mediana de los países seleccionados (dónde terminó).
    - giro_area / giro_rend: pendiente después de 1991 menos pendiente hasta 1991 (aceleró > 0, frenó < 0).
    - inestab: dispersión robusta del cambio anual del rendimiento (sequías, huracanes o datos mal medidos).
    """
    pos = P[(P["prod"] > 0) & (P.area > 0) & P.pais.isin(paises)]
    filas = {}
    for p, g in pos.groupby("pais"):
        g = g.set_index("anio").sort_index()
        la, lr = np.log(g.area), np.log(g.rend)
        dl = lr.diff().dropna()
        filas[p] = {
            "crec_area": _pend(la), "crec_rend": _pend(lr),
            "rend_2014_2023": g.loc[g.index >= 2014, "rend"].mean(),
            "giro_area": _pend(la[la.index > corte]) - _pend(la[la.index <= corte]),
            "giro_rend": _pend(lr[lr.index > corte]) - _pend(lr[lr.index <= corte]),
            "inestab": 100 * 1.4826 * float(np.median(np.abs(dl - dl.median()))),
            "area_2014_2023": g.loc[g.index >= 2014, "area"].mean(), "prod_2014_2023": g.loc[g.index >= 2014, "prod"].mean(),
            "inicio": int(g.index.min()),
        }
    F = pd.DataFrame(filas).T.astype(float)
    F["rend_rel"] = np.log(F.rend_2014_2023 / F.rend_2014_2023.median())
    F["crec_prod"] = F.crec_area + F.crec_rend
    return F


def escalar_robusto(F: pd.DataFrame, cols=DESCRIPTORES, tope: float = 3.0) -> pd.DataFrame:
    """(x − mediana) / (IQR / 1.349), recortado a ±3: que un país raro no domine las distancias."""
    X = F[cols]
    iqr = X.quantile(0.75) - X.quantile(0.25)
    return ((X - X.median()) / (iqr / 1.349)).clip(-tope, tope)


def trayectorias_bloque(P: pd.DataFrame, paises: list[str], ancho: int = 5) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Forma de la trayectoria en bloques de 5 años: área relativa a su nivel 2021-2023 y rendimiento (t/ha)."""
    d = P[P.pais.isin(paises)].copy()
    d["bloque"] = ((d.anio - ANIOS[0]) // ancho).clip(upper=(ANIOS[-1] - ANIOS[0]) // ancho)
    B = d.groupby(["pais", "bloque"]).agg(area=("area", "mean"), prod=("prod", "mean"))
    A = B.area.unstack().where(lambda x: x > 0)
    R = (B["prod"] / B.area).unstack().where(lambda x: x > 0)
    etiquetas = {b: f"{ANIOS[0] + ancho * b}-{min(ANIOS[0] + ancho * b + ancho - 1, ANIOS[-1])}" for b in A.columns}
    return A.div(A[A.columns[-1]], axis=0).rename(columns=etiquetas), R.rename(columns=etiquetas)


def distancia_trayectorias(A: pd.DataFrame, R: pd.DataFrame, piso: float = 0.05) -> pd.DataFrame:
    """Distancia euclídea entre trayectorias (log área relativa + log rendimiento), cada bloque en su escala.

    Antes de empezar a producir, el área relativa se fija en 5 % (piso) para no tener log(0).
    """
    from sklearn.metrics.pairwise import nan_euclidean_distances
    la = np.log(A.clip(lower=piso).fillna(piso))
    lr = np.log(R)
    X = np.hstack([la.values / np.nanstd(la.values), lr.values / np.nanstd(lr.values)])
    return pd.DataFrame(nan_euclidean_distances(X), index=A.index, columns=A.index)


# ----------------------------------------------------------------------------- 4. grupos
def silueta_vs_nulo(Z: np.ndarray, ks=range(2, 7), reps: int = 200, semilla: int = 20261019) -> pd.DataFrame:
    """Silueta de k-means contra datos gaussianos con la misma covarianza (sin grupos por construcción)."""
    rng = np.random.default_rng(semilla)
    C, mu = np.cov(Z.T), Z.mean(0)
    filas = {}
    for k in ks:
        lab = KMeans(k, n_init=50, random_state=0).fit_predict(Z)
        s = silhouette_score(Z, lab)
        nul = []
        for _ in range(reps):
            Zn = np.clip(rng.multivariate_normal(mu, C, len(Z)), -3, 3)
            nul.append(silhouette_score(Zn, KMeans(k, n_init=10, random_state=0).fit_predict(Zn)))
        nul = np.array(nul)
        filas[k] = {"silueta": s, "nulo (media)": nul.mean(), "nulo p95": np.percentile(nul, 95),
                    "p": float((nul >= s).mean()), "grupo más chico": int(np.bincount(lab).min())}
    return pd.DataFrame(filas).T


def estabilidad(Z: np.ndarray, ks=range(2, 7), reps: int = 200, semilla: int = 20261019) -> pd.DataFrame:
    """¿Se repiten los grupos al remuestrear países? ARI entre la partición completa y la de cada remuestra."""
    rng = np.random.default_rng(semilla)
    filas = {}
    for k in ks:
        base = KMeans(k, n_init=50, random_state=0).fit(Z)
        aris = []
        for b in range(reps):
            idx = rng.choice(len(Z), len(Z), replace=True)
            km = KMeans(k, n_init=10, random_state=b).fit(Z[idx])
            aris.append(adjusted_rand_score(base.labels_, km.predict(Z)))
        filas[k] = {"ARI mediana": np.median(aris), "ARI p10": np.percentile(aris, 10), "ARI p90": np.percentile(aris, 90),
                    "grupo más chico (%)": 100 * np.bincount(base.labels_).min() / len(Z)}
    return pd.DataFrame(filas).T


def elegir_k(est: pd.DataFrame, ks=range(3, 7), minimo_pct: float = 5.0) -> int:
    """Regla fijada antes de ver los grupos: el k más reproducible entre 3 y 6 sin grupos de menos del 5 %."""
    e = est.loc[[k for k in ks if k in est.index]]
    e = e[e["grupo más chico (%)"] >= minimo_pct]
    return int(e["ARI mediana"].idxmax())
