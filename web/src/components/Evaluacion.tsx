import { Certeza, type NivelCerteza } from "./Certeza";
import s from "./Evaluacion.module.css";

/**
 * Evaluación gerencial: las cinco respuestas que pide la prueba al cierre de cada análisis.
 * Qué significa para el ingenio, qué decisión recomiendo, impacto estimado, riesgos y certeza.
 */
export function Evaluacion({
  titulo = "Evaluación gerencial", significa, decision, impacto, riesgo, certeza, serie,
}: {
  titulo?: string;
  significa: React.ReactNode;
  decision: React.ReactNode;
  impacto: React.ReactNode;
  riesgo: React.ReactNode;
  certeza: { nivel: NivelCerteza; texto: React.ReactNode };
  serie?: "campo" | "caldera" | "mercado";
}) {
  const filas: [string, React.ReactNode][] = [
    ["Qué significa", significa],
    ["Decisión que recomiendo", decision],
    ["Impacto estimado", impacto],
    ["Riesgos", riesgo],
  ];
  return (
    <aside className={s.ficha} data-serie={serie} aria-label={titulo}>
      <p className={`etiqueta ${s.titulo}`}>{titulo}</p>
      <dl className={s.lista}>
        {filas.map(([k, v]) => (
          <div key={k} className={k === "Decisión que recomiendo" ? s.decision : undefined}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <div>
          <dt>Nivel de certeza</dt>
          <dd>
            <Certeza nivel={certeza.nivel} />
            <div className={s.motivo}>{certeza.texto}</div>
          </dd>
        </div>
      </dl>
    </aside>
  );
}
