"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { num, usd } from "@/lib/formato";
import s from "./Graficos.module.css";

// Gráficas de la página de la caldera. Reciben los datos ya filtrados desde la página (componente de servidor).
// Las fechas llegan como minutos desde 1970 en UTC: así la hora que se ve es la de los datos, sin zona horaria.

const dos = (n: number) => String(n).padStart(2, "0");
const aFecha = (m: number) => new Date(m * 60000);
const diaMes = (d: Date) => `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}`;
const horaMin = (d: Date) => `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`;
const fechaHora = (d: Date) => `${diaMes(d)} ${horaMin(d)}`;
const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Leyenda corta en HTML, para no depender del color: cada entrada dice qué es. */
export function Leyenda({ items }: { items: { texto: string; color: string; forma?: "linea" | "area" | "punto" }[] }) {
  return (
    <ul className={s.leyenda}>
      {items.map((x) => (
        <li key={x.texto}>
          <span className={`${s.muestra} ${s[x.forma ?? "linea"]}`} style={{ background: x.color }} aria-hidden="true" />
          {x.texto}
        </li>
      ))}
    </ul>
  );
}

/* ── Pregunta 2 ──────────────────────────────────────────────────────────── */

export function GraficoZonas({
  puntos, zonas,
}: {
  puntos: { m: number; v: number; z: string }[];
  zonas: { zona: string; vapor: number }[];
}) {
  const datos = puntos.map((p) => ({ t: aFecha(p.m), v: p.v, z: p.z }));
  const inicio = datos[0].t;
  const fin = datos[datos.length - 1].t;
  const orden = zonas.map((z) => z.zona);
  const margenes = (ancho: number) => ({ marginLeft: ancho < 600 ? 84 : 92, marginRight: ancho < 600 ? 12 : 116 });
  const vMin = Math.min(...datos.map((d) => d.v));
  const vMax = Math.max(...datos.map((d) => d.v));
  return (
    <div>
      <PlotFigura
        alto={250}
        etiqueta={`Vapor de la caldera en promedios de 5 minutos durante cinco días. Se mueve de forma continua entre ${num(vMin, 0)} y ${num(vMax, 0)} t/h; las tres zonas de carga son cortes de ese continuo.`}
        crear={(ancho) => ({
          ...margenes(ancho),
          x: { type: "utc", ticks: "day", tickFormat: diaMes, label: null },
          y: { label: "Vapor (t/h)", grid: true },
          marks: [
            Plot.ruleY(zonas, { y: "vapor", stroke: COLORES.caldera, strokeDasharray: "4 3" }),
            Plot.lineY(datos, { x: "t", y: "v", stroke: COLORES.tinta2, strokeWidth: 0.9 }),
            // En pantallas angostas no hay margen a la derecha: la media de cada zona se rotula al inicio, sobre su línea,
            // con un halo blanco para leerse encima del vapor.
            ancho < 600
              ? Plot.text(zonas, { x: () => inicio, y: "vapor", text: (d) => `${d.zona}: ${num(d.vapor, 1)}`, textAnchor: "start", dx: 2, dy: -9, fill: COLORES.caldera, fontWeight: 600, stroke: COLORES.fondo, strokeWidth: 4, paintOrder: "stroke" })
              : Plot.text(zonas, { x: () => fin, y: "vapor", text: (d) => `${d.zona}: ${num(d.vapor, 1)}`, textAnchor: "start", dx: 6, fill: COLORES.caldera, fontWeight: 600 }),
            Plot.tip(datos, Plot.pointerX({ x: "t", y: "v", title: (d) => `${fechaHora(d.t)}\n${num(d.v, 1)} t/h · ${d.z}` })),
          ],
        })}
      />
      <PlotFigura
        alto={96}
        etiqueta="Zona de carga de cada ventana de 5 minutos. La caldera cambia de zona a cada rato: son zonas por las que pasa, no estados en los que se queda."
        crear={(ancho) => ({
          ...margenes(ancho),
          marginTop: 6,
          marginBottom: 26,
          x: { type: "utc", ticks: "day", tickFormat: diaMes, label: null },
          y: { domain: orden, label: null },
          marks: [Plot.tickX(datos, { x: "t", y: "z", stroke: COLORES.caldera, strokeWidth: 1 })],
        })}
      />
    </div>
  );
}

export function GraficoLecho({ puntos, descargas }: { puntos: { m: number; p: number }[]; descargas: { a: number; b: number }[] }) {
  const datos = puntos.map((x) => ({ t: aFecha(x.m), p: x.p }));
  const tramos = descargas.map((d) => ({ a: aFecha(d.a), b: aFecha(d.b) }));
  return (
    <>
      <Leyenda items={[
        { texto: "Diferencial del lecho (cuánto material hay en el fondo)", color: COLORES.tinta },
        { texto: "Descarga de ceniza de fondo", color: COLORES.caldera, forma: "area" },
      ]} />
      <PlotFigura
        alto={280}
        etiqueta={`Diferencial de presión del lecho durante cinco días: sube despacio mientras se acumula ceniza y cae rápido en cada descarga, ${tramos.length} veces.`}
        crear={() => ({
          marginLeft: 60,
          x: { type: "utc", ticks: "day", tickFormat: diaMes, label: null },
          y: { label: "Diferencial del lecho (Pa)", grid: true },
          marks: [
            Plot.rect(tramos, { x1: "a", x2: "b", fill: COLORES.caldera, fillOpacity: 0.18 }),
            Plot.lineY(datos, { x: "t", y: "p", stroke: COLORES.tinta, strokeWidth: 1.1 }),
            Plot.tip(datos, Plot.pointerX({ x: "t", y: "p", title: (d) => `${fechaHora(d.t)}\n${num(d.p, 0)} Pa` })),
          ],
        })}
      />
    </>
  );
}

export function GraficoRezago({ rezagos, r }: { rezagos: number[]; r: number[] }) {
  const datos = rezagos.map((k, i) => ({ k, r: r[i] }));
  const pico = datos.filter((d) => d.k > 0).reduce((a, b) => (b.r < a.r ? b : a));
  const kMin = Math.min(...rezagos);
  const kMax = Math.max(...rezagos);
  return (
    <PlotFigura
      alto={300}
      etiqueta={`Correlación entre cambios de 1 minuto del agua de atemperación y de la temperatura del vapor, según el rezago. El mínimo es ${num(pico.r, 2)} a los ${pico.k} minutos: más agua enfría el vapor unos ${pico.k} minutos después.`}
      crear={(ancho) => {
        // Angosto: los dos rótulos de sentido se enciman con el del mínimo; el sentido pasa al rótulo del eje.
        const angosto = ancho < 600;
        return {
          marginLeft: 52,
          x: { label: angosto ? "Rezago (min); negativo: el vapor cambia antes" : "Rezago (min)", grid: false },
          y: { label: "Correlación de cambios de 1 min", grid: true },
          marks: [
            Plot.ruleY([0], { stroke: COLORES.tinta2 }),
            Plot.ruleX([0], { stroke: COLORES.contexto, strokeDasharray: "3 3" }),
            Plot.lineY(datos, { x: "k", y: "r", stroke: COLORES.contexto, strokeWidth: 1.5 }),
            Plot.dot(datos, { x: "k", y: "r", r: 2.2, fill: COLORES.contexto }),
            Plot.dot([pico], { x: "k", y: "r", r: 5, fill: COLORES.caldera }),
            Plot.text([pico], { x: "k", y: "r", text: (d) => `${num(d.r, 2)} a los ${d.k} min`, dx: 9, textAnchor: "start", fill: COLORES.caldera, fontWeight: 600 }),
            angosto ? null : Plot.text(["← el vapor cambia antes"], { x: () => kMin, text: (d) => d, frameAnchor: "bottom", dy: -6, textAnchor: "start", fill: COLORES.tinta2 }),
            angosto ? null : Plot.text(["el agua cambia antes →"], { x: () => kMax, text: (d) => d, frameAnchor: "bottom", dy: -6, textAnchor: "end", fill: COLORES.tinta2 }),
          ],
        };
      }}
    />
  );
}

/* ── Pregunta 3 ──────────────────────────────────────────────────────────── */

export function GraficoHidraulico({ puntos, a, b }: { puntos: { x: number; y: number }[]; a: number; b: number }) {
  const xs = puntos.map((p) => p.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const recta = [{ x: x0, y: a + b * x0 }, { x: x1, y: a + b * x1 }];
  return (
    <>
      <Leyenda items={[
        { texto: "Un minuto medido", color: COLORES.tinta2, forma: "punto" },
        { texto: "Recta ajustada con los cinco días", color: COLORES.caldera },
      ]} />
      <PlotFigura
        alto={300}
        etiqueta={`Vapor medido contra la raíz de la caída de presión por la densidad del vapor, en ${puntos.length} minutos. Los puntos caen sobre una recta: la caída de presión ya mide el flujo.`}
        crear={() => ({
          marginLeft: 52,
          x: { label: "√(ΔP·ρ) del sobrecalentador (relativo)", tickFormat: ".3f", ticks: 5 },
          y: { label: "Vapor medido (t/h)", grid: true },
          marks: [
            Plot.dot(puntos, { x: "x", y: "y", r: 2.6, fill: COLORES.tinta2, fillOpacity: 0.55 }),
            Plot.line(recta, { x: "x", y: "y", stroke: COLORES.caldera, strokeWidth: 2 }),
          ],
        })}
      />
    </>
  );
}

export function GraficoModelos({ filas }: { filas: { modelo: string; mae: number; mape: number; elegido: boolean }[] }) {
  const maximo = Math.max(...filas.map((f) => f.mae));
  return (
    <PlotFigura
      // Alta como la figura del modelo hidráulico (leyenda + 300 px), que va a su lado: así las dos arrancan y terminan juntas.
      alto={324}
      etiqueta="Error típico de cada modelo en días que no vio. El Ridge completo es el menor; el gradient boosting queda peor que el modelo físico de una variable."
      crear={(ancho) => {
        const angosto = ancho < 600;
        // En pantallas angostas solo cabe el error en t/h; el porcentaje está en la nota y en las cifras.
        const rotulo = (d: { mae: number; mape: number }) => (angosto ? `${num(d.mae, 2)} t/h` : `${num(d.mae, 2)} t/h · ${num(d.mape, 2)} %`);
        return {
        marginLeft: angosto ? 142 : 170,
        marginRight: 16,
        x: { label: "Error típico en días no vistos (MAE, t/h)", grid: true, domain: [0, maximo * (angosto ? 1.45 : 1.3)], ticks: angosto ? 3 : 6 },
        y: { label: null, domain: [...filas].sort((p, q) => p.mae - q.mae).map((f) => f.modelo) },
        marks: [
          Plot.barX(filas, { x: "mae", y: "modelo", fill: (d) => (d.elegido ? COLORES.caldera : COLORES.contexto) }),
          Plot.ruleX([0], { stroke: COLORES.tinta }),
          Plot.text(filas.filter((f) => !f.elegido), { x: "mae", y: "modelo", text: rotulo, dx: 6, textAnchor: "start", fill: COLORES.tinta2 }),
          Plot.text(filas.filter((f) => f.elegido), { x: "mae", y: "modelo", text: rotulo, dx: 6, textAnchor: "start", fill: COLORES.tinta, fontWeight: 600 }),
        ],
        };
      }}
    />
  );
}

export function GraficoMedidoEstimado({ puntos, dia }: { puntos: { h: number; med: number; est: number }[]; dia: string }) {
  const errores = puntos.map((p) => ({ h: p.h, e: p.est - p.med }));
  const ejeX = (ancho: number) => ({
    label: `Hora del ${dia}`,
    domain: [0, 24],
    ticks: ancho < 600 ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24],
    tickFormat: (h: number) => `${dos(h)}:00`,
  });
  const hora = (h: number) => `${dos(Math.floor(h))}:${dos(Math.round((h % 1) * 60))}`;
  return (
    <>
      <Leyenda items={[
        { texto: "Medido", color: COLORES.contexto },
        { texto: "Estimado por el Ridge completo", color: COLORES.caldera },
      ]} />
      <PlotFigura
        alto={250}
        etiqueta={`Vapor medido y estimado minuto a minuto el ${dia}, un día que el modelo no vio. Las dos líneas casi se tapan.`}
        crear={(ancho) => ({
          marginLeft: 52,
          marginBottom: 20,
          x: { ...ejeX(ancho), label: null, tickFormat: () => "" },
          y: { label: "Vapor (t/h)", grid: true },
          marks: [
            Plot.lineY(puntos, { x: "h", y: "med", stroke: COLORES.contexto, strokeWidth: 2.4 }),
            Plot.lineY(puntos, { x: "h", y: "est", stroke: COLORES.caldera, strokeWidth: 1 }),
            Plot.tip(puntos, Plot.pointerX({ x: "h", y: "med", title: (d) => `${hora(d.h)}\nmedido ${num(d.med, 2)} t/h\nestimado ${num(d.est, 2)} t/h` })),
          ],
        })}
      />
      <PlotFigura
        alto={150}
        etiqueta={`Diferencia entre el vapor estimado y el medido el ${dia}, en t/h. Oscila alrededor de cero.`}
        crear={(ancho) => ({
          marginLeft: 52,
          marginTop: 12,
          x: ejeX(ancho),
          y: { label: "Estimado − medido (t/h)", grid: true },
          marks: [
            Plot.ruleY([0], { stroke: COLORES.tinta }),
            Plot.lineY(errores, { x: "h", y: "e", stroke: COLORES.caldera, strokeWidth: 0.9 }),
          ],
        })}
      />
    </>
  );
}

/* ── Pregunta 5 ──────────────────────────────────────────────────────────── */

export function GraficoSerrucho({ puntos, pendiente, periodo }: { puntos: { m: number; v: number }[]; pendiente: number; periodo: number }) {
  const m0 = puntos[0].m;
  const datos = puntos.map((p) => ({ t: aFecha(p.m), v: p.v, dias: (p.m - m0) / 1440 }));
  const centro = media(datos.map((d) => d.v));
  const diasMedio = media(datos.map((d) => d.dias));
  const tendencia = datos.map((d) => ({ t: d.t, y: centro + pendiente * (d.dias - diasMedio) }));
  const ultimo = tendencia[tendencia.length - 1];
  return (
    <>
      <Leyenda items={[
        { texto: "Gases a igual carga y O₂ (promedio por hora)", color: COLORES.caldera },
        { texto: `Tendencia: ${num(pendiente, 2)} °C por día`, color: COLORES.tinta },
      ]} />
      <PlotFigura
        alto={290}
        etiqueta={`Temperatura de gases a la salida del economizador, a igual carga y O₂, por hora durante cinco días. Sube, cae de golpe con un pico cada ${num(periodo, 1)} horas, y su base sube ${num(pendiente, 2)} °C por día.`}
        crear={(ancho) => ({
          marginLeft: 52,
          marginRight: ancho < 600 ? 12 : 24,
          x: { type: "utc", ticks: "day", tickFormat: diaMes, label: null },
          y: { label: "°C sobre lo esperado", grid: true },
          marks: [
            Plot.ruleY([0], { stroke: COLORES.contexto }),
            Plot.lineY(datos, { x: "t", y: "v", stroke: COLORES.caldera, strokeWidth: 1.5 }),
            Plot.lineY(tendencia, { x: "t", y: "y", stroke: COLORES.tinta, strokeWidth: 2, strokeDasharray: "6 4" }),
            Plot.dot([ultimo], { x: "t", y: "y", r: 3, fill: COLORES.tinta }),
            Plot.tip(datos, Plot.pointerX({ x: "t", y: "v", title: (d) => `${fechaHora(d.t)}\n${num(d.v, 1)} °C sobre lo esperado` })),
          ],
        })}
      />
    </>
  );
}

export function GraficoOportunidades({
  filas, sinEstimar,
}: {
  filas: { nombre: string; bajo: number; medio: number; alto: number; destacado: boolean }[];
  sinEstimar: string;
}) {
  const orden = [...filas.map((f) => f.nombre), sinEstimar];
  const maximo = Math.max(...filas.map((f) => f.alto));
  const rotulo = (f: { bajo: number; medio: number; alto: number }) =>
    f.alto - f.bajo > 1 ? `${usd(f.bajo, 0)} a ${usd(f.alto, 0)}` : usd(f.medio, 0);
  const marcas = [
    Plot.ruleX([0], { stroke: COLORES.tinta }),
    Plot.ruleY(filas, { y: "nombre", x1: "bajo", x2: "alto", stroke: (d) => (d.destacado ? COLORES.caldera : COLORES.contexto), strokeWidth: 6 }),
    Plot.dot(filas, { y: "nombre", x: "medio", r: 5, fill: (d) => (d.destacado ? COLORES.caldera : COLORES.contexto), stroke: COLORES.tinta, strokeWidth: 0.5 }),
  ];
  const sinValor = "sin estimación: el valor está en la turbina";
  return (
    <PlotFigura
      alto={240}
      etiqueta="Valor anual de cada oportunidad de eficiencia con los supuestos declarados. La limpieza de superficies vale más que cualquier otra, aun en su cálculo más bajo; la temperatura del vapor no se puede estimar con estos datos."
      crear={(ancho) =>
        ancho < 600
          ? {
              // Angosto: el nombre va arriba de cada fila y el valor abajo, para que nada se salga del ancho.
              height: 380,
              marginLeft: 8,
              marginRight: 12,
              marginTop: 30,
              x: { label: "US$ al año", grid: true, domain: [0, maximo * 1.08], tickFormat: (d: number) => (d === 0 ? "0" : `${num(d / 1000, 0)} mil`), ticks: 3 },
              y: { label: null, domain: orden, axis: null },
              marks: [
                ...marcas,
                // Nombre arriba de la barra y valor abajo, con un respiro desde el eje para que no se monten en él.
                Plot.text(orden, { y: (d) => d, x: () => 0, text: (d) => d, dy: -19, dx: 6, textAnchor: "start", fill: COLORES.tinta, fontWeight: 600 }),
                Plot.text(filas, { y: "nombre", x: () => 0, text: rotulo, dy: 18, dx: 6, textAnchor: "start", fill: COLORES.tinta2 }),
                Plot.text([sinEstimar], { y: (d) => d, x: () => 0, text: () => sinValor, dy: 2, dx: 6, textAnchor: "start", fill: COLORES.tinta2 }),
              ],
            }
          : {
              // El rótulo más largo ("Limpieza: recuperar 10 °C de gases") mide ~235 px a 14 px: con 230 se salía
              // 10 px del marco de la página por la izquierda.
              marginLeft: 256,
              marginRight: 20,
              x: { label: "US$ al año", grid: true, domain: [0, maximo * 1.45], tickFormat: (d: number) => usd(d, 0), ticks: 5 },
              y: { label: null, domain: orden },
              marks: [
                ...marcas,
                Plot.text(filas, { y: "nombre", x: "alto", text: rotulo, dx: 10, textAnchor: "start", fill: COLORES.tinta }),
                Plot.text([sinEstimar], { y: (d) => d, x: () => 0, text: () => sinValor, dx: 8, textAnchor: "start", fill: COLORES.tinta2 }),
              ],
            }
      }
    />
  );
}
