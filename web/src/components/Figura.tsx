import { figura } from "@/lib/base";
import s from "./Figura.module.css";

/**
 * Figura numerada con título, nota de lectura y fuente. La fuente dice de qué notebook o archivo sale,
 * para que cualquiera pueda revisar el dato.
 */
export function Figura({
  numero, titulo, children, nota, fuente, ancho = "medio",
}: {
  numero?: number | string;
  titulo: React.ReactNode;
  children: React.ReactNode;
  nota?: React.ReactNode;
  fuente?: React.ReactNode;
  ancho?: "texto" | "medio" | "total";
}) {
  return (
    <figure className={`${s.figura} ${s[ancho]}`}>
      <figcaption className={s.cabeza}>
        {numero !== undefined && <span className={s.numero}>Figura {numero}</span>}
        <span className={s.titulo}>{titulo}</span>
      </figcaption>
      <div className={s.cuerpo}>{children}</div>
      {(nota || fuente) && (
        <div className={s.pie}>
          {nota && <p className={s.nota}>{nota}</p>}
          {fuente && <p className={s.fuente}>Fuente: {fuente}</p>}
        </div>
      )}
    </figure>
  );
}

/** Imagen exportada por un notebook (outputs/figures). */
export function ImagenNotebook({ nombre, alt }: { nombre: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={figura(nombre)} alt={alt} loading="lazy" className={s.imagen} />;
}
