import { Certeza, type NivelCerteza } from "@/components/Certeza";
import s from "./inicio.module.css";

export type Recomendacion = {
  serie: "campo" | "caldera" | "mercado";
  nombre: string;
  /** La acción en una línea, en infinitivo. */
  accion: string;
  nivel: NivelCerteza;
  /** El matiz de la certeza: dónde baja, como "L15-306: media" (se lee junto a "Certeza alta"). */
  matiz: string;
};

/**
 * La pieza de la portada: las tres recomendaciones, una por serie, cada una con su certeza matizada. Cada fila lleva
 * al capítulo de su serie en esta misma página (#campo, #caldera, #mercado).
 */
export function Recomendaciones({ items }: { items: Recomendacion[] }) {
  return (
    <ul className={s.recomendaciones} aria-label="Lo que recomiendo">
      {items.map((r) => (
        <li key={r.serie} data-serie={r.serie}>
          <a href={`#${r.serie}`} className={s.recomendacion}>
            <span className={s.recSerie}>{r.nombre}</span>
            <span className={s.recAccion}>{r.accion}</span>
            <span className={s.recCerteza}>
              <Certeza nivel={r.nivel} />
              <span className={s.recMatiz}>{r.matiz}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
