import s from "./Tabla.module.css";

export type Columna<F> = {
  clave: string;
  titulo: React.ReactNode;
  /** "num" alinea a la derecha con cifras tabulares */
  tipo?: "num" | "texto";
  valor?: (fila: F) => React.ReactNode;
  ancho?: string;
};

/**
 * Tabla de datos sin líneas: cabecera en 600 sobre una banda del tinte de la página, filas alternas (cebra), números a
 * la derecha en cifras tabulares, primera columna en 600 y filas destacadas (`destacar`) con el tinte medio de la serie
 * y una barra de 4 px al inicio.
 *
 * En el teléfono (menos de 640 px) `movil` decide la forma:
 * - "desplazar", para tablas numéricas anchas: desplazamiento lateral con la primera columna fija y una línea que dice
 *   cuántas columnas hay;
 * - "apilar", para tablas de texto: cada fila se vuelve un bloque, con la primera celda como título y pares rótulo/valor.
 * Sin `movil`, la tabla elige sola: "desplazar" si alguna columna es `tipo: "num"`, "apilar" si todas son de texto.
 *
 * Si todos los rótulos de la primera columna son cortos (18 caracteres o menos, como "HOCP14-885 (T)"), no se parten
 * en dos renglones: la tabla se desplaza antes que cortar un código por el guion.
 *
 * Ancho: hasta 4 columnas ocupa 8 columnas del marco; más, todo el ancho. `ancho` lo fuerza.
 */
export function Tabla<F extends Record<string, unknown>>({
  columnas, filas, destacar, titulo, numero, nota, compacta = false, movil, ancho,
}: {
  columnas: Columna<F>[];
  filas: F[];
  destacar?: (fila: F, i: number) => boolean;
  titulo?: React.ReactNode;
  /** Número de la tabla; se escribe dentro del título: "Tabla 3. …". */
  numero?: number | string;
  nota?: React.ReactNode;
  compacta?: boolean;
  movil?: "apilar" | "desplazar";
  ancho?: "medio" | "total";
}) {
  const anchoFinal = ancho ?? (columnas.length <= 4 ? "medio" : "total");
  const formaMovil = movil ?? (columnas.some((c) => c.tipo === "num") ? "desplazar" : "apilar");
  const apilar = formaMovil === "apilar";
  const primera = columnas[0];
  const primeraCorta = !!primera && filas.every((f) => {
    const v = primera.valor ? primera.valor(f) : f[primera.clave];
    return (typeof v === "string" || typeof v === "number") && String(v).length <= 18;
  });
  return (
    <div
      className={`${s.tablaBloque} ${s[anchoFinal]} ${apilar ? s.apilar : s.desplazar} ${primeraCorta ? s.primeraCorta : ""}`}
      data-movil={formaMovil}
    >
      {!apilar && columnas.length > 3 && (
        <p className={s.aviso} aria-hidden="true">Deslice para ver las {columnas.length} columnas</p>
      )}
      <div className={s.envoltura}>
        {/* Al apilar, las celdas pasan a display: block; los role conservan la semántica de tabla. */}
        <table className={`${s.tabla} ${compacta ? s.compacta : ""}`} role={apilar ? "table" : undefined}>
          {(titulo || numero !== undefined) && (
            <caption className={s.titulo}>
              {numero !== undefined && <>Tabla {numero}. </>}
              {titulo}
            </caption>
          )}
          <thead role={apilar ? "rowgroup" : undefined}>
            <tr role={apilar ? "row" : undefined}>
              {columnas.map((c) => (
                <th
                  key={c.clave}
                  scope="col"
                  role={apilar ? "columnheader" : undefined}
                  className={c.tipo === "num" ? s.num : s.txt}
                  style={{ width: c.ancho }}
                >
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody role={apilar ? "rowgroup" : undefined}>
            {filas.map((f, i) => (
              <tr key={i} className={destacar?.(f, i) ? s.destacada : undefined} role={apilar ? "row" : undefined}>
                {columnas.map((c, j) => {
                  const v = c.valor ? c.valor(f) : (f[c.clave] as React.ReactNode);
                  const clase = c.tipo === "num" ? s.num : s.txt;
                  return j === 0 ? (
                    <th key={c.clave} scope="row" role={apilar ? "rowheader" : undefined} className={clase}>{v}</th>
                  ) : (
                    <td key={c.clave} role={apilar ? "cell" : undefined} className={clase}>
                      {apilar ? (
                        <>
                          <span className={s.rotulo} aria-hidden="true">{c.titulo}</span>
                          <span className={s.valor}>{v}</span>
                        </>
                      ) : v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nota && <p className={s.nota}>{nota}</p>}
    </div>
  );
}
