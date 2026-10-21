import Link from "next/link";
import s from "./presentacion.module.css";

export type NivelCerteza = "alta" | "media" | "baja";

/** Título de la diapositiva: dice el hallazgo (45 caracteres o menos). La bajada, si hace falta, va debajo. */
export function Titulo({ children, bajada }: { children: React.ReactNode; bajada?: React.ReactNode }) {
  return (
    <>
      <h2 className={s.titulo}>{children}</h2>
      {bajada && <p className={s.bajada}>{bajada}</p>}
    </>
  );
}

/**
 * Cifra clave, como en el sitio: barra de la serie arriba, valor en el color de la serie, qué es (600) y su detalle.
 * `grande` la vuelve la cifra dominante; `tono="tinta"` la deja en tinta.
 */
export function CifraD({
  valor, unidad, titulo, detalle, grande = false, tono = "serie",
}: {
  valor: React.ReactNode;
  unidad?: React.ReactNode;
  titulo: React.ReactNode;
  detalle?: React.ReactNode;
  grande?: boolean;
  tono?: "serie" | "tinta";
}) {
  return (
    <div className={`${s.cifra} ${grande ? s.cifraGrande : ""} ${tono === "tinta" ? s.cifraTinta : ""}`}>
      <p className={s.cifraValor}>
        {valor}
        {unidad && <span className={s.cifraUnidad}>{unidad}</span>}
      </p>
      <p className={s.cifraTitulo}>{titulo}</p>
      {detalle && <p className={s.cifraDetalle}>{detalle}</p>}
    </div>
  );
}

/** Gráfica de una diapositiva: qué muestra (una línea), el lienzo que se estira y cómo leerla. */
export function GraficaD({
  titulo, nota, children, serie,
}: {
  titulo: React.ReactNode;
  nota?: React.ReactNode;
  children: React.ReactNode;
  serie?: "campo" | "caldera" | "mercado";
}) {
  return (
    <figure className={s.grafica} data-serie={serie}>
      <figcaption className={s.graficaTitulo}>{titulo}</figcaption>
      <div className={s.graficaLienzo}>{children}</div>
      {nota && <p className={s.graficaNota}>{nota}</p>}
    </figure>
  );
}

/** Pie de una diapositiva: la fuente (notebook y archivo) y el enlace a la sección del sitio con el detalle. */
export function Pie({ fuente, detalle, tema }: { fuente: React.ReactNode; detalle?: string; tema?: string }) {
  return (
    <div className={s.pie}>
      <p>Fuente: {fuente}</p>
      {detalle && (
        <Link href={detalle} className={s.pieEnlace}>
          Ver detalle
          {/* Para lectores de pantalla: hay un "Ver detalle" por diapositiva y cada uno lleva a otra sección */}
          {tema && <span className="solo-lectores"> de {tema}</span>}
        </Link>
      )}
    </div>
  );
}

/** Certeza como en el sitio: el texto dice el nivel y un medidor de 3 segmentos en el color de la diapositiva. */
export function CertezaD({
  nivel, etiqueta, children,
}: {
  nivel: NivelCerteza;
  /** Para un nivel intermedio ("Certeza media-baja"): el medidor usa `nivel` y el texto dice esto. */
  etiqueta?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${s.certeza} ${s[nivel]}`}>
      <span className={s.marcas} aria-hidden="true">
        <i /><i /><i />
      </span>
      <span className={s.nivel}>{etiqueta ?? `Certeza ${nivel}`}</span>
      {children && <span className={s.motivo}>{children}</span>}
    </div>
  );
}

/**
 * Evaluación gerencial en una diapositiva, como la del sitio: banda del tinte de la serie, la decisión primero en un
 * panel blanco y luego tres columnas con barra (impacto, riesgos, certeza).
 */
export function EvaluacionD({
  decision, impacto, riesgos, certeza,
}: {
  decision: React.ReactNode;
  impacto: React.ReactNode;
  riesgos: React.ReactNode;
  certeza: { nivel: NivelCerteza; etiqueta?: string; texto: React.ReactNode }[];
}) {
  return (
    <div className={s.evaluacion}>
      <div className={s.evDecision}>
        <p className={s.evRotulo}>Decisión que recomiendo</p>
        {decision}
      </div>
      <div className={s.evPares}>
        <section>
          <h3>Impacto estimado</h3>
          {impacto}
        </section>
        <section>
          <h3>Riesgos</h3>
          {riesgos}
        </section>
        <section>
          <h3>Nivel de certeza</h3>
          {certeza.map((c, i) => (
            <CertezaD key={i} nivel={c.nivel} etiqueta={c.etiqueta}>{c.texto}</CertezaD>
          ))}
        </section>
      </div>
    </div>
  );
}

/**
 * Notas del orador: lo que digo y, aparte, respuestas cortas si preguntan. `bloques` agrega otras listas con su
 * título (preparación, plan B, versión corta).
 */
export function Notas({
  decir, preguntas = [], bloques = [],
}: {
  decir: React.ReactNode[];
  preguntas?: [string, React.ReactNode][];
  bloques?: { titulo: string; items: [string, React.ReactNode][] }[];
}) {
  const listas = [...(preguntas.length > 0 ? [{ titulo: "Si preguntan", items: preguntas }] : []), ...bloques];
  return (
    <div className={s.notas}>
      {decir.map((p, i) => (
        <p key={`d${i}`}>{p}</p>
      ))}
      {listas.map((b) => (
        <div key={b.titulo}>
          <p className={s.notasSi}>{b.titulo}</p>
          <ul className={s.notasLista}>
            {b.items.map(([tema, respuesta], i) => (
              <li key={i}>
                <strong>{tema}.</strong> {respuesta}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
