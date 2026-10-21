import Link from "next/link";
import { Certeza, type NivelCerteza } from "@/components/Certeza";
import s from "./inicio.module.css";

/**
 * Cuerpo de un capítulo de serie en la portada, debajo del hallazgo (h2), la recomendación (entrada) y sus cifras.
 * A la izquierda va el relato: para qué decisión sirve y qué significa para el ingenio, la certeza con su motivo y los
 * tres caminos para seguir (el caso completo, la herramienta que lo calcula y la consulta de la API). A la derecha, la
 * figura que lo prueba, en un panel blanco sobre el tinte de la serie. En el teléfono la figura va primero.
 */
export function Capitulo({
  figura, contexto, certeza, caso, herramienta, consulta,
}: {
  figura: React.ReactNode;
  contexto: React.ReactNode;
  certeza: { nivel: NivelCerteza; motivo: React.ReactNode };
  caso: { href: string; texto: string };
  herramienta: { href: string; texto: string };
  /** Método y ruta de la consulta de la API que da la misma respuesta, por ejemplo "POST /campo/ciclo". */
  consulta: string;
}) {
  return (
    <div className={s.capitulo}>
      <div className={s.panelFigura}>{figura}</div>
      <div className={s.lado} data-entrada="">
        <div className={s.contexto}>{contexto}</div>
        <Certeza nivel={certeza.nivel}>{certeza.motivo}</Certeza>
        <div className={s.caminos}>
          <Link href={caso.href} className="boton">
            {caso.texto}
          </Link>
          <ul>
            <li>
              <Link href={herramienta.href}>{herramienta.texto}</Link>
            </li>
            <li>
              <Link href="/api#consultas">
                La consulta <code>{consulta}</code> en la API
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
