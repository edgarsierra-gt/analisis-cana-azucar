import s from "./Tabla.module.css";

export type Columna<F> = {
  clave: string;
  titulo: React.ReactNode;
  /** "num" alinea a la derecha con cifras tabulares */
  tipo?: "num" | "texto";
  valor?: (fila: F) => React.ReactNode;
  ancho?: string;
};

/** Tabla de datos: números a la derecha en cifras tabulares y filas destacadas opcionales. */
export function Tabla<F extends Record<string, unknown>>({
  columnas, filas, destacar, titulo, nota, compacta = false,
}: {
  columnas: Columna<F>[];
  filas: F[];
  destacar?: (fila: F, i: number) => boolean;
  titulo?: React.ReactNode;
  nota?: React.ReactNode;
  compacta?: boolean;
}) {
  return (
    <div className={s.envoltura}>
      <table className={`${s.tabla} ${compacta ? s.compacta : ""}`}>
        {titulo && <caption className={s.titulo}>{titulo}</caption>}
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.clave} scope="col" className={c.tipo === "num" ? s.num : undefined} style={{ width: c.ancho }}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className={destacar?.(f, i) ? s.destacada : undefined}>
              {columnas.map((c, j) => {
                const v = c.valor ? c.valor(f) : (f[c.clave] as React.ReactNode);
                return j === 0 ? (
                  <th key={c.clave} scope="row" className={c.tipo === "num" ? s.num : undefined}>{v}</th>
                ) : (
                  <td key={c.clave} className={c.tipo === "num" ? s.num : undefined}>{v}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {nota && <p className={s.nota}>{nota}</p>}
    </div>
  );
}
