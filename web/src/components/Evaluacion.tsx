import { Certeza, type NivelCerteza } from "./Certeza";
import s from "./Evaluacion.module.css";

/**
 * Evaluación gerencial: las cinco respuestas que pide la prueba al cierre de cada pregunta, en una banda del tinte de la
 * serie a todo el ancho de la pantalla (evidencia en blanco, decisión en tinte). Primero la decisión, en un panel blanco
 * y como enunciado grande; debajo, qué significa, impacto estimado y riesgos en tres columnas, cada una con su barra de
 * 4 px y su título; al final, la certeza con su motivo.
 *
 * Va directo en el cuerpo de una Seccion (su borde izquierdo es el del marco): de ahí sale a los dos bordes de la
 * pantalla. Dentro de una columna o de otro panel, usar `ancho="marco"`, que la deja del ancho de su contenedor.
 */
export function Evaluacion({
  titulo = "Evaluación gerencial", significa, decision, impacto, riesgo, certeza, serie, ancho = "pantalla",
}: {
  titulo?: string;
  significa: React.ReactNode;
  decision: React.ReactNode;
  impacto: React.ReactNode;
  riesgo: React.ReactNode;
  certeza: { nivel: NivelCerteza; texto: React.ReactNode };
  /** Color propio; lo normal es heredar el de la página. */
  serie?: "campo" | "caldera" | "mercado";
  /** "pantalla" (predeterminado): banda a todo el ancho. "marco": del ancho de su contenedor. */
  ancho?: "pantalla" | "marco";
}) {
  const pares: [string, React.ReactNode][] = [
    ["Qué significa", significa],
    ["Impacto estimado", impacto],
    ["Riesgos", riesgo],
  ];
  return (
    <aside className={`${s.ficha} ${s[ancho]}`} data-serie={serie} data-evaluacion="" aria-label={titulo}>
      <div className={s.interior}>
        <h3 className={s.titulo}>{titulo}</h3>
        <dl className={`${s.lista} ${s.decision}`} data-entrada="">
          <dt>Decisión que recomiendo</dt>
          <dd>{decision}</dd>
        </dl>
        <dl className={`${s.lista} ${s.pares}`}>
          {pares.map(([k, v]) => (
            <div key={k} data-entrada="">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <dl className={`${s.lista} ${s.certeza}`}>
          <dt>Nivel de certeza</dt>
          <dd>
            <Certeza nivel={certeza.nivel} />
            <div className={s.motivo}>{certeza.texto}</div>
          </dd>
        </dl>
      </div>
    </aside>
  );
}
