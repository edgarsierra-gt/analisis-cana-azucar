"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Orden de entrada: el número de data-entrada, o, si viene vacío, su lugar entre los hermanos que también entran. */
function orden(el: HTMLElement) {
  const n = el.dataset.entrada;
  if (n) return Number(n) || 0;
  const hermanos = el.parentElement ? [...el.parentElement.children].filter((h) => h.hasAttribute("data-entrada")) : [];
  return Math.max(0, hermanos.indexOf(el));
}

/**
 * Entrada discreta, una sola vez, de lo que asoma en pantalla: los elementos con `data-entrada` (el h2, la entrada y
 * las cifras de cada Seccion; cada Cifra; la decisión y las tres columnas de cada Evaluación) suben 12 px con opacidad en
 * 300 ms, escalonados 60 ms (como máximo 360 ms). `data-entrada="n"` fija el orden; vacío, lo da su lugar entre hermanos.
 *
 * Mueve lo que ya está: el contenido se pinta completo sin script y lo que ya se ve al cargar no se anima. La animación
 * es una clase (`.entrando`, en globals.css) que solo existe con prefers-reduced-motion: no-preference y arranca desde
 * el estado oculto con fill "backwards": nada queda escondido si el script falla.
 * Se monta una vez en el layout del sitio y se vuelve a enganchar en cada cambio de ruta.
 */
export function Movimiento() {
  const ruta = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") return;
    const pendientes = [...document.querySelectorAll<HTMLElement>("[data-entrada]")].filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight,   // solo lo que todavía no se ve
    );
    if (pendientes.length === 0) return;
    const obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        obs.unobserve(el);
        // La animación vive en globals.css (@keyframes entrar, solo con prefers-reduced-motion: no-preference); aquí
        // solo se dispara. Sin script, la clase nunca llega y todo se ve en su estado final.
        el.style.setProperty("--retraso", `${Math.min(orden(el) * 60, 360)}ms`);
        el.classList.add("entrando");
        el.addEventListener("animationend", () => el.classList.remove("entrando"), { once: true });
      }
    }, { threshold: 0 });
    pendientes.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ruta]);

  return null;
}
