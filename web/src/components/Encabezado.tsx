"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import s from "./Encabezado.module.css";

const SECCIONES = [
  { href: "/", texto: "Inicio" },
  { href: "/campo", texto: "Campo", serie: "campo" },
  { href: "/caldera", texto: "Caldera", serie: "caldera" },
  { href: "/mercado", texto: "Mercado", serie: "mercado" },
  { href: "/api", texto: "API" },
  { href: "/herramientas", texto: "Herramientas" },
  { href: "/asistente", texto: "Asistente" },
];

export function Encabezado() {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const activa = (href: string) => (href === "/" ? ruta === "/" : ruta.startsWith(href));

  return (
    <header className={s.encabezado}>
      <div className={`contenedor ${s.barra}`}>
        <Link href="/" className={s.marca} onClick={() => setAbierto(false)}>
          <span className={s.marcaTitulo}>Caña de azúcar</span>
          <span className={s.marcaSub}>campo · fábrica · mercado</span>
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
          <Link href="/presentacion" className={s.presentar} onClick={() => setAbierto(false)}>
            Presentar
          </Link>
        </nav>
      </div>
    </header>
  );
}
