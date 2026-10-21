import { figura } from "@/lib/base";
import s from "./Figura.module.css";

/**
 * Figura con título, nota de lectura y fuente. El número va dentro del título ("Figura 3. El margen anual llega a su
 * máximo con 4 cortes"), porque el texto la cita; ya no es un rótulo aparte. La fuente dice de qué notebook o archivo
 * sale, para que cualquiera pueda revisar el dato. Anchos: texto = 7 columnas, medio = 8, total = 12.
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
    <figure className={`${s.figura} ${s[ancho]}`} data-entrada="">
      <figcaption className={s.titulo}>
        {numero !== undefined && <>Figura {numero}. </>}
        {titulo}
      </figcaption>
      <div className={s.cuerpo}>{children}</div>
      {nota && <p className={s.nota}>{nota}</p>}
      {fuente && <p className={s.fuente}>Fuente: {fuente}</p>}
    </figure>
  );
}

/** Imagen exportada por un notebook (outputs/figures). Sin marco: el PNG ya trae su fondo blanco. */
export function ImagenNotebook({ nombre, alt }: { nombre: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={figura(nombre)} alt={alt} loading="lazy" className={s.imagen} />;
}
