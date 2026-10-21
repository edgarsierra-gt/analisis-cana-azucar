"use client";

import Link from "next/link";
import { Children, isValidElement, useCallback, useEffect, useState } from "react";
import s from "./Diapositivas.module.css";

export type Serie = "campo" | "caldera" | "mercado";
export type Capitulo = "apertura" | "campo" | "caldera" | "mercado" | "produccion" | "criterio" | "decision" | "anexo";

/** Capítulos de la barra de pestañas, en el orden del relato. El anexo va aparte, a la derecha. */
const CAPITULOS: { id: Capitulo; nombre: string; serie?: Serie }[] = [
  { id: "apertura", nombre: "Apertura" },
  { id: "campo", nombre: "Campo", serie: "campo" },
  { id: "caldera", nombre: "Caldera", serie: "caldera" },
  { id: "mercado", nombre: "Mercado", serie: "mercado" },
  { id: "produccion", nombre: "Producción" },
  { id: "criterio", nombre: "Criterio" },
  { id: "decision", nombre: "Decisión" },
  { id: "anexo", nombre: "Anexo" },
];

type PropsDiapositiva = {
  children: React.ReactNode;
  /** Capítulo de la barra de pestañas. "anexo" la saca de la cuenta principal (folio A1, A2…). */
  capitulo: Capitulo;
  /** Color de la diapositiva. Por omisión, el de su capítulo (Apertura, Producción, Criterio y Decisión son neutras). */
  serie?: Serie;
  /** "portada": campo de tinta a sangre, sin barra de capítulos. */
  tipo?: "portada" | "contenido";
  /** Notas del orador (tecla N). */
  notas?: React.ReactNode;
  /** Tiempo previsto, para el orador ("1:15"). */
  tiempo?: string;
};

/**
 * Una diapositiva 16:9. El texto escala con el ancho de la diapositiva (unidades cqw), así se ve igual en una laptop
 * que en un proyector y en el PDF. La barra de capítulos, el color y el folio los pone `Diapositivas`.
 */
export function Diapositiva({ children, tipo = "contenido" }: PropsDiapositiva) {
  return <div className={`${s.diapositiva} ${s[tipo]}`}>{children}</div>;
}

/**
 * Presentación a pantalla completa. Flechas, espacio, Re Pág y Av Pág para moverse; Inicio y Fin van a la primera y a la
 * última diapositiva principal (el anexo queda después y se abre con su pestaña); F, pantalla completa; N, notas.
 * La diapositiva actual queda en la URL (#3, #A2) para retomar. Imprimir da un PDF de una diapositiva por página.
 */
export function Diapositivas({ children, titulo }: { children: React.ReactNode; titulo: string }) {
  const diapositivas = Children.toArray(children).filter(isValidElement) as React.ReactElement<PropsDiapositiva>[];
  const total = diapositivas.length;
  const principales = diapositivas.filter((d) => d.props.capitulo !== "anexo").length;
  const [i, setI] = useState(0);
  const [notas, setNotas] = useState(false);

  const folio = useCallback(
    (k: number) => (k < principales ? `${k + 1} / ${principales}` : `A${k - principales + 1}`),
    [principales],
  );
  const hash = useCallback((k: number) => (k < principales ? `#${k + 1}` : `#A${k - principales + 1}`), [principales]);

  const ir = useCallback(
    (n: number) => {
      const k = Math.max(0, Math.min(total - 1, n));
      setI(k);
      history.replaceState(null, "", hash(k));
    },
    [total, hash],
  );

  const irCapitulo = useCallback(
    (c: Capitulo) => {
      const k = diapositivas.findIndex((d) => d.props.capitulo === c);
      if (k >= 0) ir(k);
    },
    [diapositivas, ir],
  );

  useEffect(() => {
    const desdeHash = () => {
      const h = location.hash.slice(1);
      const anexo = /^a(\d+)$/i.exec(h);
      const n = anexo ? principales + Number(anexo[1]) : Number(h);
      if (Number.isInteger(n) && n >= 1 && n <= total) setI(n - 1);
    };
    desdeHash();
    window.addEventListener("hashchange", desdeHash);
    return () => window.removeEventListener("hashchange", desdeHash);
  }, [total, principales]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); ir(i + 1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); ir(i - 1); }
      else if (e.key === "Home") { e.preventDefault(); ir(0); }
      else if (e.key === "End") { e.preventDefault(); ir(principales - 1); }
      else if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
      } else if (e.key.toLowerCase() === "n") setNotas((v) => !v);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [i, ir, principales]);

  const actual = diapositivas[i]?.props;
  const enAnexo = i >= principales;

  return (
    // data-presentacion: si una PlotFigura entra aquí, no anima ni retoca los ejes (el PDF imprime todas las diapositivas
    // de una vez). Las gráficas de las diapositivas usan GraficoD, que dibuja sin animación desde el primer render.
    <div className={s.pantalla} data-presentacion="" data-notas={notas && actual?.notas ? "si" : undefined}>
      <h1 className="solo-lectores">{titulo}</h1>
      <div className={s.escenario}>
        {diapositivas.map((d, k) => {
          const { capitulo, tipo = "contenido" } = d.props;
          const serie = d.props.serie ?? CAPITULOS.find((c) => c.id === capitulo)?.serie;
          const activa = k === i;
          return (
            // Todas las diapositivas quedan dibujadas (ocultas con visibility): las gráficas se miden y se trazan al
            // cargar, y el PDF sale completo.
            <section
              key={k}
              className={s.marco}
              data-activa={activa ? "si" : undefined}
              aria-hidden={!activa}
              inert={!activa}
              aria-label={`Diapositiva ${folio(k)}`}
            >
              <div className={s.lamina} data-serie={serie}>
                {tipo !== "portada" && (
                  <nav className={s.capitulos} aria-label="Capítulos de la presentación">
                    <ul>
                      {CAPITULOS.map((c) => (
                        <li key={c.id} className={c.id === "anexo" ? s.pestanaAnexo : undefined}>
                          <button
                            type="button"
                            onClick={() => irCapitulo(c.id)}
                            aria-current={c.id === capitulo ? "step" : undefined}
                          >
                            {c.nombre}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <span className={s.folio}>{folio(k)}</span>
                  </nav>
                )}
                {d}
              </div>
            </section>
          );
        })}
      </div>

      {notas && actual?.notas && (
        <aside className={`${s.notas} no-imprimir`} aria-label="Notas del orador">
          <p className={s.notasCabeza}>
            Diapositiva {folio(i)}
            {actual.tiempo && <> · {actual.tiempo}</>}
          </p>
          <div>{actual.notas}</div>
        </aside>
      )}

      <div className={`${s.controles} no-imprimir`}>
        <Link href="/" className={s.salir}>Salir</Link>
        <div className={s.progreso} aria-hidden="true">
          <span style={{ width: `${(Math.min(i + 1, principales) / principales) * 100}%` }} />
        </div>
        <span className={s.contador}>{enAnexo ? `Anexo ${folio(i)}` : folio(i)}</span>
        <button type="button" onClick={() => ir(i - 1)} disabled={i === 0} aria-label="Anterior">
          <Flecha izquierda />
        </button>
        <button type="button" onClick={() => ir(i + 1)} disabled={i === total - 1} aria-label="Siguiente">
          <Flecha />
        </button>
        <button type="button" onClick={() => setNotas((v) => !v)} aria-pressed={notas}>Notas</button>
        <button type="button" onClick={() => window.print()}>PDF</button>
      </div>
    </div>
  );
}

/** Flecha de los controles, dibujada (no un carácter de otra fuente). */
function Flecha({ izquierda = false }: { izquierda?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={izquierda ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M2 8h11M9 3.5 13.5 8 9 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
