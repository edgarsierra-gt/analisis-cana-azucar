import { Fragment } from "react";
import { ImagenNotebook } from "@/components/Figura";
import { Desplegable } from "@/components/Nota";
import { archivoRepo } from "@/lib/base";
import s from "./campo.module.css";

/** Texto con rutas de archivo: permite cortar la línea después de "/" y "_" para que no desborde a 375 px. */
export function conCortes(texto: string): React.ReactNode {
  const partes = texto.split(/(?<=[/_])/);
  return partes.map((p, i) => (
    <Fragment key={i}>
      {p}
      {i < partes.length - 1 && <wbr />}
    </Fragment>
  ));
}

/** Hipótesis que descarté: qué creía y qué dato la descartó. */
export function Descartadas({ items }: { items: { id: string; hipotesis: React.ReactNode; motivo: React.ReactNode }[] }) {
  return (
    <div className={s.descartadas}>
      <p className="etiqueta">Hipótesis que descarté</p>
      <ul>
        {items.map((h) => (
          <li key={h.id}>
            <span className={s.id}>{h.id}</span>
            <div>
              <p className={s.hipotesis}>{h.hipotesis}</p>
              <p className={s.motivo}>{h.motivo}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Figuras PNG exportadas por un notebook, plegadas: son la referencia, no la gráfica principal. */
export function FigurasNotebook({ notebook, figuras }: { notebook: string; figuras: { nombre: string; alt: string }[] }) {
  return (
    <Desplegable titulo={`Figuras originales del notebook ${notebook}`}>
      <div className={s.galeria}>
        {figuras.map((f) => (
          <figure key={f.nombre}>
            <ImagenNotebook nombre={f.nombre} alt={f.alt} />
            <figcaption>outputs/figures/{f.nombre}.png</figcaption>
          </figure>
        ))}
      </div>
    </Desplegable>
  );
}

/** Línea final de una sección: notebook en GitHub y archivos de salida que respaldan las cifras. */
export function Fuentes({ notebook, archivo, salidas }: { notebook: string; archivo: string; salidas: string[] }) {
  return (
    <p className={s.fuentes}>
      <a href={archivoRepo(`notebooks/${archivo}`)}>Notebook {notebook} en GitHub</a>
      {" · "}
      {salidas.join(" · ")}
    </p>
  );
}

/** Clave de lectura de una gráfica, escrita: el color nunca es la única señal. Es un span: va dentro de la nota de una Figura. */
export function Clave({ items }: { items: { tipo: "lleno" | "hueco" | "gris" | "contexto" | "huecoContexto"; texto: string }[] }) {
  const clase = { lleno: s.muestra, hueco: s.muestraHueca, gris: s.muestraGris, contexto: s.muestraContexto, huecoContexto: s.muestraHuecaContexto };
  return (
    <span className={s.clave}>
      {items.map((x) => (
        <span key={x.texto}>
          <i className={clase[x.tipo]} aria-hidden="true" />
          {x.texto}
        </span>
      ))}
    </span>
  );
}
