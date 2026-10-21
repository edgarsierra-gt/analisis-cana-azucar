"use client";

import Link from "next/link";
import { Children, isValidElement, useCallback, useEffect, useState } from "react";
import s from "./Diapositivas.module.css";

type Serie = "campo" | "caldera" | "mercado";

/**
 * Una diapositiva 16:9. El texto escala con el ancho de la diapositiva (unidades cqw), así se ve igual en una
 * laptop que en un proyector. `notas` son las notas del expositor: se muestran con la tecla N.
 */
export function Diapositiva({
  children, serie, tipo = "contenido", notas,
}: {
  children: React.ReactNode;
  serie?: Serie;
  tipo?: "portada" | "separador" | "contenido";
  notas?: React.ReactNode;
}) {
  return (
    <div className={`${s.diapositiva} ${s[tipo]}`} data-serie={serie} data-notas={notas ? "si" : undefined}>
      <div className={s.lienzo}>{children}</div>
    </div>
  );
}

/**
 * Presentación a pantalla completa. Flechas, espacio o clic para avanzar; Inicio/Fin; F para pantalla completa;
 * N para notas. La diapositiva actual queda en la URL (#3) para retomar. Imprimir genera un PDF de una
 * diapositiva por página.
 */
export function Diapositivas({ children, titulo }: { children: React.ReactNode; titulo: string }) {
  const diapositivas = Children.toArray(children).filter(isValidElement) as React.ReactElement<{ notas?: React.ReactNode }>[];
  const total = diapositivas.length;
  const [i, setI] = useState(0);
  const [notas, setNotas] = useState(false);

  const ir = useCallback((n: number) => {
    const k = Math.max(0, Math.min(total - 1, n));
    setI(k);
    history.replaceState(null, "", `#${k + 1}`);
  }, [total]);

  useEffect(() => {
    const desdeHash = () => {
      const n = Number(location.hash.slice(1));
      if (Number.isInteger(n) && n >= 1 && n <= total) setI(n - 1);
    };
    desdeHash();
    window.addEventListener("hashchange", desdeHash);
    return () => window.removeEventListener("hashchange", desdeHash);
  }, [total]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); ir(i + 1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); ir(i - 1); }
      else if (e.key === "Home") ir(0);
      else if (e.key === "End") ir(total - 1);
      else if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
      } else if (e.key.toLowerCase() === "n") setNotas((v) => !v);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [i, ir, total]);

  const notaActual = diapositivas[i]?.props.notas;

  return (
    <div className={s.pantalla}>
      <h1 className="solo-lectores">{titulo}</h1>
      <div className={s.escenario}>
        {diapositivas.map((d, k) => (
          <section
            key={k}
            className={s.marco}
            data-activa={k === i ? "si" : undefined}
            aria-hidden={k !== i}
            aria-label={`Diapositiva ${k + 1} de ${total}`}
          >
            {d}
            <span className={s.folio} aria-hidden="true">{k + 1} / {total}</span>
          </section>
        ))}
      </div>

      {notas && notaActual && (
        <aside className={`${s.notas} no-imprimir`} aria-label="Notas del expositor">
          <p className="etiqueta">Notas · diapositiva {i + 1}</p>
          <div>{notaActual}</div>
        </aside>
      )}

      <div className={`${s.controles} no-imprimir`}>
        <Link href="/" className={s.salir}>Salir</Link>
        <div className={s.progreso} aria-hidden="true"><span style={{ width: `${((i + 1) / total) * 100}%` }} /></div>
        <span className={s.contador}>{i + 1} / {total}</span>
        <button type="button" onClick={() => ir(i - 1)} disabled={i === 0} aria-label="Anterior">←</button>
        <button type="button" onClick={() => ir(i + 1)} disabled={i === total - 1} aria-label="Siguiente">→</button>
        <button type="button" onClick={() => setNotas((v) => !v)} aria-pressed={notas}>Notas</button>
        <button type="button" onClick={() => window.print()}>PDF</button>
      </div>
    </div>
  );
}
