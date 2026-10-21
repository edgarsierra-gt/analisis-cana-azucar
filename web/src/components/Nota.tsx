import s from "./Nota.module.css";

const ROTULO = { limite: "Límite", dato: "Dato", metodo: "Método" } as const;

/**
 * Nota en un panel de superficie (sin borde ni columna de rótulo): límite del análisis, dato de contexto o nota de
 * método. El tipo entra al título: "Límite: datos de otro lugar".
 */
export function Nota({
  tipo = "dato", titulo, children,
}: {
  tipo?: "limite" | "dato" | "metodo";
  titulo?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <aside className={s.nota} data-tipo={tipo}>
      <p className={s.titulo}>
        {ROTULO[tipo]}
        {titulo && <>: {titulo}</>}
      </p>
      <div className={s.cuerpo}>{children}</div>
    </aside>
  );
}

/**
 * Detalle técnico plegado, para quien quiera profundizar sin cargar la lectura principal. Una barra de superficie con
 * el resumen y un signo que pasa de + a −; abierto, el contenido sigue en el mismo panel. Los de una pregunta van
 * juntos al final, en "Para verificar", a 8 px uno de otro.
 */
export function Desplegable({ titulo, children }: { titulo: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className={s.desplegable}>
      <summary>
        <span>{titulo}</span>
        <span className={s.signo} aria-hidden="true" />
      </summary>
      <div className={s.contenido}>{children}</div>
    </details>
  );
}
