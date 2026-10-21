import { archivoRepo } from "@/lib/base";
import s from "./Mercado.module.css";

/**
 * Hipótesis descartadas de una pregunta: cada una en su columna (barra de 4 px y su título), con qué la descartó y, al
 * final, el enlace a su registro en la bitácora (H#). El código es una cita, no un rótulo.
 */
export function Descartes({
  items,
}: {
  /** `parte` aclara cuando la hipótesis es una parte de un H# más amplio de la bitácora. */
  items: { codigo: string; hipotesis: string; motivo: React.ReactNode; parte?: string }[];
}) {
  return (
    <div className={s.descartes}>
      <h3>Qué descarté</h3>
      <div className="columnas">
        {items.map((h) => (
          <div key={h.codigo}>
            <h4>“{h.hipotesis}”</h4>
            <p>{h.motivo}</p>
            <p className={s.referencia}>
              <a href={archivoRepo("bitacora.md")}>{h.codigo} en la bitácora</a>
              {h.parte && <>, {h.parte}</>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
