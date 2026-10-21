"use client";

import type { Element, ElementContent, Root } from "hast";
import Markdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import s from "./Chat.module.css";

// Una cifra con unidad corta o un rango de cifras: "798.1", "US$526.3", "−14.0 %", "6,092 lb/acre", "US$0.112/lb",
// "15.73 a 21.32".
const NUM = String.raw`(?:[−+\-±~≈]\s?)?(?:US\$\s?|\$)?\d[\d,]*(?:\.\d+)?`;
const UNIDAD = String.raw`(?:\s?(?:%|¢\/lb|[a-zA-Záéíóúñ]{0,8}\/[a-zA-Z]{1,6}|[a-zA-Záéíóúñ]{1,8}))?`;
const CIFRA = new RegExp(`^${NUM}${UNIDAD}(?:\\s?(?:a|–|-|y)\\s?${NUM}${UNIDAD})?$`);
const VACIO = new Set(["", "—", "-", "–", "s. d."]);

const esElemento = (n: ElementContent | Root["children"][number]): n is Element => n.type === "element";
const hijos = (n: Element, ...etiquetas: string[]) =>
  n.children.filter((c): c is Element => esElemento(c) && etiquetas.includes(c.tagName));
const texto = (n: ElementContent): string =>
  n.type === "text" ? n.value : n.type === "element" ? n.children.map(texto).join("") : "";

/**
 * Marca con `clase` las celdas de las columnas que solo traen cifras: van a la derecha y en cifras tabulares. La primera
 * columna es el rótulo de la fila ("3 cortes", "2022") y se queda a la izquierda.
 */
function alinearCifras(clase: string) {
  const marcarTabla = (tabla: Element) => {
    const secciones = hijos(tabla, "thead", "tbody");
    const cabeza = secciones.filter((x) => x.tagName === "thead").flatMap((x) => hijos(x, "tr"));
    const cuerpo = secciones.filter((x) => x.tagName === "tbody").flatMap((x) => hijos(x, "tr"));
    const celdas = (fila: Element) => hijos(fila, "th", "td");
    const columnas = Math.max(0, ...cuerpo.map((f) => celdas(f).length));
    for (let j = 1; j < columnas; j++) {
      const valores = cuerpo
        .map((f) => celdas(f)[j])
        .filter((c): c is Element => c !== undefined)
        .map((c) => texto(c).trim())
        .filter((v) => !VACIO.has(v));
      if (valores.length === 0 || !valores.every((v) => CIFRA.test(v))) continue;
      for (const fila of [...cabeza, ...cuerpo]) {
        const celda = celdas(fila)[j];
        if (!celda) continue;
        const actual = celda.properties.className;
        celda.properties.className = [...(Array.isArray(actual) ? actual : actual ? [String(actual)] : []), clase];
      }
    }
  };
  const recorrer = (n: Root | Element) => {
    for (const h of n.children) {
      if (!esElemento(h)) continue;
      if (h.tagName === "table") marcarTabla(h);
      else recorrer(h);
    }
  };
  return () => (arbol: Root) => recorrer(arbol);
}

const plugins = { remark: [remarkGfm], rehype: [alinearCifras(s.num)] };

/** Los títulos de una respuesta quedan por debajo de los de la página. */
function Titulo({ node, children }: React.ComponentProps<"h1"> & ExtraProps) {
  void node;
  return <h4 className={s.tituloMd}>{children}</h4>;
}

// react-markdown pasa `node` (el árbol hast) a cada componente: no debe llegar al DOM.
const COMPONENTES: Components = {
  table: ({ node, children, ...props }) => {
    void node;
    return (
      <div className={s.tablaMd} role="region" aria-label="Tabla de la respuesta" tabIndex={0}>
        <table {...props}>{children}</table>
      </div>
    );
  },
  a: ({ node, children, href, ...props }) => {
    void node;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
  h1: Titulo,
  h2: Titulo,
  h3: Titulo,
  h4: Titulo,
  h5: Titulo,
  h6: Titulo,
};

/**
 * Respuesta del asistente en Markdown (con tablas GFM). Sin HTML crudo ni imágenes: el texto viene de un modelo y una
 * imagen externa podría filtrar datos al cargarse.
 */
export function RespuestaMarkdown({ texto: md }: { texto: string }) {
  return (
    <div className={s.md}>
      <Markdown
        remarkPlugins={plugins.remark}
        rehypePlugins={plugins.rehype}
        components={COMPONENTES}
        skipHtml
        disallowedElements={["img"]}
        unwrapDisallowed
      >
        {md}
      </Markdown>
    </div>
  );
}
