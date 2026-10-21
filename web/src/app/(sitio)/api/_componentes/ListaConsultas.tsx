import { Desplegable } from "@/components/Nota";
import { nConsultas, type Bloque, type Grupo } from "./consultas";
import s from "./ListaConsultas.module.css";

/** Bloque de código con su rótulo ("Petición", "Respuesta"). */
export function Codigo({ rotulo, texto }: Bloque) {
  return (
    <div className={s.codigo}>
      <p className={s.rotulo}>{rotulo}</p>
      <pre><code>{texto}</code></pre>
    </div>
  );
}

/** Consultas de la API agrupadas por serie: firma (método y ruta), para qué sirve, entrada, salida y ejemplo plegado. */
export function ListaConsultas({ grupos }: { grupos: Grupo[] }) {
  return (
    <div className={s.lista}>
      {grupos.map((g) => (
        <section key={g.clave} className={s.grupo} data-serie={g.serie} aria-labelledby={`grupo-${g.clave}`}>
          <header className={s.cabeza}>
            <h3 id={`grupo-${g.clave}`} className={s.tituloGrupo}>{g.titulo}</h3>
            <p className={`etiqueta ${s.cuenta}`}>{nConsultas(g.consultas.length)}</p>
          </header>
          {g.descripcion && <p className={s.descripcion}>{g.descripcion}</p>}
          <ol className={s.consultas}>
            {g.consultas.map((c) => (
              <li key={`${c.metodo} ${c.ruta}`} className={s.consulta}>
                <div className={s.firma}>
                  <span className={s.metodo}>{c.metodo}</span>
                  <code className={s.ruta}>{c.ruta}</code>
                  {c.pregunta && <span className={s.pregunta}>Pregunta {c.pregunta}</span>}
                </div>
                <p className={s.para}>{c.para}</p>
                <dl className={s.io}>
                  <div>
                    <dt>Entrada</dt>
                    <dd>{c.entrada}</dd>
                  </div>
                  <div>
                    <dt>Devuelve</dt>
                    <dd>{c.devuelve}</dd>
                  </div>
                </dl>
                {c.ejemplo && (
                  <div className={s.ejemplo}>
                    <Desplegable titulo={c.ejemplo.titulo ?? "Ejemplo de petición y respuesta"}>
                      {c.ejemplo.contexto && <p>{c.ejemplo.contexto}</p>}
                      {c.ejemplo.bloques.map((b) => <Codigo key={b.rotulo} {...b} />)}
                      {c.ejemplo.lectura && <p className={s.lectura}><strong>Cómo leerlo.</strong> {c.ejemplo.lectura}</p>}
                    </Desplegable>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
