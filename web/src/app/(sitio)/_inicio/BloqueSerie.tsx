import Link from "next/link";
import { Certeza, type NivelCerteza } from "@/components/Certeza";
import s from "./inicio.module.css";

/**
 * Una serie en la portada: la decisión del negocio, el hallazgo, sus cifras, lo que recomiendo, la certeza y el
 * enlace al caso. Las siete piezas ocupan siete filas del subgrid, así las tres columnas quedan alineadas.
 */
export function BloqueSerie({
  serie, rotulo, decision, hallazgo, cifras, recomiendo, certeza, enlace,
}: {
  serie: "campo" | "caldera" | "mercado";
  rotulo: string;
  decision: React.ReactNode;
  hallazgo: React.ReactNode;
  cifras: React.ReactNode;
  recomiendo: React.ReactNode;
  certeza: { nivel: NivelCerteza; motivo: React.ReactNode };
  enlace: { href: string; texto: string };
}) {
  return (
    <article className={s.serie} data-serie={serie}>
      <p className={`etiqueta ${s.rotulo}`}>{rotulo}</p>
      <div className={s.decision}>
        <p className={s.clave}>La decisión</p>
        <p>{decision}</p>
      </div>
      <h3 className={s.hallazgo}>{hallazgo}</h3>
      <div className={s.cifras}>{cifras}</div>
      <p className={s.recomiendo}>{recomiendo}</p>
      <div className={s.certeza}>
        <Certeza nivel={certeza.nivel} />
        <p>{certeza.motivo}</p>
      </div>
      <Link href={enlace.href} className={s.verCaso}>
        {enlace.texto} <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
