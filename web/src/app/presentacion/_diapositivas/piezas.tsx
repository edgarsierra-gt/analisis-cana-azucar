import Link from "next/link";
import s from "./presentacion.module.css";

type NivelCerteza = "alta" | "media" | "baja";

/** Etiqueta y título de una diapositiva de contenido. El título dice el hallazgo. */
export function Encabezado({ etiqueta, titulo }: { etiqueta: string; titulo: React.ReactNode }) {
  return (
    <>
      <p className="d-etiqueta">{etiqueta}</p>
      <h2 className="d-titulo">{titulo}</h2>
    </>
  );
}

/** Cifra clave: valor grande, unidad, qué es y, si hace falta, de dónde sale o su intervalo. */
export function CifraD({
  valor, unidad, texto, detalle,
}: {
  valor: React.ReactNode;
  unidad?: string;
  texto: React.ReactNode;
  detalle?: React.ReactNode;
}) {
  return (
    <div className={s.cifra}>
      <p className={s.valor}>
        <span className="d-cifra">{valor}</span>
        {unidad && <span className="d-cifra-unidad">{unidad}</span>}
      </p>
      <p className="d-cifra-texto">{texto}</p>
      {detalle && <p className={s.cifraDetalle}>{detalle}</p>}
    </div>
  );
}

/** Pie de una diapositiva: la fuente (notebook y archivo) y un enlace discreto a la sección del caso. */
export function Pie({ fuente, detalle, tema }: { fuente: React.ReactNode; detalle?: string; tema?: string }) {
  return (
    <div className={s.pie}>
      <p className="d-fuente">Fuente: {fuente}</p>
      {detalle && (
        <Link href={detalle} className={`d-fuente ${s.detalle}`}>
          Ver detalle
          {/* Para lectores de pantalla: hay un "Ver detalle" por diapositiva y cada uno lleva a otra sección */}
          {tema && <span className="solo-lectores"> de {tema}</span>}
        </Link>
      )}
    </div>
  );
}

/** Nivel de certeza escalado a la diapositiva, siempre con texto. */
export function CertezaD({
  nivel, etiqueta, children,
}: {
  nivel: NivelCerteza;
  etiqueta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${s.certeza} ${s[nivel]}`}>
      <span className={s.nivel}>
        <span className={s.marcas} aria-hidden="true">
          <i /><i /><i />
        </span>
        {etiqueta ?? `Certeza ${nivel}`}
      </span>
      <div className={s.motivo}>{children}</div>
    </div>
  );
}

/**
 * Evaluación gerencial en una diapositiva: qué significa, decisión que recomiendo, impacto, riesgos y certeza.
 * Arriba lo que se decide; abajo con qué tamaño, con qué riesgo y con qué seguridad.
 */
export function EvaluacionD({
  significa, decision, impacto, riesgos, certeza,
}: {
  significa: React.ReactNode;
  decision: React.ReactNode;
  impacto: React.ReactNode;
  riesgos: React.ReactNode;
  certeza: { nivel: NivelCerteza; etiqueta?: string; texto: React.ReactNode }[];
}) {
  return (
    <div className={`d-cuerpo ${s.evaluacion}`}>
      <section className={`d-caja ${s.caja} ${s.ancha}`}>
        <h3>Qué significa</h3>
        {significa}
      </section>
      <section className={`d-caja ${s.caja} ${s.ancha} ${s.decision}`}>
        <h3>Decisión que recomiendo</h3>
        {decision}
      </section>
      <section className={`d-caja ${s.caja} ${s.angosta}`}>
        <h3>Impacto estimado</h3>
        {impacto}
      </section>
      <section className={`d-caja ${s.caja} ${s.angosta}`}>
        <h3>Riesgos</h3>
        {riesgos}
      </section>
      <section className={`d-caja ${s.caja} ${s.angosta}`}>
        <h3>Nivel de certeza</h3>
        {certeza.map((c, i) => (
          <CertezaD key={i} nivel={c.nivel} etiqueta={c.etiqueta}>{c.texto}</CertezaD>
        ))}
      </section>
    </div>
  );
}

/** Notas del expositor: qué decir y, aparte, qué responder si preguntan algo técnico. */
export function Notas({ decir, preguntas = [] }: { decir: React.ReactNode[]; preguntas?: [string, React.ReactNode][] }) {
  return (
    <div className={s.notas}>
      {decir.map((p, i) => (
        <p key={`d${i}`}>{p}</p>
      ))}
      {preguntas.map(([q, r], i) => (
        <p key={`p${i}`}>
          <span className={s.notasPregunta}>Si preguntan {q}: </span>
          {r}
        </p>
      ))}
    </div>
  );
}
