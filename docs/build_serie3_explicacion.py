"""Genera docs/serie3_explicacion.html con cifras que salen de los datos y de las salidas de los notebooks 10-13.

Uso (desde la raíz del repo):  python docs/build_serie3_explicacion.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from mercado_faostat import cargar_fao, panel_paises, seleccionar, trayectorias_bloque, es  # noqa: E402
from mercado_precio import (cargar_precio, retornos, markov_volatilidad, fases_20, fases_en_paseo_aleatorio,  # noqa: E402
                            extremos, dias_de_cambio)
from mercado_pronostico import mensual, pronosticos, bandas, MODELOS  # noqa: E402
from mercado_oferta import precio_anual, panel_oferta, estimar, nombre  # noqa: E402

TAB = ROOT / "outputs/tables"
RAW = ROOT / "data/raw/serie3"
leer = lambda n: json.loads((TAB / n).read_text(encoding="utf-8"))
r_ = lambda x, d=2: None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), d)
lista = lambda s, d=2: [r_(v, d) for v in s]
D = {}

# ---------------------------------------------------------------- precio (portada y pregunta 2)
S = cargar_precio(RAW / "individual_data/Sugar_data.csv")
R = retornos(S)
r = R.ajustado.dropna()
W, M2 = markov_volatilidad(r, 2)
alto = int(np.argmax([M2.params[f"sigma2[{i}]"] for i in range(2)]))
prob = M2.smoothed_marginal_probabilities[alto]
M = mensual(S)
turb_m = (prob.resample("ME").mean() > 0.5).reindex(M.index).fillna(False)
D["precio_m"] = {"t": [f"{t:%m/%Y}" for t in M.index], "prom": lista(M.prom), "turb": turb_m.astype(int).tolist()}
Wp = S.close.resample("W-FRI").last().dropna()
tw = (prob.reindex(Wp.index).fillna(0) > 0.5)
D["sem"] = {"t": [f"{t:%d/%m/%Y}" for t in Wp.index], "p": lista(Wp), "turb": tw.astype(int).tolist(),
            "vol": lista((r.rolling(63).std() * np.sqrt(252) * 100).reindex(Wp.index, method="ffill"), 1)}
F20 = fases_20(Wp)
D["fases"] = [{"tipo": f.tipo, "i": int(Wp.index.get_loc(f.fecha)), "p": r_(f.precio)} for f in F20.itertuples()]
sim = fases_en_paseo_aleatorio(len(Wp), np.log(Wp).diff().std())
D["rw"] = {"sim": sim.tolist(), "obs": int(len(F20))}
D["p2"] = leer("serie3_resumen_p2.json")
EX = extremos(r, 12)
CONTEXTO = {
    "2000-04-28": "Último día del contrato de mayo de 2000, volumen cero: artefacto del vencimiento",
    "2008-03-17": "Lunes del rescate de Bear Stearns: la mayor caída registrada de las materias primas",
    "2010-11-11": "Una semana después del máximo de 30 años de inicios de noviembre",
    "2010-11-12": "Segundo día de la caída de −20 % en dos días, en una venta generalizada de materias primas",
    "2011-02-03": "Día siguiente al máximo de 30 años (36.08 ¢/lb)",
}
D["ext"] = [{"f": f"{d:%d/%m/%Y}", "ret": r_(100 * EX.loc[d, "retorno_%"] / 100, 1), "z": r_(EX.loc[d, "z_robusto"], 1),
             "tipo": R.loc[d, "tipo"], "ctx": CONTEXTO.get(f"{d:%Y-%m-%d}", "Sin fuente que lo explique")} for d in EX.index]
media = S.close.groupby(S.index.year).mean()
REF = {2002: (6.24, None), 2006: (14.79, None), 2011: (26.24, 57.32 / 2.2046), 2016: (18.14, 40 / 2.2046),
       2020: (12.88, 28 / 2.2046), 2023: (24.04, 52 / 2.2046)}
D["verif"] = [{"a": a, "serie": r_(media[a]), "fmi": f, "bm": r_(b) if b else None} for a, (f, b) in REF.items()]

# ---------------------------------------------------------------- pregunta 1
L = cargar_fao(RAW / "Production_Crops_Livestock_E_All_Data.csv")
P = panel_paises(L)
SEL = seleccionar(P)
D["p1"] = leer("serie3_resumen_p1.json")
cal = P[P.pais.isin(SEL) & (P["prod"] > 0)].copy()
tab = pd.crosstab(cal.anio, cal.f_prod.fillna("otro"), normalize="index") * 100
D["cal"] = {"anios": tab.index.tolist(), **{k: lista(tab.get(k, pd.Series(0, index=tab.index)), 1) for k in ["A", "E", "I", "X"]}}
Q = pd.read_csv(TAB / "serie3_calidad_paises.csv", index_col=0)
dud = D["p1"]["poco_confiables"]
D["dudosos"] = [{"p": es(p), "no_of": r_(Q.loc[p, "pct_no_oficial_prod"], 0), "racha": int(Q.loc[p, "racha_constante_rend"]),
                 "var": r_(Q.loc[p, "variacion_rend"], 1), "rend": r_(Q.loc[p, "rend_2014_2023"], 0)} for p in dud]
piv = P[P.pais.isin(["Liberia", "Ghana", "Guatemala"])].pivot_table(index="anio", columns="pais", values="rend")
D["malas"] = {"anios": piv.index.tolist(), **{es(c): lista(piv[c], 1) for c in piv.columns}}
g = P[P.pais == "Guatemala"].set_index("anio")
D["gt"] = {"anios": g.index.tolist(), "area": lista(g.area / 1e3, 1), "prod": lista(g["prod"] / 1e6, 2),
           "f_area": g.f_area.fillna("").tolist(), "f_prod": g.f_prod.fillna("").tolist(), "rend": lista(g.rend, 1)}
F = pd.read_csv(TAB / "serie3_grupos_paises.csv", index_col=0)
D["paises"] = [{"en": p, "p": es(p), "ca": r_(F.loc[p, "crec_area"]), "cr": r_(F.loc[p, "crec_rend"]),
                "rd": r_(F.loc[p, "rend_2014_2023"], 1), "g": F.loc[p, "grupo_nombre"], "pr": r_(F.loc[p, "prod_2014_2023"] / 1e6, 2),
                "ga": r_(F.loc[p, "giro_area"]), "in": r_(F.loc[p, "inestab"], 1),
                "no_of": r_(Q.loc[p, "pct_no_oficial_prod"], 0)} for p in F.index]
A, Rr = trayectorias_bloque(P, SEL)
D["tray"] = {"bloques": [c[:4] for c in A.columns], "area": {p: lista(A.loc[p], 3) for p in A.index},
             "rend": {p: lista(Rr.loc[p], 1) for p in Rr.index}}

# ---------------------------------------------------------------- pregunta 3
D["p3"] = leer("serie3_resumen_p3.json")
BD = {}
for h in (1, 3):
    Ph = pronosticos(M, h)
    B = bandas(Ph, MODELOS[0], h, escala_vol=True)
    obj = Ph.loc[B.index, "objetivo"]
    BD[h] = {"t": [f"{t:%m/%Y}" for t in obj], **{k: lista(np.exp(B[k])) for k in ["real", "centro", "lo80", "hi80", "lo95", "hi95"]}}
D["band"] = BD
D["modelo_pron"] = json.loads((ROOT / "outputs/models/serie3_pronostico.json").read_text(encoding="utf-8"))

# ---------------------------------------------------------------- pregunta 4
D["p4"] = leer("serie3_resumen_p4.json")
PA = precio_anual(S).loc[:2023]
DP = panel_oferta(P, SEL, PA)
DP = DP[DP.anio <= 2023].copy()
perf = {}
for dep in ["dla", "dlq"]:
    e = estimar(DP, dep, [-1, 0, 1, 2, 3, 4])
    perf[dep] = {"coef": lista(e["coef"], 4), "se": lista(e["se"], 4)}
D["perfil"] = perf
Wd = P[P.pais.isin(SEL) & (P.anio >= 2000)].groupby("anio")[["area"]].sum()
dla_w = 100 * np.log(Wd.area).diff(); dlp = 100 * np.log(PA).diff()
D["agg"] = {"anios": list(range(2002, 2024)), "area": lista(dla_w.reindex(range(2002, 2024)), 1),
            "precio2": lista(dlp.shift(2).reindex(range(2002, 2024)), 1)}
rng = np.random.default_rng(20261019)
dl = np.log(PA).diff().dropna(); nul = []
for _ in range(2000):
    s_ = pd.Series(rng.permutation(dl.values), index=dl.index); Dp = DP.copy()
    for k in (1, 2, 3):
        Dp[nombre(k)] = Dp.anio.map(s_.shift(k))
    nul.append(estimar(Dp, "dla", [1, 2, 3])["suma"])
cnt, bordes = np.histogram(nul, bins=40)
D["nulo"] = {"cnt": cnt.tolist(), "bordes": lista(bordes, 4), "obs": r_(D["p4"]["base"]["dla"]["suma"], 4),
             "p95": r_(np.percentile(nul, 95), 4)}

html = (ROOT / "docs/serie3_template.html").read_text(encoding="utf-8")
out = html.replace("/*__DATA__*/null", json.dumps(D, ensure_ascii=False, default=float))
(ROOT / "docs/serie3_explicacion.html").write_text(out, encoding="utf-8")
print("ok", len(out), "bytes")
