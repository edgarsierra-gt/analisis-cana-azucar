import s from "./Seccion.module.css";

/**
 * Sección de una página: el hallazgo como h2, su entrada y, al lado, las cifras que lo prueban. Debajo, el cuerpo
 * (evidencia, qué descarté, límite, Evaluación y "Para verificar"), con un ritmo de --ritmo-bloque entre bloques.
 *
 * `numero` y `etiqueta` se aceptan por compatibilidad pero ya no se pintan: la pregunta vive en el IndiceLocal y en el id.
 * `cifras` (opcional) se coloca a la derecha del encabezado, columnas 7-12, desde 1100 px; en pantallas angostas va
 * debajo de la entrada. Lo normal es pasarle un <FilaCifras columnas={2}>.
 * `serie` (opcional) cambia el color de esta sección (por ejemplo, en Herramientas, una herramienta por serie); lo normal
 * es que la sección herede el de la página.
 */
export function Seccion({
  id, titulo, entrada, cifras, children, ancho = "total", serie,
}: {
  id?: string;
  /** @deprecated Ya no se pinta (numeración prohibida). Se borra de las páginas en el punto 2. */
  numero?: string;
  /** @deprecated Ya no se pinta (rótulo sobre el título). Se borra de las páginas en el punto 2. */
  etiqueta?: string;
  titulo: React.ReactNode;
  entrada?: React.ReactNode;
  /** Cifras clave al lado del encabezado (normalmente un <FilaCifras>). */
  cifras?: React.ReactNode;
  children?: React.ReactNode;
  /** Ancho del cuerpo dentro del marco: texto = 7 columnas, medio = 8, total = 12. Siempre desde el borde izquierdo. */
  ancho?: "texto" | "medio" | "total";
  serie?: "campo" | "caldera" | "mercado";
}) {
  return (
    <section id={id} className={s.seccion} data-serie={serie}>
      <div className="contenedor">
        <header className={`${s.cabeza} ${cifras ? s.conCifras : ""}`}>
          <div className={s.textoCabeza}>
            <h2 className={s.titulo} data-entrada="0">{titulo}</h2>
            {entrada && <div className={`entrada ${s.entrada}`} data-entrada="1">{entrada}</div>}
          </div>
          {cifras && <div className={s.cifras} data-entrada="2">{cifras}</div>}
        </header>
        {children && <div className={`${s.cuerpo} ${s[ancho]}`}>{children}</div>}
      </div>
    </section>
  );
}
