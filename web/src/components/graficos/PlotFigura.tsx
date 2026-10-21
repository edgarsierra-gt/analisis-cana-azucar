"use client";

import * as Plot from "@observablehq/plot";
import { useEffect, useRef, useState } from "react";

/**
 * Colores para gráficas: espejo exacto de los tokens de globals.css (si cambia uno, cambia el otro).
 * Regla del sitio: un color para lo que importa (el de la serie de la página) y gris (`contexto`) para el resto.
 * - `campo`, `caldera`, `mercado`: líneas, puntos, barras que responden y rótulos directos (≥ 5.4:1 sobre blanco).
 * - `campoVivo`… : solo rellenos grandes (áreas, barras anchas); nunca texto (≥ 3.3:1).
 * - `campoFondo`… : bandas de incertidumbre o franjas de fondo, sin texto encima en color.
 * Una segunda serie destacada va en el mismo color con trazo discontinuo, nunca en ámbar: `resalte` solo rellena
 * franjas al 25-30 % de opacidad.
 */
export const COLORES = {
  fondo: "#ffffff",         // relleno de puntos huecos
  tinta: "#16181b",
  apagado: "#585e66",
  /** Nombre viejo de `apagado`; se queda mientras las gráficas lo usen. */
  tinta2: "#585e66",
  contexto: "#878d95",      // 3.35:1 sobre blanco (WCAG 1.4.11)
  contextoSuave: "#d3d7dc",
  rejilla: "#e7e9ec",
  campo: "#137a3c",
  campoVivo: "#1c9b4c",
  campoFondo: "#e3f4e8",
  caldera: "#bb3e0b",
  calderaVivo: "#f4570f",
  calderaFondo: "#fdebe3",
  mercado: "#2160e0",
  mercadoVivo: "#3b7cf5",
  mercadoFondo: "#e8effd",
  resalte: "#e3a92f",
};

/** Paleta categórica apta para daltonismo, en el orden en que conviene usarla (sin violeta). */
export const CATEGORICOS = ["#2160e0", "#e0700f", "#137a3c", "#c99a2e", "#585e66", "#878d95"];

/**
 * Colores resueltos para la gráfica que se está dibujando: `serie` es el color de la página o del bloque donde vive la
 * gráfica (el --serie más cercano), así una misma gráfica sirve en cualquier página. Lo recibe `crear` como segundo
 * argumento.
 */
export type TemaGrafica = {
  serie: string;
  serieVivo: string;
  serieFondo: string;
  serieMedio: string;
  tinta: string;
  apagado: string;
  contexto: string;
  contextoSuave: string;
  rejilla: string;
  resalte: string;
};

export type CrearPlot = (ancho: number, tema: TemaGrafica) => Plot.PlotOptions;

/** Lee los tokens de color del bloque donde vive la gráfica. Sin DOM (o sin el token) usa la tinta. */
function leerTema(el: Element | null): TemaGrafica {
  const cs = el ? getComputedStyle(el) : null;
  const token = (nombre: string, respaldo: string) => cs?.getPropertyValue(nombre).trim() || respaldo;
  return {
    serie: token("--serie", COLORES.tinta),
    serieVivo: token("--serie-vivo", COLORES.tinta),
    serieFondo: token("--serie-fondo", "#e7eaee"),
    serieMedio: token("--serie-medio", "#d9dde3"),
    tinta: COLORES.tinta,
    apagado: COLORES.apagado,
    contexto: COLORES.contexto,
    contextoSuave: COLORES.contextoSuave,
    rejilla: COLORES.rejilla,
    resalte: COLORES.resalte,
  };
}

const CURVA = "cubic-bezier(0.2, 0, 0, 1)";

const sinMovimiento = () =>
  typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const enPantalla = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

/** Ejes en gris y rejilla en su token. Plot pinta todo con currentColor; aquí se separa el contexto de los datos. */
function retocarEjes(raiz: Element) {
  raiz.querySelectorAll('g[aria-label$="-axis tick label"], g[aria-label$="-axis label"]').forEach((g) => {
    g.setAttribute("fill", COLORES.apagado);
  });
  raiz.querySelectorAll('g[aria-label$="-axis tick"]').forEach((g) => g.setAttribute("stroke", COLORES.apagado));
  raiz.querySelectorAll('g[aria-label$="-grid"]').forEach((g) => {
    g.setAttribute("stroke", COLORES.rejilla);
    g.setAttribute("stroke-opacity", "1");
  });
}

/**
 * Entrada de una gráfica, una sola vez: las líneas se trazan (600 ms), las barras crecen desde su base (400 ms,
 * escalonadas 30 ms) y los puntos, áreas y rótulos aparecen. Se anima DESDE el estado final con la Web Animations API:
 * si el script falla o nada se dispara, la gráfica ya está completa.
 */
function trazar(raiz: Element) {
  const aparecer = (el: Element, duracion: number, demora = 0) =>
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: duracion, delay: demora, easing: CURVA, fill: "backwards" });

  raiz.querySelectorAll('g[aria-label="line"]').forEach((g) => {
    const trazos = [...g.querySelectorAll("path")] as SVGPathElement[];
    if (trazos.length > 60) return void aparecer(g, 400);
    for (const p of trazos) {
      // Un trazo discontinuo ya usa stroke-dasharray: ese solo aparece.
      if (p.closest("[stroke-dasharray]")) { aparecer(p, 400, 200); continue; }
      const largo = p.getTotalLength();
      if (!largo) continue;
      const tramo = `${largo} ${largo}`;
      p.animate(
        [{ strokeDasharray: tramo, strokeDashoffset: largo }, { strokeDasharray: tramo, strokeDashoffset: 0 }],
        { duration: 600, easing: CURVA },
      );
    }
  });

  raiz.querySelectorAll('g[aria-label="bar"]').forEach((g) => {
    const barras = [...g.querySelectorAll("rect")] as SVGRectElement[];
    if (barras.length < 2 || barras.length > 200) return void aparecer(g, 400);
    const izquierdas = new Set(barras.map((b) => b.getAttribute("x")));
    const bases = new Set(barras.map((b) => (Number(b.getAttribute("y")) + Number(b.getAttribute("height"))).toFixed(1)));
    const eje = izquierdas.size === 1 ? "x" : bases.size === 1 ? "y" : null;
    if (!eje) return void aparecer(g, 400);
    barras.forEach((b, i) => {
      b.style.transformBox = "fill-box";
      b.style.transformOrigin = eje === "x" ? "left center" : "center bottom";
      const desde = eje === "x" ? "scaleX(0)" : "scaleY(0)";
      b.animate([{ transform: desde }, { transform: "none" }], {
        duration: 400, delay: Math.min(i * 30, 600), easing: CURVA, fill: "backwards",
      });
    });
  });

  raiz.querySelectorAll('g[aria-label="area"]').forEach((g) => aparecer(g, 400));
  raiz.querySelectorAll('g[aria-label="dot"]').forEach((g) => aparecer(g, 250, 300));
  raiz.querySelectorAll('g[aria-label="text"]').forEach((g) => aparecer(g, 250, 350));
}

/**
 * Gráfica de Observable Plot que se redibuja al cambiar el ancho del contenedor.
 * `crear` recibe el ancho disponible y el tema de color del bloque (`tema.serie` es el color de la página) y devuelve
 * las opciones de Plot.plot (marks, escalas, etc.). Las gráficas viejas que solo leen el ancho siguen sirviendo.
 *
 * Estilo del sistema: texto de 14 px, ejes y unidades en gris (`apagado`), rejilla en `rejilla` (solo en el eje de
 * valores: cada gráfica la pide con `grid: true` en ese eje). Movimiento: se traza al entrar en pantalla, una vez, y al
 * cambiar los datos pasa al estado nuevo con un fundido de 200 ms. Con prefers-reduced-motion se pinta completa.
 * Dentro de la presentación ([data-presentacion]) no se anima ni se retoca: conserva su estilo y el PDF sale completo.
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
  const vista = useRef(false);            // ya se trazó (o no se va a trazar)
  const anchoPrevio = useRef(0);
  const observador = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setAncho(Math.floor(e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Trazado al entrar en pantalla, una sola vez.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (sinMovimiento() || el.closest("[data-presentacion]") || typeof IntersectionObserver === "undefined") {
      vista.current = true;
      return;
    }
    const obs = new IntersectionObserver((entradas) => {
      if (vista.current || !entradas.some((e) => e.isIntersecting)) return;
      const grafica = el.firstElementChild;
      if (!grafica) return;   // aún sin dibujar: lo resuelve el primer dibujo
      vista.current = true;
      obs.disconnect();
      trazar(grafica);
    }, { threshold: 0 });
    observador.current = obs;
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || ancho === 0) return;
    const enPresentacion = !!el.closest("[data-presentacion]");
    const opciones = crear(ancho, leerTema(el));
    const grafica = Plot.plot({
      width: ancho,
      height: alto,
      marginTop: 24,
      marginRight: 16,
      marginBottom: 40,
      marginLeft: 52,
      ...opciones,
      style: {
        background: "transparent",
        color: COLORES.tinta,
        fontFamily: "var(--fuente-texto)",
        fontSize: "14px",
        fontVariantNumeric: "tabular-nums",
        overflow: "visible",
        ...(typeof opciones.style === "object" ? opciones.style : {}),
      },
    });
    grafica.setAttribute("role", "img");
    grafica.setAttribute("aria-label", etiqueta);
    if (!enPresentacion) retocarEjes(grafica);
    const habia = el.firstElementChild !== null;
    el.replaceChildren(grafica);   // sin limpieza: una diapositiva oculta (ancho 0) conserva su gráfica para el PDF

    if (!vista.current && enPantalla(el)) {
      // Primer dibujo con la gráfica ya a la vista (por ejemplo, en el primer pantallazo): se traza ahora.
      vista.current = true;
      observador.current?.disconnect();
      trazar(grafica);
    } else if (habia && ancho === anchoPrevio.current && !enPresentacion) {
      // Cambiaron los datos (un supuesto de una herramienta): fundido corto en vez de un salto en seco.
      grafica.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: sinMovimiento() ? 120 : 200, easing: CURVA });
    }
    anchoPrevio.current = ancho;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ancho, alto, etiqueta, ...dependencias]);

  return <div ref={ref} style={{ width: "100%", minHeight: alto }} />;
}
