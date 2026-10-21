"use client";

import { useEffect, useRef, useState } from "react";
import { Desplegable } from "@/components/Nota";
import type { Fase } from "./consulta";
import s from "./herramientas.module.css";

/**
 * Bloque de respuesta de una herramienta: una frase con el resultado (región aria-live), el detalle y, al pie, el sello
 * de la consulta ("Respondió POST /campo/ciclo en 125 ms"). Mientras llega una respuesta nueva, la anterior queda
 * visible y atenuada para que la página no salte.
 *
 * La cabeza (frase y cifras, `cabeza`) va marcada como fragmento de interfaz (data-ui): es la pantalla de la
 * herramienta. Lo que va en `children` (figura, tabla, certeza) queda en el flujo de la página.
 */
export function Respuesta({
  fase, ruta, ms, error, titular, vacio, onReintentar, cabeza, children,
}: {
  fase: Fase;
  ruta?: string;
  ms?: number;
  error?: string;
  /** La respuesta en una frase. Es lo que anuncian los lectores de pantalla. */
  titular?: React.ReactNode;
  /** Texto antes de la primera consulta. */
  vacio?: React.ReactNode;
  onReintentar?: () => void;
  /** Cifras de la respuesta, pegadas a la frase. */
  cabeza?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const cargando = fase === "cargando";
  return (
    <div className={s.respuesta}>
      <div className={s.cabezaRespuesta} data-ui="">
        <div role="status" aria-live="polite" aria-atomic="true">
          {fase === "error" ? (
            <div className={s.error}>
              <p>
                <strong>No se pudo calcular.</strong> {error}
              </p>
              {onReintentar && (
                <button type="button" className={`boton-sec boton ${s.botonChico}`} onClick={onReintentar}>
                  Volver a intentar
                </button>
              )}
            </div>
          ) : titular ? (
            <p className={`${s.titular} ${cargando ? s.atenuado : ""}`}>{titular}</p>
          ) : cargando ? (
            <p className={s.espera}>Consultando la API…</p>
          ) : vacio ? (
            <p className={s.vacio}>{vacio}</p>
          ) : null}
        </div>
        {fase !== "error" && cabeza && (
          <div className={`${s.detalle} ${cargando ? s.atenuado : ""}`} aria-busy={cargando}>
            {cabeza}
          </div>
        )}
      </div>
      {fase !== "error" && children && (
        <div className={`${s.detalle} ${cargando ? s.atenuado : ""}`} aria-busy={cargando}>
          {children}
        </div>
      )}
      {ruta && <Sello ruta={ruta} fase={fase} ms={ms} />}
    </div>
  );
}

/** El sello de la consulta: qué ruta respondió y en cuánto tiempo. Es la prueba de que la respuesta es en vivo. */
function Sello({ ruta, fase, ms }: { ruta: string; fase: Fase; ms?: number }) {
  const [metodo, ...resto] = ruta.split(" ");
  const codigo = (
    <code>
      {metodo} {resto.join(" ")}
    </code>
  );
  return (
    <p className={s.sello}>
      {fase === "cargando" ? (
        <>Consultando {codigo}…</>
      ) : fase === "error" ? (
        <>Falló {codigo}.</>
      ) : (
        <>
          Respondió {codigo}
          {ms !== undefined ? ` en ${ms} ms` : ""}.
        </>
      )}
    </p>
  );
}

/**
 * El único desplegable de cada herramienta: cómo calcula la API (texto de la página), lo propio de la respuesta actual
 * (supuestos, desglose, tablas largas) y la respuesta completa en JSON. El contenido se arma al abrirlo: la respuesta de
 * la auditoría, por ejemplo, ocupa miles de renglones y no tiene por qué pintarse mientras nadie la pide.
 */
export function DetalleTecnico({
  metodo, respuestas = [], children,
}: {
  metodo?: React.ReactNode;
  respuestas?: { titulo: string; datos: unknown }[];
  children?: React.ReactNode;
}) {
  return (
    <Desplegable titulo="Detalle técnico">
      <AlAbrir>
      {metodo && (
        <div className={s.bloqueDetalle}>
          <h3 className={s.tituloDetalle}>Cómo lo calcula la API</h3>
          {metodo}
        </div>
      )}
      {children}
      {respuestas.map((r) => (
        <div className={s.bloqueDetalle} key={r.titulo}>
          <h3 className={s.tituloDetalle}>{r.titulo}</h3>
          <pre className={s.json} tabIndex={0} aria-label={r.titulo}>
            <code>{JSON.stringify(r.datos, null, 2)}</code>
          </pre>
        </div>
      ))}
      </AlAbrir>
    </Desplegable>
  );
}

/** Pinta su contenido solo mientras el <details> que lo contiene está abierto. */
function AlAbrir({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    const detalles = ref.current?.closest("details");
    if (!detalles) return;
    const medir = () => setAbierto(detalles.open);
    medir();
    detalles.addEventListener("toggle", medir);
    return () => detalles.removeEventListener("toggle", medir);
  }, []);
  return (
    <div ref={ref} className={s.alAbrir}>
      {abierto ? children : null}
    </div>
  );
}

/** Un bloque con título dentro del detalle técnico. */
export function BloqueDetalle({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className={s.bloqueDetalle}>
      <h3 className={s.tituloDetalle}>{titulo}</h3>
      {children}
    </div>
  );
}

/** Cifras secundarias de una respuesta: una línea cada una, con el valor en el color de la serie. */
export function Secundarias({ children }: { children: React.ReactNode }) {
  return <ul className={s.secundarias}>{children}</ul>;
}
