import { num } from "@/lib/formato";
import s from "./TrazoPortada.module.css";

const HORAS = [0, 6, 12, 18, 24];
const ALTO = 100;

/**
 * La idea de la página a la vista, bajo la cifra de la portada: el vapor medido y el estimado sin el medidor, minuto a
 * minuto, en un día que el modelo no vio. Las dos líneas casi se tapan: el vapor ya se mide dos veces.
 *
 * Blanco sobre el campo de la serie, sin ejes (la escala va en el pie y la gráfica completa es la figura 5). SVG hecho
 * en el servidor, sin script: el viewBox va en minutos del día (0-1440) y se estira al ancho de la columna; el grosor de
 * las líneas no se estira (vector-effect). Solo desde 900 px: en pantallas angostas la pieza cae bajo el meta y la misma
 * gráfica está, completa, en la figura 5.
 */
export function TrazoPortada({ puntos, dia }: { puntos: { h: number; med: number; est: number }[]; dia: string }) {
  const valores = puntos.flatMap((p) => [p.med, p.est]);
  const bajo = Math.min(...valores);
  const alto = Math.max(...valores);
  const y = (v: number) => (((alto - v) / (alto - bajo)) * ALTO).toFixed(1);
  const trazo = (clave: "med" | "est") =>
    puntos.map((p, i) => `${i ? "L" : "M"}${Math.round(p.h * 60)} ${y(p[clave])}`).join("");
  return (
    <figure className={s.trazo}>
      <ul className={s.leyenda} aria-hidden="true">
        <li><span className={`${s.muestra} ${s.muestraMedido}`} />Medido</li>
        <li><span className={`${s.muestra} ${s.muestraEstimado}`} />Estimado sin el medidor</li>
      </ul>
      <svg
        className={s.grafica}
        viewBox={`0 -4 1440 ${ALTO + 8}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Vapor medido y estimado sin el medidor, minuto a minuto, el ${dia}: las dos líneas casi se tapan.`}
      >
        <path className={s.medido} d={trazo("med")} />
        <path className={s.estimado} d={trazo("est")} />
      </svg>
      <div className={s.horas} aria-hidden="true">
        {HORAS.map((h) => (
          <span key={h} style={{ left: `${(h / 24) * 100}%` }}>{`${String(h).padStart(2, "0")}:00`}</span>
        ))}
      </div>
      <figcaption className={s.pie}>
        El {dia}, un día que el modelo no vio: el vapor va de {num(bajo, 0)} a {num(alto, 0)}&nbsp;t/h y las dos líneas
        casi se tapan. <a href="#vapor">Ver la figura 5</a>
      </figcaption>
    </figure>
  );
}
