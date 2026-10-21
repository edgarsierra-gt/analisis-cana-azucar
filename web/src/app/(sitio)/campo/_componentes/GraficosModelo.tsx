"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { conSigno, num, pct } from "@/lib/formato";

const halo = { stroke: "var(--papel)", strokeWidth: 3 } as const;

/* ── Error de cada modelo en los dos escenarios ───────────────────────────── */
type FilaModelo = { escenario: string; modelo: string; mae: number; mape: number; elegido: boolean };

export function GraficoModelos({ filas, modelos, escenarios }: { filas: FilaModelo[]; modelos: string[]; escenarios: string[] }) {
  const elegido = filas.filter((f) => f.elegido);
  return (
    <PlotFigura
      alto={modelos.length * escenarios.length * 26 + 90}
      etiqueta={`Error absoluto medio por parcela de seis modelos en dos escenarios de validación por zafra. ${elegido
        .map((f) => `${f.escenario}: Ridge ${num(f.mae)} lb/acre (${pct(f.mape, 1)})`)
        .join("; ")}. Random Forest y XGBoost quedan en el mismo rango; el agrónomo es el peor.`}
      crear={(ancho) => ({
        marginLeft: 108,
        marginRight: ancho < 560 ? 24 : 12,
        marginTop: 40,
        x: {
          label: ancho < 560 ? "MAE (lb/acre) · menos es mejor" : "Error absoluto medio (lb de azúcar por acre) · a la izquierda, mejor",
          grid: true, tickFormat: (d: number) => num(d), domain: [1450, 1900], ticks: ancho < 560 ? 4 : undefined,
        },
        y: { label: null, domain: modelos },
        fy: { label: null, domain: escenarios, axis: null, padding: 0.24 },
        marks: [
          // Título de cada escenario arriba de su panel
          Plot.text(escenarios, { fy: (d: string) => d, frameAnchor: "top-left", text: (d: string) => d, dx: -108, dy: -20, textAnchor: "start", fill: COLORES.tinta, fontWeight: 650 }),
          Plot.dot(filas, {
            fy: "escenario", y: "modelo", x: "mae", r: 5,
            fill: (d: FilaModelo) => (d.elegido ? COLORES.campo : COLORES.contexto),
            tip: true,
            title: (d: FilaModelo) => `${d.modelo} · ${d.escenario}\nMAE ${num(d.mae)} lb/acre\nError relativo ${pct(d.mape, 1)}`,
          }),
          Plot.text(filas.filter((f) => !f.elegido), {
            fy: "escenario", y: "modelo", x: "mae", text: (d: FilaModelo) => `${num(d.mae)} · ${pct(d.mape, 1)}`,
            dx: 10, textAnchor: "start", fill: COLORES.tinta2,
          }),
          Plot.text(elegido, {
            fy: "escenario", y: "modelo", x: "mae", text: (d: FilaModelo) => `${num(d.mae)} · ${pct(d.mape, 1)}`,
            dx: 10, textAnchor: "start", fill: COLORES.tinta, fontWeight: 650,
          }),
        ],
      })}
    />
  );
}

/* ── Diferencias de error con bootstrap pareado por finca-año ─────────────── */
type FilaComparacion = { comparacion: string; d: number; bajo: number; alto: number; real: boolean };

export function GraficoComparaciones({ filas }: { filas: FilaComparacion[] }) {
  const reales = filas.filter((f) => f.real).map((f) => f.comparacion);
  return (
    <PlotFigura
      alto={filas.length * 34 + 70}
      etiqueta={`Diferencia de error absoluto medio entre pares de modelos, con intervalo de 90 %. Solo ${reales.join(" y ")} tienen un intervalo que no cruza cero; las demás son empates.`}
      crear={(ancho) => ({
        marginLeft: ancho < 560 ? 150 : 156,
        marginRight: ancho < 560 ? 16 : 104,
        x: {
          label: ancho < 560 ? "Diferencia de MAE (lb/acre)" : "Diferencia de MAE (lb/acre) · negativo: el primero se equivoca menos",
          grid: true, tickFormat: (d: number) => (ancho < 560 ? num(d) : conSigno(d)), ticks: ancho < 560 ? 4 : undefined,
        },
        y: { label: null, domain: filas.map((f) => f.comparacion) },
        marks: [
          Plot.ruleX([0], { stroke: COLORES.tinta }),
          Plot.ruleY(filas, { y: "comparacion", x1: "bajo", x2: "alto", stroke: (d: FilaComparacion) => (d.real ? COLORES.campo : COLORES.contexto), strokeWidth: 2.5 }),
          Plot.dot(filas, {
            y: "comparacion", x: "d", r: 5, fill: (d: FilaComparacion) => (d.real ? COLORES.campo : COLORES.contexto),
            tip: true, title: (d: FilaComparacion) => `${d.comparacion}\n${conSigno(d.d, 1)} lb/acre\nIC90 ${conSigno(d.bajo, 1)} a ${conSigno(d.alto, 1)}`,
          }),
          // Rótulo escrito de cada comparación; en pantallas angostas lo dice la nota (cruza o no el cero)
          Plot.text(ancho < 560 ? [] : filas.filter((f) => f.real), {
            y: "comparacion", frameAnchor: "right", text: () => "diferencia real", dx: 100, textAnchor: "end", fill: COLORES.tinta, fontWeight: 650,
          }),
          Plot.text(ancho < 560 ? [] : filas.filter((f) => !f.real), {
            y: "comparacion", frameAnchor: "right", text: () => "empate", dx: 100, textAnchor: "end", fill: COLORES.tinta2,
          }),
        ],
      })}
    />
  );
}

/* ── Sesgo de cada zafra: el clima mueve a todo el programa ───────────────── */
type FilaZafra = { zafra: string; sesgo: number; cobertura: number | null; destacada: boolean };

export function GraficoZafras({ filas }: { filas: FilaZafra[] }) {
  const min = filas.reduce((a, b) => (b.sesgo < a.sesgo ? b : a));
  const max = filas.reduce((a, b) => (b.sesgo > a.sesgo ? b : a));
  return (
    <PlotFigura
      alto={340}
      etiqueta={`Mediana de real contra predicho en cada zafra de validación, de ${filas[0].zafra} a ${filas[filas.length - 1].zafra}. Va de ${conSigno(min.sesgo, 1)} % en ${min.zafra} a ${conSigno(max.sesgo, 1)} % en ${max.zafra}: el año mueve a todas las parcelas juntas.`}
      crear={(ancho) => ({
        marginLeft: 52,
        x: {
          label: ancho < 560 ? `Zafra que se predice (${filas[0].zafra} a ${filas[filas.length - 1].zafra})` : "Zafra que se predice", padding: 0.25, domain: filas.map((f) => f.zafra),
          tickFormat: (d: string) => (ancho < 560 ? d.slice(2) : d),
        },
        y: {
          label: "Real contra predicho, mediana de la zafra (%)", grid: true, tickFormat: (d: number) => conSigno(d),
          domain: [Math.floor(min.sesgo / 5) * 5 - 1, Math.ceil(max.sesgo / 5) * 5],
        },
        marks: [
          Plot.barY(filas, {
            x: "zafra", y: "sesgo", fill: (d: FilaZafra) => (d.destacada ? COLORES.campo : COLORES.contexto),
            tip: true,
            title: (d: FilaZafra) => `Zafra ${d.zafra}\nReal contra predicho: ${conSigno(d.sesgo, 1)} %${d.cobertura === null ? "" : `\nCasos dentro de la banda: ${pct(d.cobertura * 100)}`}`,
          }),
          Plot.ruleY([0], { stroke: COLORES.tinta }),
          Plot.text(filas.filter((f) => f.sesgo >= 0), { x: "zafra", y: "sesgo", text: (d: FilaZafra) => conSigno(d.sesgo, 1), dy: -9, fill: COLORES.tinta, ...halo }),
          Plot.text(filas.filter((f) => f.sesgo < 0), { x: "zafra", y: "sesgo", text: (d: FilaZafra) => conSigno(d.sesgo, 1), dy: 9, fill: COLORES.tinta, ...halo }),
        ],
      })}
    />
  );
}
