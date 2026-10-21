import s from "./Certeza.module.css";

export type NivelCerteza = "alta" | "media" | "baja";

/** Nivel de certeza: el texto dice el nivel y un medidor de tres segmentos en el color de la página lo acompaña
 *  (nunca solo color: alta = 3 llenos, media = 2, baja = 1). */
export function Certeza({ nivel, children }: { nivel: NivelCerteza; children?: React.ReactNode }) {
  return (
    <span className={`${s.certeza} ${s[nivel]}`}>
      <span className={s.marcas} aria-hidden="true">
        <span /><span /><span />
      </span>
      <span className={s.nivel}>Certeza {nivel}</span>
      {children && <span className={s.motivo}>{children}</span>}
    </span>
  );
}
