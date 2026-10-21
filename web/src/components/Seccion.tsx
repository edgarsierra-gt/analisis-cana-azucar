import s from "./Seccion.module.css";

/** Sección numerada de una página: "01 · Variedades" sobre una línea fina, título en serif y contenido. */
export function Seccion({
  id, numero, etiqueta, titulo, entrada, children, ancho = "total",
}: {
  id?: string;
  numero?: string;
  etiqueta?: string;
  titulo: React.ReactNode;
  entrada?: React.ReactNode;
  children?: React.ReactNode;
  ancho?: "texto" | "medio" | "total";
}) {
  const clase = ancho === "texto" ? "contenedor-texto" : ancho === "medio" ? "contenedor-medio" : "contenedor";
  return (
    <section id={id} className={s.seccion}>
      <div className={clase}>
        <header className={s.cabeza}>
          {(numero || etiqueta) && (
            <p className={`etiqueta ${s.etiqueta}`}>
              {numero && <span className={s.numero}>{numero}</span>}
              {etiqueta}
            </p>
          )}
          <h2 className={s.titulo}>{titulo}</h2>
          {entrada && <div className={`entrada ${s.entrada}`}>{entrada}</div>}
        </header>
        <div className={s.cuerpo}>{children}</div>
      </div>
    </section>
  );
}
