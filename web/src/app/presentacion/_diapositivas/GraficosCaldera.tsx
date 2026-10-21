"use client";

import * as Plot from "@observablehq/plot";
import { COLORES } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";
import { GraficoD } from "./GraficoD";

// Gráficas de la caldera a la escala de la diapositiva. Reciben los datos ya filtrados desde la página.
// Las fechas llegan como minutos desde 1970 en UTC: así la hora que se ve es la de los datos, sin zona horaria.

const dos = (n: number) => String(n).padStart(2, "0");
const aFecha = (m: number) => new Date(m * 60000);
const diaMes = (d: Date) => `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}`;

/** Sensor virtual: vapor medido y estimado minuto a minuto en un día que el modelo no vio. */
export function GraficoVapor({ puntos, dia }: { puntos: { h: number; med: number; est: number }[]; dia: string }) {
  const ultimo = puntos[puntos.length - 1];
  return (
    <GraficoD
      dependencias={[puntos]}
      etiqueta={`Vapor medido y estimado minuto a minuto el ${dia}, un día que el modelo no vio. Las dos líneas casi se tapan.`}
      crear={({ u }) => ({
        marginTop: 1.4 * u,
        marginRight: 7.4 * u,
        marginBottom: 2.8 * u,
        marginLeft: 4.6 * u,
        x: {
          domain: [0, 24],
          ticks: [0, 3, 6, 9, 12, 15, 18, 21, 24],
          tickFormat: (h: number) => `${dos(h)}:00`,
          tickSize: 0,
          tickPadding: 0.8 * u,
          label: null,
        },
        y: { label: "t/h", labelArrow: "none", grid: true, ticks: 5, tickSize: 0, tickPadding: 0.6 * u, nice: true },
        insetBottom: 1 * u,
        marks: [
          Plot.lineY(puntos, { x: "h", y: "med", stroke: COLORES.contexto, strokeWidth: 0.42 * u }),
          Plot.lineY(puntos, { x: "h", y: "est", stroke: COLORES.caldera, strokeWidth: 0.12 * u }),
          Plot.text([ultimo], { x: "h", y: "med", dx: 0.8 * u, dy: -1.1 * u, textAnchor: "start", fill: COLORES.apagado, text: () => "Medido" }),
          Plot.text([ultimo], {
            x: "h", y: "est", dx: 0.8 * u, dy: 1.1 * u, textAnchor: "start", fill: COLORES.caldera, fontWeight: 600,
            text: () => "Estimado",
          }),
        ],
      })}
    />
  );
}

export type FilaValidacion = { modelo: string; azar: number; adelante: number; optimismo: number };

/** Criterio: error del sensor virtual validado al azar (anillo) y hacia adelante por día (punto lleno). */
export function GraficoValidacion({ filas }: { filas: FilaValidacion[] }) {
  const tope = Math.ceil(Math.max(...filas.map((f) => f.adelante)) * 10 + 0.5) / 10;
  const primera = filas.slice(0, 1);
  const descripcion = filas.map((f) => `${f.modelo}: ${num(f.azar, 2)} t/h al azar y ${num(f.adelante, 2)} t/h hacia adelante`).join("; ");
  return (
    <GraficoD
      dependencias={[filas]}
      etiqueta={`La validación al azar promete menos error que el real en los tres modelos. ${descripcion}.`}
      crear={({ u }) => ({
        marginTop: 3 * u,
        marginRight: 1.6 * u,
        marginBottom: 4.4 * u,
        marginLeft: 18 * u,
        x: {
          domain: [0, tope],
          label: "Error medio en t/h",
          labelAnchor: "center",
          labelArrow: "none",
          labelOffset: 3.7 * u,
          grid: true,
          ticks: 4,
          tickSize: 0,
          tickPadding: 0.8 * u,
          tickFormat: (d: number) => num(d, 1),
        },
        y: { domain: filas.map((f) => f.modelo), axis: null, padding: 0.4 },
        marks: [
          Plot.ruleY(filas, { y: "modelo", x1: "azar", x2: "adelante", stroke: COLORES.contextoSuave, strokeWidth: 0.4 * u }),
          Plot.dot(filas, { y: "modelo", x: "azar", r: 0.6 * u, stroke: COLORES.apagado, strokeWidth: 0.16 * u, fill: COLORES.fondo }),
          Plot.dot(filas, { y: "modelo", x: "adelante", r: 0.65 * u, fill: COLORES.caldera }),
          Plot.text(filas, {
            y: "modelo", x: "azar", dx: -1.2 * u, textAnchor: "end", fill: COLORES.tinta, fontWeight: 600,
            text: (d: FilaValidacion) => `−${num(d.optimismo, 0)} %`,
          }),
          Plot.text(primera, { y: "modelo", x: "azar", dy: -1.6 * u, dx: 0.6 * u, textAnchor: "end", fill: COLORES.apagado, text: () => "al azar" }),
          Plot.text(primera, {
            y: "modelo", x: "adelante", dy: -1.6 * u, dx: -0.6 * u, textAnchor: "start", fill: COLORES.caldera, fontWeight: 600,
            text: () => "hacia adelante",
          }),
          Plot.text(filas, { y: "modelo", frameAnchor: "left", dx: -1 * u, textAnchor: "end", fill: COLORES.tinta, text: "modelo" }),
        ],
      })}
    />
  );
}

/** Modos: diferencial del lecho durante cinco días, con las descargas de ceniza sombreadas. */
export function GraficoLecho({ puntos, descargas }: { puntos: { m: number; p: number }[]; descargas: { a: number; b: number }[] }) {
  const datos = puntos.map((x) => ({ t: aFecha(x.m), p: x.p }));
  const tramos = descargas.map((d) => ({ a: aFecha(d.a), b: aFecha(d.b) }));
  return (
    <GraficoD
      dependencias={[puntos, descargas]}
      etiqueta={`Diferencial de presión del lecho durante cinco días: sube despacio mientras se acumula ceniza y cae rápido en cada descarga, ${tramos.length} veces.`}
      crear={({ u }) => ({
        marginTop: 1.4 * u,
        marginRight: 1 * u,
        marginBottom: 2.8 * u,
        marginLeft: 5.6 * u,
        x: { type: "utc", ticks: "day", tickFormat: diaMes, label: null, tickSize: 0, tickPadding: 0.8 * u },
        y: { label: "Pa", labelArrow: "none", grid: true, ticks: 5, tickSize: 0, tickPadding: 0.6 * u, tickFormat: (d: number) => num(d, 0) },
        insetTop: 1.6 * u,
        marks: [
          Plot.rect(tramos, { x1: "a", x2: "b", fill: COLORES.caldera, fillOpacity: 0.22 }),
          Plot.lineY(datos, { x: "t", y: "p", stroke: COLORES.tinta, strokeWidth: 0.12 * u }),
        ],
      })}
    />
  );
}

/** Eficiencia: gases a la salida del economizador a igual carga y O₂, por hora, con su tendencia. */
export function GraficoSerrucho({ puntos, pendiente }: { puntos: { m: number; v: number }[]; pendiente: number }) {
  const m0 = puntos[0].m;
  const datos = puntos.map((p) => ({ t: aFecha(p.m), v: p.v, dias: (p.m - m0) / 1440 }));
  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const centro = media(datos.map((d) => d.v));
  const diasMedio = media(datos.map((d) => d.dias));
  const tendencia = datos.map((d) => ({ t: d.t, y: centro + pendiente * (d.dias - diasMedio) }));
  const ultimo = tendencia[tendencia.length - 1];
  return (
    <GraficoD
      dependencias={[puntos, pendiente]}
      etiqueta={`Temperatura de gases a la salida del economizador, a igual carga y O₂, por hora durante cinco días. Sube y cae de golpe, y su base sube ${num(pendiente, 2)} °C por día.`}
      crear={({ u }) => ({
        marginTop: 1.4 * u,
        marginRight: 9 * u,
        marginBottom: 2.8 * u,
        marginLeft: 4.6 * u,
        x: { type: "utc", ticks: "day", tickFormat: diaMes, label: null, tickSize: 0, tickPadding: 0.8 * u },
        y: { label: "°C", labelArrow: "none", grid: true, ticks: 5, tickSize: 0, tickPadding: 0.6 * u },
        marks: [
          Plot.ruleY([0], { stroke: COLORES.contexto, strokeWidth: 0.1 * u }),
          Plot.lineY(datos, { x: "t", y: "v", stroke: COLORES.caldera, strokeWidth: 0.2 * u }),
          Plot.lineY(tendencia, { x: "t", y: "y", stroke: COLORES.tinta, strokeWidth: 0.24 * u }),
          Plot.text([ultimo], {
            x: "t", y: "y", dx: 0.8 * u, textAnchor: "start", fill: COLORES.tinta, fontWeight: 600,
            text: () => `+${num(pendiente, 1)} °C/día`,
          }),
        ],
      })}
    />
  );
}
