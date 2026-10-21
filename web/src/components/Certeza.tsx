import s from "./Certeza.module.css";

export type NivelCerteza = "alta" | "media" | "baja";

/** Nivel de certeza con texto, nunca solo color. */
export function Certeza({ nivel, children }: { nivel: NivelCerteza; children?: React.ReactNode }) {
  return (
    <span className={`${s.certeza} ${s[nivel]}`}>
      <span className={s.marcas} aria-hidden="true">
        <i /><i /><i />
      </span>
      Certeza {nivel}
      {children && <span className={s.motivo}>· {children}</span>}
    </span>
  );
}
