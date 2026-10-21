"use client";

import { Desplegable } from "@/components/Nota";
import type { Fase } from "./consulta";
import s from "./herramientas.module.css";

/**
 * Bloque de respuesta de una herramienta: consulta hecha, tiempo, una frase con el resultado (región aria-live) y el
 * detalle. Mientras llega una respuesta nueva, la anterior queda visible y atenuada para que la página no salte.
 */
export function Respuesta({
  fase, ruta, ms, error, titular, vacio, onReintentar, children,
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
  children?: React.ReactNode;
}) {
  const cargando = fase === "cargando";
  return (
    <div className={s.respuesta}>
      <div className={s.cabezaRespuesta}>
        <p className="etiqueta">Respuesta de la API</p>
        {ruta && (
          <p className={s.ruta}>
            {ruta}
            {cargando ? <span className={s.consultando}> · consultando…</span> : fase === "listo" && ms !== undefined ? ` · ${ms} ms` : ""}
          </p>
        )}
      </div>
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
      {fase !== "error" && children && (
        <div className={`${s.detalle} ${cargando ? s.atenuado : ""}`} aria-busy={cargando}>
          {children}
        </div>
      )}
    </div>
  );
}

/** La respuesta completa, tal como la devuelve la API. */
export function RespuestaJson({ datos }: { datos: unknown }) {
  return (
    <Desplegable titulo="Ver la respuesta completa (JSON)">
      <pre className={s.json} tabIndex={0} aria-label="Respuesta JSON de la API">
        <code>{JSON.stringify(datos, null, 2)}</code>
      </pre>
    </Desplegable>
  );
}
