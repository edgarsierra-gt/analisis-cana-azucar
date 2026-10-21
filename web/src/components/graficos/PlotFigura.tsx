"use client";

import * as Plot from "@observablehq/plot";
import { useEffect, useRef, useState } from "react";

/**
 * Colores para gráficas. Regla del sitio: un color para lo que importa y gris para el contexto.
 * Los tres colores de serie solo se usan cuando la gráfica compara series; si no, un color de serie + `contexto`.
 */
export const COLORES = {
  tinta: "#1c1b18",
  tinta2: "#45423b",
  contexto: "#8c857a",   // contraste 3:1 sobre el papel (WCAG 1.4.11)
  contextoSuave: "#d6cfbf",
  campo: "#2f6b45",
  caldera: "#b04a1c",
  mercado: "#2b5585",
  resalte: "#e3a92f",
  rejilla: "#e6e0d2",
};

/** Paleta categórica apta para daltonismo, en el orden en que conviene usarla. */
export const CATEGORICOS = ["#2b5585", "#c0661f", "#2f6b45", "#c99a2e", "#7a4e7e", "#6f6a60"];

export type CrearPlot = (ancho: number) => Plot.PlotOptions;

/**
 * Gráfica de Observable Plot que se redibuja al cambiar el ancho del contenedor.
 * `crear` recibe el ancho disponible y devuelve las opciones de Plot.plot (marks, escalas, etc.).
 */
export function PlotFigura({
  crear, alto = 360, etiqueta, dependencias = [],
}: {
  crear: CrearPlot;
  alto?: number;
  /** Descripción para lectores de pantalla: qué muestra la gráfica y su conclusión. */
  etiqueta: string;
  dependencias?: unknown[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setAncho(Math.floor(e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || ancho === 0) return;
    const opciones = crear(ancho);
    const grafica = Plot.plot({
      width: ancho,
      height: alto,
      marginTop: 24,
      marginRight: 16,
      marginBottom: 36,
      marginLeft: 48,
      ...opciones,
      style: {
        background: "transparent",
        color: COLORES.tinta,
        fontFamily: "var(--fuente-texto)",
        fontSize: "12.5px",
        overflow: "visible",
        ...(typeof opciones.style === "object" ? opciones.style : {}),
      },
    });
    grafica.setAttribute("role", "img");
    grafica.setAttribute("aria-label", etiqueta);
    el.replaceChildren(grafica);   // sin limpieza: una diapositiva oculta (ancho 0) conserva su gráfica para el PDF
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ancho, alto, etiqueta, ...dependencias]);

  return <div ref={ref} style={{ width: "100%", minHeight: alto }} />;
}
