"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { conSigno, num, pct } from "@/lib/formato";
import s from "./campo.module.css";

const halo = { stroke: "var(--fondo)", strokeWidth: 3 } as const;

/* ── Mapa caña contra calidad, un panel por grupo ─────────────────────────── */
type Variedad = { variedad: string; cana: number; trs: number; grupo: string; certeza: number; testigo: boolean };
type Grupo = { nombre: string; n: number; jaccard: number };

type Rotulo = { p: Variedad; dx: number; dy: number; ancla: "start" | "end" };

/**
 * Coloca los rótulos sin que se pisen: prueba a la derecha y a la izquierda del punto y, si choca con otro rótulo,
 * lo corre hacia arriba o hacia abajo de a 12 px. Trabaja en píxeles con el mismo marco que la gráfica.
 */
function colocarRotulos(miembros: Variedad[], texto: (p: Variedad) => string, ancho: number, alto: number,
  margen: { izq: number; der: number; arr: number; aba: number }, dx: [number, number], dy: [number, number]): Rotulo[] {
  const w = ancho - margen.izq - margen.der;
  const h = alto - margen.arr - margen.aba;
  const px = (x: number) => margen.izq + ((x - dx[0]) / (dx[1] - dx[0])) * w;
  const py = (y: number) => margen.arr + ((dy[1] - y) / (dy[1] - dy[0])) * h;
  // Los puntos del grupo también son obstáculos: un rótulo no debe tapar otro punto
  const cajas: { x0: number; x1: number; y0: number; y1: number }[] = miembros.map((p) => ({
    x0: px(p.cana) - 6, x1: px(p.cana) + 6, y0: py(p.trs) - 6, y1: py(p.trs) + 6,
  }));
  const choca = (c: { x0: number; x1: number; y0: number; y1: number }) =>
    cajas.some((b) => c.x0 < b.x1 && c.x1 > b.x0 && c.y0 < b.y1 && c.y1 > b.y0) || c.x0 < margen.izq || c.x1 > ancho - 8;
  const salida: Rotulo[] = [];
  for (const p of [...miembros].sort((a, b) => b.trs - a.trs)) {
    const largo = texto(p).length * 7.6; // 13 px: los códigos en mayúscula miden cerca de 7.6 px por carácter
    const x = px(p.cana);
    const y = py(p.trs);
    const lados: ("start" | "end")[] = x + 8 + largo < ancho - 8 ? ["start", "end"] : ["end", "start"];
    let elegido: Rotulo | null = null;
    for (const desplazamiento of [0, -12, 12, -24, 24, -36, 36]) {
      for (const ancla of lados) {
        const x0 = ancla === "start" ? x + 7 : x - 7 - largo;
        const caja = { x0, x1: x0 + largo, y0: y + desplazamiento - 6, y1: y + desplazamiento + 6 };
        if (!choca(caja)) { cajas.push(caja); elegido = { p, dx: ancla === "start" ? 7 : -7, dy: desplazamiento, ancla }; break; }
      }
      if (elegido) break;
    }
    salida.push(elegido ?? (lados[0] === "start" ? { p, dx: 7, dy: 0, ancla: "start" } : { p, dx: -7, dy: 0, ancla: "end" }));
  }
  return salida;
}

const MARGEN_PANEL = { izq: 40, der: 12, arr: 14, aba: 34 };
const ALTO_PANEL = 290;

function PanelGrupo({ grupo, puntos, dominioX, dominioY }: { grupo: Grupo; puntos: Variedad[]; dominioX: [number, number]; dominioY: [number, number] }) {
  const miembros = puntos.filter((p) => p.grupo === grupo.nombre);
  const firmes = miembros.filter((p) => p.certeza >= 0.6);
  const dudosas = miembros.filter((p) => p.certeza < 0.6);
  const rotulo = (p: Variedad) => `${p.variedad}${p.testigo ? " (T)" : ""}`;
  return (
    <div className={s.panel}>
      <p className={s.panelTitulo}>{grupo.nombre}</p>
      <p className={s.panelMeta}>
        {grupo.n} variedades · Jaccard {num(grupo.jaccard, 2)}
      </p>
      <PlotFigura
        alto={ALTO_PANEL}
        etiqueta={`Grupo ${grupo.nombre}: ${miembros.map((m) => `${m.variedad} (caña ${conSigno(m.cana, 1)} %, TRS ${conSigno(m.trs, 1)} %)`).join("; ")}.`}
        crear={(ancho) => ({
          marginLeft: MARGEN_PANEL.izq,
          marginRight: MARGEN_PANEL.der,
          marginTop: MARGEN_PANEL.arr,
          marginBottom: MARGEN_PANEL.aba,
          x: { domain: dominioX, label: "Caña en plantía vs testigos (%)", tickFormat: (d: number) => conSigno(d), ticks: 5 },
          y: { domain: dominioY, label: "TRS vs testigos (%)", tickFormat: (d: number) => conSigno(d), ticks: 5 },
          marks: [
            Plot.ruleX([0], { stroke: COLORES.contextoSuave }),
            Plot.ruleY([0], { stroke: COLORES.contextoSuave }),
            Plot.dot(puntos.filter((p) => p.grupo !== grupo.nombre), { x: "cana", y: "trs", r: 3, fill: COLORES.contextoSuave }),
            Plot.dot(firmes, { x: "cana", y: "trs", r: 5, fill: COLORES.campo, stroke: "var(--fondo)", strokeWidth: 1.5 }),
            Plot.dot(dudosas, { x: "cana", y: "trs", r: 4.5, fill: "var(--fondo)", stroke: COLORES.campo, strokeWidth: 2 }),
            ...colocarRotulos(miembros, rotulo, ancho, ALTO_PANEL, MARGEN_PANEL, dominioX, dominioY).map((r) =>
              Plot.text([r.p], { x: "cana", y: "trs", text: rotulo, dx: r.dx, dy: r.dy, textAnchor: r.ancla, fontSize: 13, fill: COLORES.tinta, ...halo }),
            ),
            Plot.tip(miembros, Plot.pointer({
              x: "cana", y: "trs",
              title: (p: Variedad) => `${p.variedad}${p.testigo ? " (testigo)" : ""}\nCaña ${conSigno(p.cana, 1)} % · TRS ${conSigno(p.trs, 1)} %\nCae junto con su grupo en ${pct(p.certeza * 100)} de las réplicas`,
            })),
          ],
        })}
      />
    </div>
  );
}

export function MapaGrupos({ puntos, grupos }: { puntos: Variedad[]; grupos: Grupo[] }) {
  const xs = puntos.map((p) => p.cana);
  const ys = puntos.map((p) => p.trs);
  const dominioX: [number, number] = [Math.floor(Math.min(...xs)) - 1, Math.ceil(Math.max(...xs)) + 1];
  const dominioY: [number, number] = [Math.floor(Math.min(...ys)) - 1, Math.ceil(Math.max(...ys)) + 1];
  return (
    <div className={s.multiples}>
      {grupos.map((g) => (
        <PanelGrupo key={g.nombre} grupo={g} puntos={puntos} dominioX={dominioX} dominioY={dominioY} />
      ))}
    </div>
  );
}

/* ── Separación de los grupos contra tablas sin estructura ────────────────── */
type FilaSilueta = { k: number; silueta: number; p50: number; p95: number; p: number };

export function GraficoSilueta({ filas }: { filas: FilaSilueta[] }) {
  const pmin = Math.min(...filas.map((f) => f.p));
  return (
    <PlotFigura
      alto={300}
      etiqueta={`Silueta de k-means para 2 a 7 grupos contra la de 200 tablas barajadas. Ningún número de grupos supera el percentil 95 del azar; el menor valor p es ${num(pmin, 3)}.`}
      crear={() => ({
        marginLeft: 48,
        x: { type: "band", label: "Número de grupos (k)", padding: 0.4 },
        y: { label: "Silueta (separación de los grupos)", grid: true, tickFormat: (d: number) => num(d, 2), domain: [0.2, 0.4] },
        marks: [
          Plot.barY(filas, { x: "k", y1: "p50", y2: "p95", fill: COLORES.contextoSuave }),
          Plot.tickY(filas, { x: "k", y: "p95", stroke: COLORES.tinta2, strokeWidth: 1.5 }),
          Plot.dot(filas, {
            x: "k", y: "silueta", r: 5, fill: COLORES.campo, stroke: "var(--fondo)", strokeWidth: 1.5,
            tip: true, title: (d: FilaSilueta) => `k = ${d.k}\nSilueta ${num(d.silueta, 3)}\nAzar: mediana ${num(d.p50, 3)}, percentil 95 ${num(d.p95, 3)}\np = ${num(d.p, 3)}`,
          }),
          Plot.text(filas, { x: "k", frameAnchor: "top", text: (d: FilaSilueta) => num(d.p, 3), dy: 2, fill: COLORES.tinta2, fontSize: 13 }),
        ],
      })}
    />
  );
}

/* ── Reproducibilidad de la partición al remuestrear ensayos ──────────────── */
type FilaAri = { k: number; ari: number; p10: number; p90: number; elegido: boolean };

export function GraficoReproducibilidad({ filas }: { filas: FilaAri[] }) {
  const elegido = filas.find((f) => f.elegido);
  return (
    <PlotFigura
      alto={300}
      etiqueta={`Reproducibilidad (ARI mediano y rango 10-90 %) de la partición para 2 a 7 grupos al remuestrear ensayos. ${elegido ? `Elegí k = ${elegido.k}, con ARI ${num(elegido.ari, 2)}.` : ""}`}
      crear={() => ({
        marginLeft: 48,
        x: { type: "band", label: "Número de grupos (k)", padding: 0.4 },
        y: { label: "Reproducibilidad (ARI)", grid: true, domain: [0, 1], tickFormat: (d: number) => num(d, 1) },
        marks: [
          Plot.ruleX(filas, { x: "k", y1: "p10", y2: "p90", stroke: (d: FilaAri) => (d.elegido ? COLORES.campo : COLORES.contexto), strokeWidth: 2.5 }),
          Plot.dot(filas, {
            x: "k", y: "ari", r: 5, fill: (d: FilaAri) => (d.elegido ? COLORES.campo : COLORES.contexto), stroke: "var(--fondo)", strokeWidth: 1.5,
            tip: true, title: (d: FilaAri) => `k = ${d.k}\nARI mediano ${num(d.ari, 2)}\nRango 10-90 %: ${num(d.p10, 2)} a ${num(d.p90, 2)}`,
          }),
          Plot.text(elegido ? [elegido] : [], { x: "k", y: "ari", text: (d: FilaAri) => `k = ${d.k} · ${num(d.ari, 2)}`, dx: 10, textAnchor: "start", fill: COLORES.tinta, fontWeight: 650, ...halo }),
        ],
      })}
    />
  );
}
