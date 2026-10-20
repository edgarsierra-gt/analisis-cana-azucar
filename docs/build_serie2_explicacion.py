"""Genera docs/serie2_explicacion.html con cifras que salen de los datos y de las salidas de los notebooks 06-09.

Uso (desde la raíz del repo):  python docs/build_serie2_explicacion.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from fabrica_datos import cargar, PRESION_HOGAR, picos_aislados, variables_derivadas  # noqa: E402
from fabrica_regimenes import tabla_ventanas  # noqa: E402
from fabrica_sensor_virtual import tabla_minuto  # noqa: E402

TAB, MOD = ROOT / "outputs/tables", ROOT / "outputs/models"
leer = lambda p: json.loads(p.read_text(encoding="utf-8"))
r = lambda x, d=2: None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), d)
lista = lambda s, d=2: [r(v, d) for v in s]

DF = cargar(ROOT / "data/raw/serie2/data.csv")
AR = cargar(ROOT / "data/raw/serie2/data_AutoReg.csv")
D = {"n": len(DF), "inicio": f"{DF.index[0]:%d/%m/%Y %H:%M}", "fin": f"{DF.index[-1]:%d/%m/%Y %H:%M}", "sensores": DF.shape[1]}

# ---------------------------------------------------------------- pregunta 1
aud = pd.read_csv(TAB / "serie2_auditoria_sensores.csv", index_col=0)
trat = pd.read_csv(TAB / "serie2_tratamiento_sensores.csv", index_col=0)
D["tabla"] = [{"tag": t, "desc": trat.at[t, "descripción"], "unidad": trat.at[t, "unidad"], "grupo": aud.at[t, "grupo"],
               "estado": trat.at[t, "estado"], "trat": trat.at[t, "tratamiento"], "act": int(aud.at[t, "actualiza_s"]),
               "falt": int(aud.at[t, "faltantes"]), "p01": r(aud.at[t, "p01"]), "p99": r(aud.at[t, "p99"]),
               "med": r(aud.at[t, "mediana"]), "cong": r(aud.at[t, "congelado_max_min"], 1)} for t in DF.columns]
m10 = DF.resample("10min").mean()
D["serie10"] = {"t": [f"{t:%d/%m %H:%M}" for t in m10.index], **{c: lista(m10[c], 3) for c in DF.columns}}

c = "YJJWSLL"; lin = DF[c].interpolate(); falta = DF[c].isna()
grupos = (falta != falta.shift()).cumsum()[falta]
huecos = []
for _, g in grupos.groupby(grupos):
    t0, t1 = g.index[0] - pd.Timedelta("60s"), g.index[-1] + pd.Timedelta("60s")
    w = DF.loc[t0:t1, c]
    huecos.append({"t": [f"{t:%H:%M:%S}" for t in w.index], "medido": lista(w), "autoreg": [r(AR.at[t, c]) if falta[t] else None for t in w.index],
                   "lineal": [r(lin[t]) if falta[t] else None for t in w.index], "inicio": f"{g.index[0]:%d/%m %H:%M}", "n": int(len(g))})
D["huecos"] = huecos
w = DF.loc["2022-03-28 10:00:00":"2022-03-28 10:02:00"]
D["paso10"] = {"t": [f"{t:%H:%M:%S}" for t in w.index], "vapor": lista(w["ZZQBCHLL"]), "aire": lista(w["FT_8301"], 0)}
M = DF.resample("1min").mean()
cols = PRESION_HOGAR + ["SXLTCYZ", "SXLTCYY"]
D["corr"] = {"cols": cols, "m": M[cols].corr().round(3).values.tolist()}
smp = M.sample(1200, random_state=1)
D["disp"] = {"pa": lista(smp["PT_8313A"], 1), "z": lista(smp["SXLTCYZ"], 1), "y": lista(smp["SXLTCYY"], 1)}

pico = picos_aislados(DF["YFJ3_AI"]).to_numpy()
ph = DF[PRESION_HOGAR].median(axis=1).to_numpy(); I = DF["YFJ3_AI"].to_numpy(); med = DF["YFJ3_AI"].rolling(13, center=True, min_periods=3).median().to_numpy()
idx = np.where(pico)[0]; idx = idx[(idx > 24) & (idx < len(DF) - 24)]; up = I[idx] > med[idx]
rng = np.random.default_rng(20261019); azar = rng.integers(24, len(DF) - 24, 20000); lags = np.arange(-12, 13)
D["picos"] = {"s": (lags * 5).tolist(), "arriba": [r(np.mean(ph[idx[up] + L]), 1) for L in lags],
              "abajo": [r(np.mean(ph[idx[~up] + L]), 1) for L in lags], "azar": [r(np.mean(ph[azar + L]), 1) for L in lags],
              "n": int(len(idx)), "n_arriba": int(up.sum()), "salto": r(np.median(np.abs(I[idx] - med[idx])), 1),
              "vel_pico": r(np.median(np.abs(ph[idx + 1] - ph[idx])), 1), "vel_azar": r(np.median(np.abs(ph[azar + 1] - ph[azar])), 1)}
ret = DF[["FT_8306A", "FT_8306B"]].resample("10min").mean()
D["retorno"] = {"t": [f"{t:%d/%m %H:%M}" for t in ret.index], "a": lista(ret["FT_8306A"], 0), "b": lista(ret["FT_8306B"], 0),
                "tot": lista(ret.sum(axis=1), 0),
                "evento": int(ret.index.get_indexer([pd.Timestamp(leer(TAB / "serie2_resumen_p1.json")["salto_retorno"])], method="nearest")[0])}
D["p1"] = leer(TAB / "serie2_resumen_p1.json")

# ---------------------------------------------------------------- pregunta 2
D["p2"] = leer(TAB / "serie2_resumen_p2.json")
modos = pd.read_csv(TAB / "serie2_modos_5min.csv", index_col=0, parse_dates=True)["modo"]
W5 = tabla_ventanas(DF, "5min")
D["linea"] = {"t": [f"{t:%d/%m %H:%M}" for t in W5.index], "vapor": lista(W5["vapor"]), "modo": modos.reindex(W5.index).tolist(),
              "lecho": lista(W5["lecho"], 0), "valvula": lista(W5["valvula"], 1)}
cic = pd.read_csv(TAB / "serie2_ciclos_lecho.csv", parse_dates=["inicio", "fin"])
pos5 = lambda t: int(W5.index.get_indexer([t], method="nearest")[0])
D["descargas"] = [[pos5(a), pos5(b)] for a, b in cic.query("fase == 'descarga'")[["inicio", "fin"]].itertuples(index=False)]

# ---------------------------------------------------------------- pregunta 3
D["p3"] = leer(TAB / "serie2_resumen_p3.json")
TM = tabla_minuto(DF)
s3 = TM[["raiz_dp_rho", "ZZQBCHLL", "dp_sobrecalentador"]].dropna().sample(1500, random_state=2)
D["hid"] = {"x": lista(s3["raiz_dp_rho"], 5), "y": lista(s3["ZZQBCHLL"]), "dp": lista(s3["dp_sobrecalentador"], 3)}
D["rangos"] = {k: [r(TM[c].quantile(0.005), 2), r(TM[c].quantile(0.995), 2), r(TM[c].median(), 2)]
               for k, c in [("p_domo", "PTCA_8322A"), ("p_col", "PTCA_8324"), ("t_vapor", "TE_8332A"), ("agua", "YJJWSLL"), ("vapor", "ZZQBCHLL")]}
pr = pd.read_csv(TAB / "serie2_predicciones_p3.csv", index_col=0, parse_dates=True)
dia = sorted(pr.dropna().index.floor("D").unique())[2]
w = pr.loc[dia + pd.Timedelta("6h"): dia + pd.Timedelta("12h")]
D["medest"] = {"t": [f"{t:%H:%M}" for t in w.index], "dia": f"{dia:%d/%m}", **{k: lista(w[k]) for k in ["medido", "Ridge completo", "Ridge de combustión", "Hidráulico √(ΔP·ρ)"]}}

# ---------------------------------------------------------------- pregunta 4
D["p4"] = leer(TAB / "serie2_resumen_p4.json")
iny = pd.read_csv(TAB / "serie2_inyecciones_series.csv", parse_dates=["fecha"])
D["esc"] = {e: {"t": [f"{t:%d/%m %H:%M}" for t in g["fecha"]], "ver": lista(g["verificacion"]), "che": g["chequeo"].tolist(),
                "mon": lista(g["monitor"]), "falla": g["falla"].astype(bool).tolist()} for e, g in iny.groupby("escenario", sort=False)}

# ---------------------------------------------------------------- pregunta 5
D["p5"] = leer(TAB / "serie2_resumen_p5.json")

html = (ROOT / "docs/serie2_template.html").read_text(encoding="utf-8")
out = html.replace("/*__DATA__*/null", json.dumps(D, ensure_ascii=False))
(ROOT / "docs/serie2_explicacion.html").write_text(out, encoding="utf-8")
print("ok", len(out), "bytes")
