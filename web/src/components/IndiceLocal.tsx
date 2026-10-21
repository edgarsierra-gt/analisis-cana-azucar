"use client";

import { useEffect, useRef, useState } from "react";
import s from "./IndiceLocal.module.css";

type Serie = "campo" | "caldera" | "mercado";

/** Quita la numeración de un rótulo viejo: "00 Los datos" → "Los datos", "3 · Sensor virtual" → "Sensor virtual". */
const sinNumero = (texto: string) => texto.replace(/^\s*\d+\s*(?:[·.:)\-–—]\s*)?/, "").trim() || texto;

/**
 * Navegación de una página larga, que se lee como navegación: una barra fija bajo el encabezado, a todo el ancho, sobre
 * el tinte de la página, con el rótulo "En esta página" y una pestaña por sección. La pestaña de la sección visible va
 * rellena con el color de la serie y texto blanco; las demás, en tinta, se rellenan del tinte medio al pasar el cursor.
 *
 * Cada pestaña toma el color de la serie de su sección (el data-serie más cercano a la sección), así en una página con
 * secciones de varias series (Herramientas) la pestaña activa cambia de color con la sección.
 *
 * Teléfono: la barra sigue fija (52 px); el rótulo se oculta y las pestañas, de 44 px de alto, se desplazan de lado con
 * la última asomando. La activa se mantiene a la vista.
 *
 * `etiqueta` se pinta sin numeración aunque la traiga ("01 Países" → "Países"). `titulo` no se pinta: es la etiqueta
 * accesible de la navegación.
 */
export function IndiceLocal({
  items, serie, titulo,
}: {
  items: { id: string; etiqueta: string }[];
  serie?: Serie;
  titulo?: string;
}) {
  const [activa, setActiva] = useState(items[0]?.id);
  const [pegado, setPegado] = useState(false);
  const [series, setSeries] = useState<Record<string, string | undefined>>({});
  const [desborde, setDesborde] = useState({ izq: false, der: false });
  const ref = useRef<HTMLElement>(null);
  const filaRef = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLOListElement>(null);

  // ¿Quedan pestañas fuera de la fila? Entonces asoma una flecha en ese borde: así se sabe que la fila sigue, aunque el
  // corte caiga justo entre dos pestañas.
  useEffect(() => {
    const fila = filaRef.current;
    if (!fila) return;
    const medir = () => {
      const izq = fila.scrollLeft > 4;
      const der = fila.scrollLeft + fila.clientWidth < fila.scrollWidth - 4;
      setDesborde((d) => (d.izq === izq && d.der === der ? d : { izq, der }));
    };
    medir();
    fila.addEventListener("scroll", medir, { passive: true });
    const obs = new ResizeObserver(medir);
    obs.observe(fila);
    if (lista.current) obs.observe(lista.current);
    return () => {
      fila.removeEventListener("scroll", medir);
      obs.disconnect();
    };
  }, []);

  const mover = (sentido: 1 | -1) => {
    const fila = filaRef.current;
    if (!fila) return;
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fila.scrollBy({ left: sentido * fila.clientWidth * 0.7, behavior: reducir ? "auto" : "smooth" });
  };

  // Sección visible y color de la serie de cada sección
  useEffect(() => {
    const secciones = items.map((x) => document.getElementById(x.id)).filter(Boolean) as HTMLElement[];
    const colores: Record<string, string | undefined> = {};
    for (const el of secciones) colores[el.id] = el.closest<HTMLElement>("[data-serie]")?.dataset.serie;
    // Fuera del cuerpo del efecto: el color se lee del DOM ya pintado y se guarda en el siguiente cuadro
    const cuadro = requestAnimationFrame(() => setSeries(colores));
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id);
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    secciones.forEach((el) => obs.observe(el));
    return () => {
      cancelAnimationFrame(cuadro);
      obs.disconnect();
    };
  }, [items]);

  // Pegado bajo el encabezado: el índice lleva la sombra y el encabezado la suelta (ver Encabezado.module.css).
  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const medir = () => {
      const tope = parseFloat(getComputedStyle(nav).top);
      setPegado(Math.round(nav.getBoundingClientRect().top) <= Math.round(tope) && window.scrollY > 0);
    };
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, []);

  // La pestaña activa siempre a la vista cuando la fila se desplaza de lado (teléfono y tableta)
  useEffect(() => {
    const ol = lista.current;
    const fila = ol?.parentElement;
    const a = ol?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!fila || !a || fila.scrollWidth <= fila.clientWidth) return;
    // Margen para que la pestaña activa no quede bajo una de las flechas (44 px) del borde
    const margen = Math.max(parseFloat(getComputedStyle(fila).paddingLeft) || 0, 52);
    const izq = a.offsetLeft;   // .fila es position: relative, así offsetLeft se mide desde su borde
    const der = izq + a.offsetWidth;
    if (izq < fila.scrollLeft + margen || der > fila.scrollLeft + fila.clientWidth - margen) {
      const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      fila.scrollTo({ left: Math.max(0, izq - margen), behavior: reducir ? "auto" : "smooth" });
    }
  }, [activa]);

  return (
    <nav
      ref={ref}
      className={s.indice}
      data-serie={serie}
      data-indice-local=""
      data-pegado={pegado ? "" : undefined}
      aria-label={titulo ? `En esta página: ${titulo}` : "En esta página"}
    >
      <div className={s.marco}>
        {/* Las flechas son un atajo para el puntero; con teclado, cada pestaña enfocada entra sola a la vista. */}
        {desborde.izq && (
          <button type="button" className={`${s.flecha} ${s.izq}`} onClick={() => mover(-1)} tabIndex={-1} aria-hidden="true">
            <svg viewBox="0 0 16 16" width="16" height="16"><path d="M10 3 5 8l5 5" /></svg>
          </button>
        )}
        {desborde.der && (
          <button type="button" className={`${s.flecha} ${s.der}`} onClick={() => mover(1)} tabIndex={-1} aria-hidden="true">
            <svg viewBox="0 0 16 16" width="16" height="16"><path d="m6 3 5 5-5 5" /></svg>
          </button>
        )}
        <div ref={filaRef} className={s.fila}>
          <p className={s.titulo} aria-hidden="true">En esta página</p>
          <ol ref={lista} className={s.lista}>
            {items.map((x) => (
              <li key={x.id}>
                <a
                  href={`#${x.id}`}
                  data-serie={series[x.id]}
                  aria-current={activa === x.id ? "true" : undefined}
                  onClick={() => setActiva(x.id)}
                >
                  {sinNumero(x.etiqueta)}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </nav>
  );
}
