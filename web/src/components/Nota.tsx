import s from "./Nota.module.css";

/** Recuadro al margen: límite del análisis, dato de contexto o nota de método. */
export function Nota({
  tipo = "dato", titulo, children,
}: {
  tipo?: "limite" | "dato" | "metodo";
  titulo?: React.ReactNode;
  children: React.ReactNode;
}) {
  const rotulo = { limite: "Límite", dato: "Dato", metodo: "Método" }[tipo];
  return (
    <aside className={`${s.nota} ${s[tipo]}`}>
      <p className={s.rotulo}>{rotulo}</p>
      <div className={s.cuerpo}>
        {titulo && <p className={s.titulo}>{titulo}</p>}
        {children}
      </div>
    </aside>
  );
}

/** Detalle técnico plegado, para quien quiera profundizar sin cargar la lectura principal. */
export function Desplegable({ titulo, children }: { titulo: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className={s.desplegable}>
      <summary>{titulo}</summary>
      <div className={s.contenido}>{children}</div>
    </details>
  );
}
