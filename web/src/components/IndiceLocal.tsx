"use client";

import { useEffect, useState } from "react";
import s from "./IndiceLocal.module.css";

/** Índice fijo de una página larga (por ejemplo, las preguntas de un caso). Marca la sección visible. */
export function IndiceLocal({
  items, serie, titulo,
}: {
  items: { id: string; etiqueta: string }[];
  serie?: "campo" | "caldera" | "mercado";
  titulo?: string;
}) {
  const [activa, setActiva] = useState(items[0]?.id);

  useEffect(() => {
    const secciones = items.map((x) => document.getElementById(x.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    secciones.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav className={s.indice} data-serie={serie} aria-label={titulo ?? "En esta página"}>
      <div className={`contenedor ${s.fila}`}>
        {titulo && <span className={`etiqueta ${s.titulo}`}>{titulo}</span>}
        <ol className={s.lista}>
          {items.map((x) => (
            <li key={x.id}>
              <a href={`#${x.id}`} aria-current={activa === x.id ? "true" : undefined}>{x.etiqueta}</a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
