"use client";

import * as Plot from "@observablehq/plot";
import { useState } from "react";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";
import { Leyenda } from "./Graficos";
import s from "./SimuladorFallas.module.css";

export type EscenarioFalla = {
  nombre: string;
  real: string;
  /** minuto (UTC, desde 1970) de la primera fila del escenario */
  inicio: number;
  /** minutos desde el inicio */
  t: number[];
  /** verificación de sensores y monitor de proceso, en veces su umbral */
  ver: number[];
  mon: number[];
  fallaDesde: number;
  fallaHasta: number;
  /** chequeos que saltan, o "ninguno" */
  verificacion: string;
  /** variables que señala el monitor de proceso, o "no" si no salta */
  monitor: string;
  regla: string;
  minutos: number;
  diagnostico: string;
  acierta: boolean;
};

const dos = (n: number) => String(n).padStart(2, "0");
const etiquetaHora = (d: Date) =>
  d.getUTCHours() === 0 ? `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}` : `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`;

/**
 * Las cinco fallas inyectadas del notebook 09, una a la vez: qué capa responde y cuándo.
 * Verificación de sensores y monitor de proceso en "veces su umbral": por encima de 1 hay alarma si dura 5 min.
 */
export function SimuladorFallas({ escenarios, inicial = 0 }: { escenarios: EscenarioFalla[]; inicial?: number }) {
  const [i, setI] = useState(inicial);
  const e = escenarios[i];
  const datos = e.t.map((k, j) => ({ t: new Date((e.inicio + k) * 60000), ver: e.ver[j], mon: e.mon[j] }));
  const falla = [{ a: new Date((e.inicio + e.fallaDesde) * 60000), b: new Date((e.inicio + e.fallaHasta) * 60000) }];
  const tope = Math.max(3, ...e.ver, ...e.mon) * 1.05;

  return (
    <div className={s.simulador}>
      <div className={s.botonera} role="group" aria-label="Falla inyectada">
        {escenarios.map((x, k) => (
          <button key={x.nombre} type="button" className={s.opcion} aria-pressed={k === i} onClick={() => setI(k)}>
            <span className={s.tipo}>{x.real === "sensor" ? "Sensor" : "Equipo"}</span>
            {x.nombre}
          </button>
        ))}
      </div>

      <Leyenda items={[
        { texto: "Verificación de sensores (el chequeo más alto)", color: COLORES.caldera },
        { texto: "Monitor de proceso (T² o SPE)", color: COLORES.tinta },
        { texto: "Tiempo con la falla inyectada", color: COLORES.resalte, forma: "area" },
      ]} />
      <PlotFigura
        alto={300}
        dependencias={[i]}
        etiqueta={`${e.nombre}. Verificación de sensores y monitor de proceso en veces su umbral. Diagnóstico: ${e.diagnostico}.`}
        crear={() => ({
          marginLeft: 48,
          x: { type: "utc", ticks: "2 hours", tickFormat: etiquetaHora, label: null },
          y: { label: "Veces su umbral", grid: true, domain: [0, tope] },
          marks: [
            Plot.rect(falla, { x1: "a", x2: "b", fill: COLORES.resalte, fillOpacity: 0.22 }),
            Plot.ruleY([1], { stroke: COLORES.tinta, strokeDasharray: "5 4" }),
            Plot.text(["umbral"], { x: () => datos[0].t, y: () => 1, text: (d) => d, dy: -7, dx: 2, textAnchor: "start", fill: COLORES.tinta2 }),
            Plot.lineY(datos, { x: "t", y: "mon", stroke: COLORES.tinta, strokeWidth: 1.1 }),
            Plot.lineY(datos, { x: "t", y: "ver", stroke: COLORES.caldera, strokeWidth: 1.5 }),
          ],
        })}
      />

      <dl className={s.diagnostico} aria-live="polite">
        <div>
          <dt>Falla real</dt>
          <dd>{e.real === "sensor" ? "De sensor" : "De equipo (proceso)"}</dd>
        </div>
        <div>
          <dt>Verificación de sensores</dt>
          <dd>{e.verificacion === "ninguno" ? "No salta ningún chequeo" : `Salta: ${e.verificacion}`}</dd>
        </div>
        <div>
          <dt>Monitor de proceso</dt>
          <dd>{e.monitor === "no" ? "No salta" : `Salta: ${e.monitor}`}</dd>
        </div>
        <div>
          <dt>Primera alarma</dt>
          <dd>{e.minutos === 0 ? "En el mismo minuto en que empieza la falla" : `${num(e.minutos, 0)} min después de empezar la falla`}</dd>
        </div>
        <div className={s.veredicto}>
          <dt>Diagnóstico</dt>
          <dd>
            {e.diagnostico} · <strong>{e.acierta ? "correcto" : "incorrecto"}</strong>
          </dd>
        </div>
      </dl>
    </div>
  );
}
