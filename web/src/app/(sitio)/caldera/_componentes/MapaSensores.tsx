import s from "./MapaSensores.module.css";

export type GrupoSensores = {
  titulo: string;
  explicacion: string;
  destacado?: boolean;
  sensores: { tag: string; nombre: string; nota?: string }[];
};

/** Los 30 sensores agrupados por la decisión que tomé con cada uno (notebook 06, sección 5). */
export function MapaSensores({ grupos }: { grupos: GrupoSensores[] }) {
  return (
    <div className={s.mapa}>
      {grupos.map((g) => (
        <section key={g.titulo} className={`${s.grupo} ${g.destacado ? s.destacado : ""}`} aria-label={g.titulo}>
          <p className={s.cabeza}>
            <span className={s.cuenta}>{g.sensores.length}</span>
            <span className={s.titulo}>{g.titulo}</span>
          </p>
          <p className={s.explica}>{g.explicacion}</p>
          <ul className={s.lista}>
            {g.sensores.map((x) => (
              <li key={x.tag}>
                <span className={s.nombre}>{x.nombre}</span>
                <span className={s.tag}>{x.tag}</span>
                {x.nota && <span className={s.nota}>{x.nota}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
