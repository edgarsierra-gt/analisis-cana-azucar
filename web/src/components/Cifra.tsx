import s from "./Cifra.module.css";

/**
 * Cifra clave como columna propia: una barra de 4 px del color de la página arriba, el valor (Newsreader, 32 → 40 px)
 * en el color de la serie, la unidad, qué es (su título, en 600) y de dónde sale (14 px).
 * `tono="tinta"` deja el valor en tinta (para una cifra de contexto junto a la que responde); `tono="serie"` lo fuerza.
 * Un rango largo se parte en valor y detalle ("0.113 US$/lb" y, en el detalle, "hasta 0.117 según la variedad").
 */
export function Cifra({
  valor, unidad, etiqueta, detalle, serie, tono,
}: {
  valor: React.ReactNode;
  unidad?: string;
  etiqueta: React.ReactNode;
  detalle?: React.ReactNode;
  /** Color propio de esta cifra; lo normal es heredar el de la página. */
  serie?: "campo" | "caldera" | "mercado";
  tono?: "serie" | "tinta";
}) {
  return (
    <div className={`${s.cifra} ${tono ? s[tono] : ""}`} data-serie={serie} data-entrada="">
      <p className={s.valor}>
        <span className="num">{valor}</span>
        {unidad && <span className={s.unidad}> {unidad}</span>}
      </p>
      <p className={s.etiqueta}>{etiqueta}</p>
      {detalle && <p className={s.detalle}>{detalle}</p>}
    </div>
  );
}

/**
 * Fila de cifras clave: cada una es una columna con su barra y su título, a 32-48 px de la siguiente. Se reparten en
 * columnas de 13rem o más (dos en el teléfono). `columnas` es el máximo por fila en pantallas anchas.
 */
export function FilaCifras({ children, columnas = 3 }: { children: React.ReactNode; columnas?: 2 | 3 | 4 }) {
  return <div className={s.fila} style={{ ["--cols" as string]: columnas }}>{children}</div>;
}
