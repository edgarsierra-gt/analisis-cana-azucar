import Link from "next/link";
import { Desplegable } from "@/components/Nota";
import { ANALISIS, nConsultas, type Bloque, type Consulta, type Grupo } from "./consultas";
import s from "./ListaConsultas.module.css";

/** Bloque de código con su rótulo ("Petición", "Respuesta"). `ui` lo marca como fragmento real de la API. */
export function Codigo({ rotulo, texto, ui = false }: Bloque & { ui?: boolean }) {
  return (
    <div className={s.codigo} data-ui={ui ? "" : undefined}>
      <p className={s.rotulo}>{rotulo}</p>
      <pre><code>{texto}</code></pre>
    </div>
  );
}

/** De dónde sale la consulta y dónde se usa: la pregunta del análisis que responde y la herramienta que la llama. */
function Origen({ c }: { c: Consulta }) {
  const a = c.pregunta ? ANALISIS[c.pregunta] : undefined;
  if (!a && !c.herramienta) return null;
  return (
    <div className={s.origen}>
      {a && (
        <p>
          Responde la pregunta {a.n} de {a.serie}: <Link href={a.href}>{a.texto}</Link>.
        </p>
      )}
      {c.herramienta && (
        <p>
          La usa en vivo <Link href={c.herramienta.href}>{c.herramienta.texto}</Link>
          {c.herramienta.href.startsWith("/herramientas") ? ", en Herramientas" : ""}.
        </p>
      )}
    </div>
  );
}

/**
 * Consultas de la API agrupadas por serie: firma (método y ruta), para qué sirve, de qué análisis sale y qué herramienta
 * la usa, entrada, salida y ejemplo plegado.
 */
export function ListaConsultas({ grupos }: { grupos: Grupo[] }) {
  return (
    <div className={s.lista}>
      {grupos.map((g) => (
        <section key={g.clave} className={s.grupo} data-serie={g.serie} aria-labelledby={`grupo-${g.clave}`}>
          <header className={s.cabeza}>
            <h3 id={`grupo-${g.clave}`} className={s.tituloGrupo}>{g.titulo}</h3>
            <p className={s.cuenta}>{nConsultas(g.consultas.length)}</p>
          </header>
          {g.descripcion && <p className={s.descripcion}>{g.descripcion}</p>}
          <ol className={s.consultas}>
            {g.consultas.map((c) => (
              <li key={`${c.metodo} ${c.ruta}`} className={s.consulta}>
                <div className={s.izquierda}>
                  <p className={s.firma}>
                    <code className={s.metodo}>{c.metodo}</code>
                    <code className={s.ruta}>{c.ruta}</code>
                  </p>
                  <p className={s.para}>{c.para}</p>
                  <Origen c={c} />
                </div>
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
