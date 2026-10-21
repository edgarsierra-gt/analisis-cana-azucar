"use client";

import { useEffect, useRef } from "react";

export type MedidasLienzo = { alto: number; ancho: number; cqw: number };

/**
 * Mide el espacio de una gráfica dentro de una diapositiva (alto y ancho en px, y cuánto vale 1cqw en px) y llama a
 * `alMedir` cada vez que cambia. La primera medida es inmediata, sin esperar un cuadro de pantalla: un navegador sin
 * ventana que imprime el PDF (Edge o Chrome con --print-to-pdf) puede no disparar el ResizeObserver antes de imprimir,
 * y la gráfica saldría en blanco. Con 1cqw las gráficas fijan márgenes y grosores en la escala del texto.
 */
export function useLienzo<T extends HTMLElement>(
  alMedir: (medidas: MedidasLienzo, lienzo: T) => void,
  dependencias: unknown[],
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // La diapositiva es el contenedor de consulta (container-type: inline-size) más cercano.
    let diapositiva: HTMLElement | null = el.parentElement;
    while (diapositiva && getComputedStyle(diapositiva).getPropertyValue("container-type") !== "inline-size") {
      diapositiva = diapositiva.parentElement;
    }
    let previa = "";
    const medir = () => {
      const medidas = {
        alto: Math.floor(el.clientHeight),
        ancho: Math.floor(el.clientWidth),
        cqw: (diapositiva?.clientWidth ?? 0) / 100,
      };
      if (!medidas.alto || !medidas.ancho || !medidas.cqw) return;
      const clave = `${medidas.alto}|${medidas.ancho}|${medidas.cqw}`;
      if (clave === previa) return;
      previa = clave;
      alMedir(medidas, el);
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    if (diapositiva) obs.observe(diapositiva);
    return () => obs.disconnect();
    // Se vuelve a medir y dibujar solo si cambian los datos de la gráfica (`dependencias`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  return ref;
}
