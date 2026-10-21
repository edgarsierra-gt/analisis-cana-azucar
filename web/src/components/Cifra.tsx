import s from "./Cifra.module.css";

/** Cifra clave: valor grande, unidad, qué es y de dónde sale. */
export function Cifra({
  valor, unidad, etiqueta, detalle, serie,
}: {
  valor: React.ReactNode;
  unidad?: string;
  etiqueta: React.ReactNode;
  detalle?: React.ReactNode;
  serie?: "campo" | "caldera" | "mercado";
}) {
  return (
    <div className={s.cifra} data-serie={serie}>
      <p className={s.valor}>
        <span className="num">{valor}</span>{" "}
        {unidad && <span className={s.unidad}>{unidad}</span>}
      </p>
      <p className={s.etiqueta}>{etiqueta}</p>
      {detalle && <p className={s.detalle}>{detalle}</p>}
    </div>
  );
}

/** Fila de cifras clave separadas por líneas finas. */
export function FilaCifras({ children, columnas = 3 }: { children: React.ReactNode; columnas?: 2 | 3 | 4 }) {
  return <div className={s.fila} style={{ ["--cols" as string]: columnas }}>{children}</div>;
}
