"""Genera docs/serie1_explicacion.html con cifras calculadas desde los datos (nada escrito a mano).

Uso (desde la raíz del repo):  python docs/build_serie1_explicacion.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from campo_data import load_raw, clean, identity_checks, check_varieties  # noqa: E402

raw = load_raw(ROOT / "data/raw/All_Genotypes_2010_onwards.csv")
df, log = clean(raw)
TESTIGOS = check_varieties(df)
df["TESTIGO"] = df["CLONE"].isin(TESTIGOS)
plot = (df.groupby(["TRIAL", "STAGE", "LOC", "PLANT_YEAR", "ENV", "CLONE", "CROP", "YEAR"], as_index=False)
          [["T_SPACRE", "TCA", "TRS_TON", "FIBER"]].mean())
plot["TESTIGO"] = plot["CLONE"].isin(TESTIGOS)
s5 = plot[plot["STAGE"] == 5].copy()
D = {"n_raw": len(raw), "n_clean": len(df), "checks": TESTIGOS}

# caída de socas (misma lógica que el notebook 01)
cruda = s5.groupby("CROP")["T_SPACRE"].mean(); cruda = cruda / cruda.loc[0]
base = s5[s5["CROP"] == 0][["TRIAL", "CLONE", "T_SPACRE"]].rename(columns={"T_SPACRE": "pc"})
w = s5.merge(base, on=["TRIAL", "CLONE"])
dentro = (w["T_SPACRE"] / w["pc"]).groupby(w["CROP"]).median()
m_aj = smf.ols("np.log(T_SPACRE) ~ C(ENV) + C(CLONE) + C(CROP)", data=s5).fit()
ef = m_aj.params.filter(like="C(CROP)"); ci = m_aj.conf_int().loc[ef.index]
D["decline"] = {"raw": cruda.round(4).tolist(), "within": dentro.round(4).tolist(),
                "adj": [1.0] + np.exp(ef).round(4).tolist(),
                "lo": [1.0] + np.exp(ci[0]).round(4).tolist(), "hi": [1.0] + np.exp(ci[1]).round(4).tolist(),
                "n": s5.groupby("CROP").size().tolist()}

# base de la calculadora: testigos en plantía, etapa 5
b = s5[s5["TESTIGO"] & (s5["CROP"] == 0)]
D["base"] = {"sugar": round(b["T_SPACRE"].mean(), 1), "tca": round(b["TCA"].mean(), 2)}

# embudo
fun = df.groupby("STAGE").agg(clones=("CLONE", "nunique"), locs=("LOC", "nunique"), trials=("TRIAL", "nunique"),
                              rows=("CLONE", "size"), cropmax=("CROP", "max")).reset_index()
D["funnel"] = [{k: int(v) for k, v in r.items()} | {"stage": int(r["STAGE"])} for r in fun.to_dict("records")]

# fila de ejemplo (etapa 5, HOCP14-885, soca 1)
ex = df[(df.STAGE == 5) & (df.CLONE == "HOCP14-885") & (df.CROP == 1) & df.POPN.notna()].iloc[0]
D["row"] = {k: (None if pd.isna(ex[k]) else (ex[k].item() if hasattr(ex[k], "item") else ex[k]))
            for k in ["CLONE", "YEAR", "STAGE", "LOC", "CROP", "REP", "T_SPACRE", "TRS_TON", "TCA", "POPN", "MSTWT", "FIBER"]}
rr = raw[(raw.CLONE == ex.CLONE) & (raw.YEAR == str(ex.YEAR)) & (raw.LOC == ex.LOC) & (raw.CROP == str(ex.CROP)) & (raw.REP == str(ex.REP))].iloc[0]
D["row_raw"] = ",".join(rr.tolist())

# fila corrupta de ejemplo
bad = raw["TRS_TON"].str.match(r"^\d+\s+")
cr = raw[bad & (raw.CLONE == "HOCP04-838") & (raw.YEAR == "2017") & (raw.LOC == "AFL")].iloc[0]
dec, trs = cr["TRS_TON"].split()
pre = ",".join(cr[["CLONE", "YEAR", "STAGE", "LOC", "CROP", "REP"]].tolist())
post = ",".join(cr[["TCA", "POPN", "MSTWT", "FIBER"]].tolist())
D["corrupt"] = {"n": int(bad.sum()), "share": round(bad.mean(), 4),
                "raw": f"{pre},<mark>{cr['T_SPACRE']}</mark>,<mark>{dec}&nbsp;&nbsp;&nbsp;&nbsp;{trs}</mark>,{post}",
                "fixed": f"{pre},<mark>{cr['T_SPACRE']}.{dec}</mark>,<mark>{trs}</mark>,{post}"}

ic = identity_checks(df)
D["units"] = {"median": round(float(ic["azucar"].median()), 4), "off2": int((ic["azucar"].sub(1).abs() > .02).sum())}
popn = pd.to_numeric(raw["POPN"].replace(".", np.nan), errors="coerce"); yr = raw["YEAR"].astype(int)
D["popn"] = [{"y": "2010-2019", "v": round(float(popn[yr < 2020].median()), 1)},
             {"y": "2020-2021", "v": round(float(popn[yr >= 2020].median()), 1)}]
D["fiber_cov"] = {"old": round(float(df.loc[df.YEAR < 2020, "FIBER"].notna().mean()), 3),
                  "new": round(float(df.loc[df.YEAR >= 2020, "FIBER"].notna().mean()), 3)}

g = plot[plot["TESTIGO"] & (plot["CROP"] == 0)].groupby("STAGE")[["TCA", "TRS_TON"]].mean()
D["stage"] = [{"stage": int(s), "tca": round(r.TCA, 2), "trs": round(r.TRS_TON, 1)} for s, r in g.iterrows()]
par = plot[plot["TESTIGO"] & (plot["CROP"] == 0)].groupby(["CLONE", "YEAR", "STAGE"])["TCA"].mean().unstack().dropna(subset=[2, 5])
D["infl"] = {"median": round(float((par[2] / par[5]).median()), 2), "pairs": len(par)}

an = sm.stats.anova_lm(smf.ols("T_SPACRE ~ C(ENV) + C(CLONE) + C(CROP)", data=s5).fit(), typ=1)
an["pct"] = 100 * an["sum_sq"] / an["sum_sq"].sum()
nombres = {"C(ENV)": "Localidad × año", "C(CLONE)": "Variedad", "C(CROP)": "Número de corte", "Residual": "Residual (ruido + interacciones)"}
D["anova"] = [{"name": nombres[k], "pct": round(v, 2)} for k, v in an["pct"].sort_values(ascending=False).items()]

anual = s5[s5["TESTIGO"]].groupby("YEAR")["T_SPACRE"].mean()
D["year"] = [{"year": int(k), "v": round(v, 0)} for k, v in anual.items()]

pc = plot[plot["CROP"] == 0].copy()
pc["rel"] = pc["T_SPACRE"] / pc.groupby("TRIAL")["T_SPACRE"].transform("mean")
con_soca = set(plot.loc[plot["CROP"] == 1, "TRIAL"])
sig = plot.loc[plot["CROP"] == 1, ["TRIAL", "CLONE"]].assign(sigue=True)
a = pc[pc["TRIAL"].isin(con_soca) & ~pc["TESTIGO"]].merge(sig, on=["TRIAL", "CLONE"], how="left").fillna({"sigue": False})
ta = a.groupby(["STAGE", "sigue"])["rel"].mean()
def avance(desde, hacia):
    x = pc[(pc["STAGE"] == desde) & ~pc["TESTIGO"] & (pc["PLANT_YEAR"] <= 2017)].copy()
    x["avanza"] = x["CLONE"].isin(set(plot.loc[plot["STAGE"] >= hacia, "CLONE"]))
    return x.groupby("avanza")["rel"].mean()
a23, a34 = avance(2, 3), avance(3, 4)
D["surv"] = [
    {"label": "Etapa 3: siguen a soca", "no": round(ta[(3, False)], 4), "yes": round(ta[(3, True)], 4)},
    {"label": "Etapa 4: siguen a soca", "no": round(ta[(4, False)], 4), "yes": round(ta[(4, True)], 4)},
    {"label": "Avanzan de etapa 2 a 3", "no": round(a23[False], 4), "yes": round(a23[True], 4)},
    {"label": "Avanzan de etapa 3 a 4", "no": round(a34[False], 4), "yes": round(a34[True], 4)},
]

# longevidad por clon (misma lógica que el notebook 01)
amb = m_aj.params.filter(like="C(ENV)")
amb.index = amb.index.str.replace(r"C\(ENV\)\[T\.(.*)\]", r"\1", regex=True)
s5["log_aj"] = np.log(s5["T_SPACRE"]) - s5["ENV"].map(amb).fillna(0.0)
eleg = s5.groupby("CLONE")["CROP"].nunique().loc[lambda s: s >= 3].index
lon = []
for clon, gg in s5[s5["CLONE"].isin(eleg)].groupby("CLONE"):
    r = smf.ols("log_aj ~ CROP", data=gg).fit(); lo, hi = r.conf_int().loc["CROP"]
    lon.append({"clone": clon, "ret": round(float(np.exp(r.params["CROP"])), 4), "lo": round(float(np.exp(lo)), 4),
                "hi": round(float(np.exp(hi)), 4), "n": len(gg), "cuts": int(gg["CROP"].max() + 1), "check": clon in TESTIGOS})
D["longev"] = lon

# evidencia vs desempeño
ref = s5[s5["TESTIGO"]].groupby(["TRIAL", "CROP"])[["T_SPACRE", "TCA"]].mean().add_suffix("_t")
z = s5.join(ref, on=["TRIAL", "CROP"])
z["d"] = z["T_SPACRE"] - z["T_SPACRE_t"]
z["dm"] = (z["T_SPACRE"] * .2 - 14 * z["TCA"]) - (z["T_SPACRE_t"] * .2 - 14 * z["TCA_t"])
cl = z.groupby("CLONE").agg(d=("d", "mean"), dm=("dm", "mean"), trials=("TRIAL", "nunique"), years=("YEAR", "nunique"), last=("CROP", "max"))
top = set(cl.sort_values("d", ascending=False).index[:3]) | {"L01-299", "HOCP96-540"}
D["evid"] = [{"clone": c, "d": round(r.d, 0), "trials": int(r.trials), "years": int(r.years), "last": int(r["last"]),
              "only_pc": bool(r["last"] == 0), "check": c in TESTIGOS, "label": c in top} for c, r in cl.iterrows()]
D["rho"] = round(float(cl[["d", "dm"]].corr("spearman").iloc[0, 1]), 3)
trs_med = float(s5["TRS_TON"].median())
D["ton"] = {"trs": round(trs_med, 1), "value": round(trs_med * 0.20, 2)}

# ---------------------------------------------------------------- Pregunta 1 (sale del notebook 02)
art = json.loads((ROOT / "outputs/models/serie1_curvas.json").read_text(encoding="utf-8"))
rec = pd.read_csv(ROOT / "outputs/tables/serie1_recomendacion.csv", index_col=0)
res_q1 = json.loads((ROOT / "outputs/tables/serie1_resumen_q1.json").read_text(encoding="utf-8"))
locs = pd.read_csv(ROOT / "outputs/tables/serie1_localidades.csv", index_col=0).sort_values("potencial", ascending=False)
amb = pd.read_csv(ROOT / "outputs/tables/serie1_ambientes_top.csv", index_col=0)
D["q1"] = {
    "core": [{"sugar": r["sugar"], "trs": r["trs"]} for r in art["curva_testigos"]],
    "core_checks": art["testigos_nucleo"], "ref": res_q1["referencia"], "summary": res_q1,
    "vars": [{"clone": c, "check": bool(r.testigo), "a": art["variedades"][c]["a"], "b": art["variedades"][c]["b"],
              "trs_rel": r.trs_rel, "last": int(r.ultimo_corte_medido), "anios": int(r.anios), "ensayos": int(r.ensayos),
              "plantia": r.plantia_vs_testigos, "retencion": r.retencion_vs_testigos, "rank": int(r["rank"]),
              "ciclo": int(r.ciclo_optimo), "margen": r.margen_anual, "ganancia": r.ganancia_vs_testigos,
              "p_top3": r.P_top3, "p_top1": r.P_top1, "g05": r.ganancia_p05, "g50": r.ganancia_mediana, "g95": r.ganancia_p95,
              "certeza": r.nivel_certeza_top3, "equilibrio": r.precio_equilibrio} for c, r in rec.iterrows()],
    "locs": [{"loc": l, "potencial": round(r.potencial, 1), "grupo": r.grupo, "anios": int(r.anios), "cv": round(r.cv_entre_anios, 4)}
             for l, r in locs.iterrows()],
    "amb": [{"clone": c, "bajo": r.mean_bajo, "medio": r.mean_medio, "alto": r.mean_alto,
             "n_bajo": int(r.size_bajo), "n_medio": int(r.size_medio), "n_alto": int(r.size_alto), "pendiente": r.pendiente}
            for c, r in amb.iterrows()],
}

# ---------------------------------------------------------------- Pregunta 2 (sale del notebook 03)
from scipy.stats import spearmanr  # noqa: E402

mp2 = json.loads((ROOT / "outputs/models/serie1_modelo_p2.json").read_text(encoding="utf-8"))
r2 = json.loads((ROOT / "outputs/models/serie1_resumen_p2.json").read_text(encoding="utf-8"))
val = pd.read_csv(ROOT / "outputs/tables/serie1_p2_validacion.csv")
v1 = val[val["escenario"] == 1].copy()
v1["G"] = v1["TRIAL"] + "|" + v1["YEAR"].astype(str)
clones = sorted(set(v1["CLONE"]) | set(mp2["variedades"]))
cidx = {c: i for i, c in enumerate(clones)}
grupos = []
for k, g in v1.groupby("G", sort=True):
    res = np.log(g["T_SPACRE"]) - np.log(g["Ridge"])
    rho = spearmanr(g["T_SPACRE"], g["Ridge"])[0] if len(g) >= 4 else np.nan
    grupos.append({"id": k, "loc": g["LOC"].iloc[0], "year": int(g["YEAR"].iloc[0]), "crop": int(g["CROP"].iloc[0]),
                   "plant": int(k.split("|")[2]), "nivel": round(float(np.exp(res.mean()) - 1), 4),
                   "rho": None if np.isnan(rho) else round(float(rho), 3),
                   "rows": [[cidx[c], round(float(r)), round(float(p))] for c, r, p in zip(g["CLONE"], g["T_SPACRE"], g["Ridge"])]})
lotes22 = pd.read_csv(ROOT / "outputs/tables/serie1_pronostico_2022_lotes.csv")
pl22 = pd.read_csv(ROOT / "outputs/tables/serie1_pronostico_2022_plantia.csv", index_col=0)
D["q2"] = {
    "model": mp2, "res": r2, "clones": clones, "grupos": grupos,
    "presencia": {loc: sorted(int(y) for y in g["YEAR"].unique()) for loc, g in s5.groupby("LOC")},
    "lotes22": [[r.LOC, r.TRIAL, r.CLONE, int(r.corte_2022), r.real_2021,
                 None if pd.isna(r.ventaja_2021) else r.ventaja_2021, r.pred, r.p10, r.p90] for r in lotes22.itertuples()],
    "plantia22": {loc: r.to_dict() for loc, r in pl22.iterrows()},
    "top3": [v["clone"] for v in sorted(D["q1"]["vars"], key=lambda v: v["rank"])[:3]],
}

# ---------------------------------------------------------------- Pregunta 3 (sale del notebook 04)
seg = pd.read_csv(ROOT / "outputs/tables/serie1_segmentos.csv", index_col=0)
D["q3"] = {
    "res": json.loads((ROOT / "outputs/models/serie1_resumen_p3.json").read_text(encoding="utf-8")),
    "vars": [{"clone": c, "grupo": r.grupo, "certeza": r.certeza, "cana": r["caña vs testigos %"], "trs": r["TRS vs testigos %"],
              "lon": r["caña por corte vs testigos %"], "sigma": r["σ interacción %"], "resp": r["respuesta al ambiente"],
              "gan": r.ganancia_p1, "rank": int(r.rank_p1), "ciclo": int(r.ciclo_p1), "anios": int(r.anios),
              "parcelas": int(r.parcelas), "fibra": None if pd.isna(r.fibra_dif_pp) else round(float(r.fibra_dif_pp), 2),
              "check": c in D["q1"]["core_checks"]} for c, r in seg.iterrows()],
}

# ---------------------------------------------------------------- Pregunta 4 (sale del notebook 05)
D["q4"] = {"res": json.loads((ROOT / "outputs/models/serie1_resumen_p4.json").read_text(encoding="utf-8"))}

html = (ROOT / "docs/serie1_template.html").read_text(encoding="utf-8")
out = html.replace("/*__DATA__*/null", json.dumps(D, ensure_ascii=False))
(ROOT / "docs/serie1_explicacion.html").write_text(out, encoding="utf-8")
print("ok", len(out), "bytes")
print(json.dumps({k: D[k] for k in ["base", "infl", "rho", "ton", "units", "popn", "fiber_cov"]}, ensure_ascii=False))
