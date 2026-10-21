"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mide el espacio de una gráfica dentro de una diapositiva: el alto disponible (px) y cuánto vale 1cqw (px).
 * Con 1cqw las gráficas fijan márgenes y grosores en la misma escala que el texto de la diapositiva.
 * Mientras la diapositiva está oculta, el alto es 0 y la gráfica no se dibuja.
 */
export function useLienzo<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [medidas, setMedidas] = useState({ alto: 0, cqw: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // La diapositiva es el contenedor de consulta (container-type: inline-size) más cercano.
    let diapositiva: HTMLElement | null = el.parentElement;
    while (diapositiva && getComputedStyle(diapositiva).getPropertyValue("container-type") !== "inline-size") {
      diapositiva = diapositiva.parentElement;
    }
    const obs = new ResizeObserver(() => {
      const alto = Math.floor(el.clientHeight);
      const cqw = (diapositiva?.clientWidth ?? 0) / 100;
      setMedidas((m) => (m.alto === alto && m.cqw === cqw ? m : { alto, cqw }));
    });
    obs.observe(el);
    if (diapositiva) obs.observe(diapositiva);
    return () => obs.disconnect();
  }, []);

  return { ref, ...medidas };
}
