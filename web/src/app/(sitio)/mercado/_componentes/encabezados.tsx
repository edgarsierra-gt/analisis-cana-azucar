import type { Columna } from "@/components/Tabla";
import s from "./Mercado.module.css";

/**
 * La tabla compartida no parte los encabezados de las columnas numéricas (white-space: nowrap). Con encabezados
 * largos, las tablas de esta página quedan muy anchas en el teléfono. Esto deja que el texto del encabezado se parta
 * en varias líneas; las cifras siguen sin partirse.
 */
export function partirEncabezados<F>(columnas: Columna<F>[]): Columna<F>[] {
  return columnas.map((c) =>
    c.tipo === "num" && typeof c.titulo === "string" ? { ...c, titulo: <span className={s.encabezado}>{c.titulo}</span> } : c,
  );
}
