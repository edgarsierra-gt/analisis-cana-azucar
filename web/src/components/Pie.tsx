import Link from "next/link";
import { archivoRepo, REPO } from "@/lib/base";
import s from "./Pie.module.css";

export function Pie() {
  return (
    <footer className={s.pie}>
      <div className={`contenedor ${s.columnas}`}>
        <div>
          <p className={s.titulo}>Sobre este sitio</p>
          <p className={s.texto}>
            Solución de una prueba técnica de ciencia de datos para un ingenio azucarero. Los datos son públicos y de
            otros lugares: ensayos de caña de Louisiana, una caldera industrial y el mercado mundial del azúcar. Se
            traslada el método, no las cifras.
          </p>
        </div>
        <div>
          <p className={s.titulo}>Código y método</p>
          <ul className={s.lista}>
            <li><a href={REPO}>Repositorio en GitHub</a></li>
            <li><a href={archivoRepo("bitacora.md")}>Bitácora de decisiones</a></li>
            <li><a href={archivoRepo("docs/api.md")}>Documentación de la API</a></li>
            <li><Link href="/presentacion">Presentación ejecutiva</Link></li>
          </ul>
        </div>
        <div>
          <p className={s.titulo}>Autor</p>
          <p className={s.texto}>
            Edgar Sierra · <a href="https://edgarsierra.com">edgarsierra.com</a>
          </p>
          <p className={`${s.texto} ${s.nota}`}>
            Toda cifra de este sitio sale de los notebooks del repositorio y se reproduce corriéndolos.
          </p>
        </div>
      </div>
    </footer>
  );
}
