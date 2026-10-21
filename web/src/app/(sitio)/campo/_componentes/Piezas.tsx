import Link from "next/link";
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

/**
 * Hipótesis que descarté: qué creía y qué dato la descartó. El código de la bitácora (H1…H11) va al final, como cita,
 * no como rótulo: así se puede buscar en bitacora.md sin numerar la página.
 */
export function Descartadas({ items }: { items: { id: string; hipotesis: React.ReactNode; motivo: React.ReactNode }[] }) {
  return (
    <div className={s.descartadas}>
      <h4>Hipótesis que descarté</h4>
      <ul>
        {items.map((h) => (
          <li key={h.id}>
            <p className={s.hipotesis}>{h.hipotesis}</p>
            <p className={s.motivo}>
              {h.motivo} <span className={s.cita}>(bitácora {h.id})</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Figuras PNG exportadas por un notebook, en cuadrícula de dos: son la referencia, no la gráfica principal. */
export function FigurasNotebook({ notebook, figuras }: { notebook: string; figuras: { nombre: string; alt: string }[] }) {
  return (
    <div>
      <h4>Figuras originales del notebook {notebook}</h4>
      <div className={s.galeria}>
        {figuras.map((f) => (
          <figure key={f.nombre}>
            <ImagenNotebook nombre={f.nombre} alt={f.alt} />
            <figcaption>{conCortes(`outputs/figures/${f.nombre}.png`)}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

/** Archivos de salida que respaldan las cifras de una sección (dentro del detalle técnico). */
export function Salidas({ archivos }: { archivos: string[] }) {
  return (
    <p className={s.salidas}>
      Archivos que respaldan estas cifras: {conCortes(archivos.join(" · "))}.
    </p>
  );
}

/**
 * Un solo desplegable por sección con todo lo que sirve para verificar: método, tablas largas, hipótesis descartadas
 * y figuras del notebook. Va a todo el ancho del marco porque adentro hay tablas anchas y una galería de dos columnas.
 */
export function DetalleTecnico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className={s.detalle}>
      <Desplegable titulo={`Detalle técnico: ${titulo}`}>
        <div className={s.bloques}>{children}</div>
      </Desplegable>
    </div>
  );
}

/**
 * De punta a punta: cada análisis lleva a donde se puede usar (la herramienta del sitio que consulta la API), a la
 * consulta de la API que lo sirve y al notebook que lo produce.
 */
export function Verificar({
  titulo = "Para probarlo", herramienta, consultas, notebook, extra = [],
}: {
  titulo?: string;
  herramienta?: { href: string; texto: string };
  consultas?: string[];
  notebook: { numero: string; archivo: string };
  extra?: { href: string; texto: React.ReactNode }[];
}) {
  return (
    <div className={s.verificar}>
      <h3>{titulo}</h3>
      {herramienta && (
        <Link className="boton boton-sec" href={herramienta.href}>
          {herramienta.texto}
        </Link>
      )}
      <ul>
        {consultas && consultas.length > 0 && (
          <li>
            En la API:{" "}
            <Link href="/api#grupo-campo">
              {consultas.map((c, i) => (
                <Fragment key={c}>
                  {i > 0 && " y "}
                  <code>{c}</code>
                </Fragment>
              ))}
            </Link>
          </li>
        )}
        <li>
          <a href={archivoRepo(`notebooks/${notebook.archivo}`)}>Notebook {notebook.numero} en GitHub</a>
        </li>
        {extra.map((x) => (
          <li key={x.href}>
            <a href={x.href}>{x.texto}</a>
          </li>
        ))}
      </ul>
    </div>
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
