import s from "./Portada.module.css";

type Serie = "campo" | "caldera" | "mercado";

/** Encabezado de página: etiqueta, título, entrada y una línea de datos de contexto. */
export function Portada({
  etiqueta, titulo, entrada, serie, meta = [], children,
}: {
  etiqueta: string;
  titulo: React.ReactNode;
  entrada?: React.ReactNode;
  serie?: Serie;
  meta?: { clave: string; valor: React.ReactNode }[];
  children?: React.ReactNode;
}) {
  return (
    <section className={s.portada} data-serie={serie}>
      <div className="contenedor">
        <p className={`etiqueta ${s.etiqueta}`}>{etiqueta}</p>
        <h1 className={s.titulo}>{titulo}</h1>
        {entrada && <div className={`entrada ${s.entrada}`}>{entrada}</div>}
        {meta.length > 0 && (
          <dl className={s.meta}>
            {meta.map((m) => (
              <div key={m.clave}>
                <dt>{m.clave}</dt>
                <dd>{m.valor}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </div>
    </section>
  );
}
