"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import s from "./Encabezado.module.css";

// La marca lleva al inicio: no hace falta un enlace "Inicio".
const SECCIONES = [
  { href: "/campo", texto: "Campo", serie: "campo" },
  { href: "/caldera", texto: "Caldera", serie: "caldera" },
  { href: "/mercado", texto: "Mercado", serie: "mercado" },
  { href: "/api", texto: "API" },
  { href: "/herramientas", texto: "Herramientas" },
  { href: "/asistente", texto: "Asistente" },
];

/**
 * Barra del sitio: marca, seis enlaces y una sola acción ("Presentar"). 64 px (56 en el teléfono), fondo blanco y sin
 * borde; al desplazar gana una sombra suave porque flota sobre el contenido. En el teléfono, "Menú" abre una hoja a
 * pantalla completa.
 *
 * El color de la página sale de la ruta: en /campo, /caldera y /mercado la barra lleva data-serie, así el enlace activo
 * y el botón "Presentar" toman el color de esa serie. En las demás páginas mandan la tinta.
 */
export function Encabezado() {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [desplazado, setDesplazado] = useState(false);
  const activa = (href: string) => ruta.startsWith(href);
  const serie = SECCIONES.find((x) => x.serie && activa(x.href))?.serie;

  useEffect(() => {
    const medir = () => setDesplazado(window.scrollY > 4);
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    return () => window.removeEventListener("scroll", medir);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [abierto]);

  return (
    <header className={s.encabezado} data-serie={serie} data-desplazado={desplazado || abierto ? "" : undefined}>
      <div className={`contenedor ${s.barra}`}>
        <Link href="/" className={s.marca} onClick={() => setAbierto(false)}>
          Caña de azúcar
        </Link>
        <button
          type="button"
          className={s.menu}
          aria-expanded={abierto}
          aria-controls="navegacion"
          onClick={() => setAbierto(!abierto)}
        >
          {abierto ? "Cerrar" : "Menú"}
        </button>
        <nav id="navegacion" className={`${s.nav} ${abierto ? s.abierto : ""}`} aria-label="Secciones">
          {SECCIONES.map((x) => (
            <Link
              key={x.href}
              href={x.href}
              data-serie={x.serie}
              className={s.enlace}
              aria-current={activa(x.href) ? "page" : undefined}
              onClick={() => setAbierto(false)}
            >
              {x.texto}
            </Link>
          ))}
          <Link href="/presentacion" className={`boton ${s.presentar}`} onClick={() => setAbierto(false)}>
            Presentar
          </Link>
        </nav>
      </div>
    </header>
  );
}
