"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { conSigno, num, usd } from "@/lib/formato";

const halo = { stroke: "var(--papel)", strokeWidth: 3 } as const;

/* ── Ganancia contra el testigo, con IC90 del bootstrap ─────────────────────── */
type FilaGanancia = { variedad: string; punto: number; p05: number; p95: number; top3: boolean; testigo: boolean };

export function GraficoGanancia({ filas }: { filas: FilaGanancia[] }) {
  const top = filas.filter((f) => f.top3);
  return (
    <PlotFigura
      alto={filas.length * 22 + 70}
      etiqueta={`Ganancia de ${filas.length} variedades contra el testigo núcleo promedio, con intervalo de 90 %. Encabezan ${top
        .map((f) => `${f.variedad} (${conSigno(f.punto)})`)
        .join(", ")} US$/acre/año. ${filas.filter((f) => f.p05 > 0).length} variedades tienen todo su intervalo por encima de cero; las dos siguientes se traslapan con la tercera.`}
      crear={(ancho) => ({
        marginLeft: 96,
        marginRight: 48,
        x: {
          label: ancho < 560 ? "Contra el testigo (US$/acre/año)" : "Ganancia contra el testigo núcleo promedio (US$/acre/año)",
          grid: true, tickFormat: (d: number) => conSigno(d),
        },
        y: { label: null, domain: filas.map((f) => f.variedad) },
        marks: [
          Plot.ruleX([0], { stroke: COLORES.tinta }),
          Plot.ruleY(filas, { y: "variedad", x1: "p05", x2: "p95", stroke: (d: FilaGanancia) => (d.top3 ? COLORES.campo : COLORES.contexto), strokeWidth: 2 }),
          Plot.dot(filas, {
            y: "variedad", x: "punto", r: 4.5,
            fill: (d: FilaGanancia) => (d.top3 ? COLORES.campo : d.testigo ? "var(--papel)" : COLORES.contexto),
            stroke: (d: FilaGanancia) => (d.top3 ? COLORES.campo : COLORES.contexto),
            strokeWidth: 1.5,
            tip: true,
            title: (d: FilaGanancia) =>
              `${d.variedad}${d.testigo ? " (testigo)" : ""}\n${conSigno(d.punto)} US$/acre/año\nIC90 ${conSigno(d.p05)} a ${conSigno(d.p95)}`,
          }),
          Plot.text(top, { y: "variedad", x: "p95", text: (d: FilaGanancia) => conSigno(d.punto), dx: 8, textAnchor: "start", fill: COLORES.tinta, fontWeight: 650 }),
        ],
      })}
    />
  );
}

/* ── Margen promedio anual según el número de cortes antes de renovar ───────── */
type PuntoCiclo = { serie: string; cortes: number; margen: number; destacada: boolean; optimo: boolean };

export function GraficoCiclo({ puntos }: { puntos: PuntoCiclo[] }) {
  const optimos = puntos.filter((p) => p.optimo);
  const finales = puntos.filter((p) => p.cortes === Math.max(...puntos.map((q) => q.cortes)));
  return (
    <PlotFigura
      alto={360}
      etiqueta={`Margen promedio anual si se renueva después de 1 a 5 cortes. ${optimos
        .map((p) => `${p.serie}: máximo con ${p.cortes} cortes, ${usd(p.margen, 1)}`)
        .join("; ")}. Con 5 cortes el margen baja poco.`}
      crear={(ancho) => ({
        marginLeft: 56,
        x: { ticks: [1, 2, 3, 4, 5], label: ancho < 560 ? "Cortes antes de renovar" : "Cortes antes de renovar (plantía + socas)", inset: 20, tickFormat: (d: number) => num(d) },
        y: { label: "Margen promedio anual (US$/acre/año)", grid: true, tickFormat: (d: number) => num(d), insetTop: 24 },
        marks: [
          Plot.ruleY([0], { stroke: COLORES.tinta }),
          Plot.lineY(puntos, { x: "cortes", y: "margen", z: "serie", stroke: (d: PuntoCiclo) => (d.destacada ? COLORES.campo : COLORES.contexto), strokeWidth: 2 }),
          Plot.dot(puntos, {
            x: "cortes", y: "margen", r: (d: PuntoCiclo) => (d.optimo ? 6 : 3.5),
            fill: (d: PuntoCiclo) => (d.destacada ? COLORES.campo : COLORES.contexto), stroke: "var(--papel)", strokeWidth: 1.5,
            tip: true,
            title: (d: PuntoCiclo) => `${d.serie}\nRenovar después de ${d.cortes} cortes: ${usd(d.margen, 1)}/acre/año`,
          }),
          Plot.text(optimos, { x: "cortes", y: "margen", text: (d: PuntoCiclo) => usd(d.margen, 1), dy: -16, fill: COLORES.tinta, fontWeight: 650, ...halo }),
          Plot.text(finales, { x: "cortes", y: "margen", text: "serie", dy: 18, textAnchor: "end", dx: 6, fill: COLORES.tinta2, ...halo }),
        ],
      })}
    />
  );
}

/* ── Margen del mejor ciclo contra el precio del azúcar ───────────────────── */
type PuntoPrecio = { serie: string; precio: number; margen: number; recomendada: boolean };
type Equilibrio = { serie: string; precio: number; recomendada: boolean };

export function GraficoPrecio({ puntos, equilibrios, precioCaso }: { puntos: PuntoPrecio[]; equilibrios: Equilibrio[]; precioCaso: number }) {
  const precios = puntos.map((p) => p.precio);
  const xmax = Math.max(...precios);
  const finRecomendadas = puntos.filter((p) => p.recomendada && p.precio === xmax).sort((a, b) => b.margen - a.margen)[0];
  const finTestigo = puntos.find((p) => !p.recomendada && p.precio === xmax);
  const eqRec = equilibrios.filter((e) => e.recomendada).map((e) => e.precio);
  const eqTestigo = equilibrios.find((e) => !e.recomendada);
  const formatoPrecio = (p: number) => `US$${p.toFixed(3)}`;
  return (
    <PlotFigura
      alto={400}
      etiqueta={`Margen anual del mejor ciclo según el precio del azúcar, de US$${Math.min(...precios).toFixed(2)} a US$${xmax.toFixed(2)} por libra. Las tres recomendadas quedan arriba del testigo en todo el rango. Su precio de equilibrio está entre ${formatoPrecio(Math.min(...eqRec))} y ${formatoPrecio(Math.max(...eqRec))}; el del testigo, ${eqTestigo ? formatoPrecio(eqTestigo.precio) : ""}.`}
      crear={(ancho) => ({
        marginLeft: 56,
        marginRight: 20,
        x: { label: "Precio del azúcar (US$/lb)", tickFormat: (d: number) => d.toFixed(2), grid: false },
        y: { label: "Margen anual del mejor ciclo (US$/acre/año)", grid: true, tickFormat: (d: number) => num(d), domain: [Math.min(-450, ...puntos.map((p) => p.margen)), Math.max(...puntos.map((p) => p.margen)) * 1.05] },
        marks: [
          Plot.ruleY([0], { stroke: COLORES.tinta }),
          Plot.ruleX([precioCaso], { stroke: COLORES.contexto }),
          Plot.text([precioCaso], { x: (d: number) => d, frameAnchor: "top", text: () => `${ancho < 560 ? "supuesto" : "supuesto del caso"}: US$${precioCaso.toFixed(2)}`, dy: 4, dx: -4, textAnchor: "end", fill: COLORES.tinta2, fontSize: 11 }),
          Plot.lineY(puntos, { x: "precio", y: "margen", z: "serie", stroke: (d: PuntoPrecio) => (d.recomendada ? COLORES.campo : COLORES.contexto), strokeWidth: 2 }),
          Plot.dot(puntos, {
            x: "precio", y: "margen", r: 2.5, fill: (d: PuntoPrecio) => (d.recomendada ? COLORES.campo : COLORES.contexto),
            tip: true, title: (d: PuntoPrecio) => `${d.serie}\nPrecio US$${d.precio.toFixed(2)}/lb\nMargen ${usd(d.margen)}/acre/año`,
          }),
          Plot.dot(equilibrios, { x: "precio", y: 0, r: 5, fill: "var(--papel)", stroke: (d: Equilibrio) => (d.recomendada ? COLORES.campo : COLORES.tinta2), strokeWidth: 2 }),
          // Rótulos de equilibrio bajo la línea de cero, donde a la derecha no pasa ninguna serie
          Plot.text(eqRec.length ? [Math.min(...eqRec)] : [], {
            x: (d: number) => d, y: 0, text: () => `Equilibrio de las tres: ${formatoPrecio(Math.min(...eqRec))} a ${formatoPrecio(Math.max(...eqRec))}`,
            dy: 32, dx: -6, textAnchor: "start", fill: COLORES.tinta, fontWeight: 600, ...halo,
          }),
          Plot.text(eqTestigo ? [eqTestigo] : [], {
            x: "precio", y: 0, text: (d: Equilibrio) => `Equilibrio del testigo: ${formatoPrecio(d.precio)}`, dy: 50, dx: -6, textAnchor: "start", fill: COLORES.tinta2, ...halo,
          }),
          Plot.text(finRecomendadas ? [finRecomendadas] : [], { x: "precio", y: "margen", text: () => "Las tres recomendadas", dy: -14, textAnchor: "end", fill: COLORES.tinta, fontWeight: 600, ...halo }),
          Plot.text(finTestigo ? [finTestigo] : [], { x: "precio", y: "margen", text: () => (ancho < 560 ? "Testigo" : "Testigo núcleo promedio"), dy: 16, textAnchor: "end", fill: COLORES.tinta2, ...halo }),
        ],
      })}
    />
  );
}

/* ── Ciclo óptimo a cada precio ───────────────────────────────────────────── */
type Celda = { serie: string; precio: number; ciclo: number; pierde: boolean };

export function GraficoCicloPrecio({ celdas, series, precioCaso }: { celdas: Celda[]; series: string[]; precioCaso: number }) {
  const opacidad: Record<number, number> = { 3: 0.14, 4: 0.36, 5: 0.62 };
  return (
    <PlotFigura
      alto={series.length * 40 + 64}
      etiqueta="Ciclo óptimo (cortes antes de renovar) de cada variedad a cada precio. Con precios altos conviene renovar antes y con precios bajos estirar a 5 cortes. Las celdas sin relleno y con asterisco marcan precios con los que ni el mejor ciclo cubre costos."
      crear={(ancho) => ({
        marginLeft: ancho < 560 ? 92 : 150,
        marginBottom: 40,
        x: {
          label: "Precio del azúcar (US$/lb)", tickFormat: (d: number) => d.toFixed(2), type: "band", padding: 0.08,
          ticks: ancho < 640 ? [...new Set(celdas.map((c) => c.precio))].filter((_, i) => i % 2 === 0) : undefined,
        },
        y: { label: null, domain: series, padding: 0.08, tickFormat: (d: string) => (ancho < 560 && d.startsWith("Testigo") ? "Testigo" : d) },
        marks: [
          Plot.cell(celdas, {
            x: "precio", y: "serie",
            fill: (d: Celda) => (d.pierde ? "var(--papel)" : COLORES.campo),
            fillOpacity: (d: Celda) => (d.pierde ? 1 : opacidad[d.ciclo] ?? 0.4),
            stroke: (d: Celda) => (d.pierde ? COLORES.contexto : d.precio === precioCaso ? COLORES.tinta : "none"),
            strokeWidth: 1.5,
            tip: true,
            title: (d: Celda) => `${d.serie} a US$${d.precio.toFixed(2)}/lb\n${d.ciclo} cortes${d.pierde ? "\nNi el mejor ciclo cubre costos" : ""}`,
          }),
          Plot.text(celdas, { x: "precio", y: "serie", text: (d: Celda) => (d.pierde ? `${d.ciclo}*` : `${d.ciclo}`), fill: COLORES.tinta, fontWeight: 600 }),
        ],
      })}
    />
  );
}

/* ── Ventaja según el potencial de la finca ───────────────────────────────── */
type PuntoAmbiente = { variedad: string; potencial: string; ventaja: number; papel: "mantiene" | "pierde" | "contexto" };

export function GraficoAmbientes({ puntos, orden }: { puntos: PuntoAmbiente[]; orden: string[] }) {
  const color = (p: PuntoAmbiente["papel"]) => (p === "mantiene" ? COLORES.campo : p === "pierde" ? COLORES.resalte : COLORES.contexto);
  const finales = puntos.filter((p) => p.potencial === orden[orden.length - 1] && p.papel !== "contexto");
  return (
    <PlotFigura
      alto={360}
      etiqueta={`Ventaja de ${new Set(puntos.map((p) => p.variedad)).size} variedades sobre los testigos núcleo en ambientes de potencial bajo, medio y alto. ${[...new Set(puntos.filter((p) => p.papel === "mantiene").map((p) => p.variedad))].join(", ")} mantiene o aumenta su ventaja en los de potencial alto; ${[...new Set(puntos.filter((p) => p.papel === "pierde").map((p) => p.variedad))].join(" y ")} la reducen.`}
      crear={(ancho) => ({
        marginLeft: 52,
        marginRight: 136,
        x: { type: "point", domain: orden, label: "Potencial del ambiente (finca y año)", inset: 24, tickFormat: (d: string) => (ancho < 560 ? d : `Potencial ${d}`) },
        y: { label: "Ventaja sobre los testigos núcleo (%)", grid: true, tickFormat: (d: number) => conSigno(d) },
        marks: [
          Plot.ruleY([0], { stroke: COLORES.tinta }),
          Plot.lineY(puntos.filter((p) => p.papel === "contexto"), { x: "potencial", y: "ventaja", z: "variedad", stroke: COLORES.contexto, strokeWidth: 1.5 }),
          Plot.lineY(puntos.filter((p) => p.papel !== "contexto"), { x: "potencial", y: "ventaja", z: "variedad", stroke: (d: PuntoAmbiente) => color(d.papel), strokeWidth: 2.5 }),
          Plot.dot(puntos, {
            x: "potencial", y: "ventaja", r: 3.5, fill: (d: PuntoAmbiente) => color(d.papel),
            tip: true, title: (d: PuntoAmbiente) => `${d.variedad}\nPotencial ${d.potencial}: ${conSigno(d.ventaja, 1)} %`,
          }),
          Plot.text(finales, { x: "potencial", y: "ventaja", text: (d: PuntoAmbiente) => `${d.variedad} ${conSigno(d.ventaja, 1)} %`, dx: 8, textAnchor: "start", fill: COLORES.tinta, ...halo }),
        ],
      })}
    />
  );
}
