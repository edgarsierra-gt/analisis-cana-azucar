import { isValidElement } from "react";
import s from "./Portada.module.css";

type Serie = "campo" | "caldera" | "mercado";
type Fondo = "serie" | "tinte" | "tinta" | "blanco";

/**
 * Primer pantallazo de una página: el título (h1 de 38 caracteres o menos), la entrada (25 palabras o menos), la acción
 * y, a la derecha, la pieza que domina la pantalla: la cifra que responde, el gráfico principal o la cosa viva.
 *
 * Fondo (`fondo`):
 * - "serie" (predeterminado con `serie`): campo del color de la serie a todo el ancho, con el texto en blanco (≥ 5.4:1).
 * - "tinta" (predeterminado sin `serie`): campo de tinta con el texto en blanco.
 * - "tinte": el tinte claro de la serie con el texto en tinta y la cifra en el color de la serie.
 * - "blanco": sin campo.
 *
 * Rejilla de 12 columnas: título, entrada y acciones en 1-7. Con `pieza`, la pieza va en 8-12, alineada arriba con el
 * h1, y el meta bajo la entrada. Sin pieza, el meta ocupa las columnas 9-12 como lista vertical: la columna derecha
 * nunca queda vacía. Sobre un campo de color, una pieza que no sea <CifraPortada> (una gráfica, la cosa viva) va en un
 * panel blanco para que conserve sus colores; `piezaPanel` lo fuerza o lo quita.
 *
 * `etiqueta` se acepta por compatibilidad pero no se pinta (rótulo sobre el título). `children` va al final, a todo el
 * ancho; sobre un campo va en un panel blanco (por ejemplo, el estado en vivo de la API).
 */
export function Portada({
  titulo, entrada, serie, meta = [], pieza, piezaPanel, acciones, fondo, children,
}: {
  /** @deprecated Ya no se pinta: la serie la dicen el menú activo, el color y el propio h1. Se borra en el punto 2. */
  etiqueta?: string;
  titulo: React.ReactNode;
  entrada?: React.ReactNode;
  /** Color de la portada. Si la página ya tiene data-serie en su contenedor, conviene pasarlo igual aquí. */
  serie?: Serie;
  meta?: { clave: string; valor: React.ReactNode }[];
  /** La pieza dominante de la derecha (cifra, gráfica o cosa viva). Ver <CifraPortada> para la cifra. */
  pieza?: React.ReactNode;
  /** Panel blanco detrás de la pieza. Por omisión: sí sobre un campo de color, salvo para <CifraPortada>. */
  piezaPanel?: boolean;
  /** Acción principal (un <Link className="boton">) y, si hace falta, un enlace de texto. */
  acciones?: React.ReactNode;
  fondo?: Fondo;
  children?: React.ReactNode;
}) {
  const modo: Fondo = fondo ?? (serie ? "serie" : "tinta");
  const sobreCampo = modo === "serie" || modo === "tinta";
  const esCifra = isValidElement(pieza) && pieza.type === CifraPortada;
  const conPanel = piezaPanel ?? (sobreCampo && !esCifra);

  const datos = meta.length > 0 && (
    <dl className={`${s.meta} ${s.propio} ${pieza ? s.metaJunto : s.metaLado}`}>
      {meta.map((m) => (
        <div key={m.clave}>
          <dt>{m.clave}</dt>
          <dd>{m.valor}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <section
      className={`${s.portada} ${s[modo]} ${pieza ? s.conPieza : ""}`}
      data-serie={serie}
      data-fondo={modo}
    >
      <div className={`contenedor ${s.rejilla}`}>
        <div className={`${s.texto} ${s.propio}`}>
          <h1 className={s.titulo}>{titulo}</h1>
          {entrada && <div className={`entrada ${s.entrada}`}>{entrada}</div>}
          {acciones && <div className={s.acciones}>{acciones}</div>}
          {pieza && datos}
        </div>
        {pieza && <div className={`${s.pieza} ${conPanel ? s.panel : s.propio}`}>{pieza}</div>}
        {!pieza && datos}
        {children && <div className={s.extra}>{children}</div>}
      </div>
    </section>
  );
}

/** La cifra que responde, a tamaño de pieza (44 → 72 px), con su rótulo y su detalle. En blanco sobre un campo; en el
 *  color de la serie sobre blanco o tinte. */
export function CifraPortada({
  valor, unidad, etiqueta, detalle,
}: {
  valor: React.ReactNode;
  unidad?: string;
  etiqueta: React.ReactNode;
  detalle?: React.ReactNode;
}) {
  return (
    <div className={s.cifra}>
      <p className={s.cifraValor}>
        <span className="num">{valor}</span>
        {unidad && <span className={s.cifraUnidad}> {unidad}</span>}
      </p>
      <p className={s.cifraEtiqueta}>{etiqueta}</p>
      {detalle && <p className={s.cifraDetalle}>{detalle}</p>}
    </div>
  );
}
