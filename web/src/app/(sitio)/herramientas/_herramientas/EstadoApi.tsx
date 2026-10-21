"use client";

import { useEffect } from "react";
import { CifraPortada } from "@/components/Portada";
import { API_URL } from "@/lib/api";
import { num } from "@/lib/formato";
import { useConsulta } from "./consulta";
import s from "./herramientas.module.css";

type Salud = { estado: string; version: string; variedades_ciclo: number; variedades_pronostico: number; grupos: number };

/** El sitio publicado consulta la API de Cloud Run; en local, la del Docker de `docker compose up`. */
const EN_LA_NUBE = API_URL.includes("run.app");
/** Desde este tiempo, la respuesta fue lenta: lo normal es que la API estuviera apagada y tuviera que arrancar. */
const LENTO_MS = 1500;

/**
 * Pieza de la portada: el estado de la API en vivo (GET /salud). Si responde, la cifra es el tiempo que tardó, medido en
 * este momento desde el navegador. Si no, qué hacer para levantarla.
 */
export function EstadoApi() {
  const { fase, datos, error, ms, ejecutar } = useConsulta<Salud>();

  useEffect(() => {
    void ejecutar("/salud");
  }, [ejecutar]);

  const ok = fase === "listo" && datos?.estado === "ok";

  return (
    <div className={s.estado} role="status" aria-live="polite">
      {ok && datos ? (
        <CifraPortada
          valor={ms !== undefined ? num(ms) : "…"}
          unidad="ms"
          etiqueta={EN_LA_NUBE ? "La API en Cloud Run respondió ahora mismo" : "La API local respondió ahora mismo"}
          detalle={
            <>
              Tiempo de <code>GET /salud</code> medido desde su navegador; versión {datos.version}. Cargó{" "}
              {datos.variedades_ciclo} variedades para el ciclo de renovación, {datos.variedades_pronostico} para el
              pronóstico de azúcar y {datos.grupos} grupos de variedades.
              {/* fuente: README, "Costos" (Cloud Run escala a cero cuando nadie la usa) */}
              {EN_LA_NUBE && ms !== undefined && ms > LENTO_MS && (
                <> Si tardó segundos, estaba apagada: Cloud Run la apaga cuando nadie la usa y la enciende con la primera consulta.</>
              )}
            </>
          }
        />
      ) : fase === "error" ? (
        <div className={s.estadoError}>
          <p className={s.estadoTitulo}>La API no responde</p>
          <p>{error}</p>
          <ol>
            <li>
              En una computadora: abra Docker Desktop y, desde la raíz del repositorio, corra{" "}
              <code>docker compose up --build</code>. La API queda en <code>http://localhost:8000</code>.
            </li>
            <li>
              En la nube: si nadie la usó en un rato, la API está apagada y tarda unos segundos en arrancar. Espere y vuelva
              a probar.
            </li>
            <li>
              El sitio busca la API en <code>{API_URL}</code> (variable <code>NEXT_PUBLIC_API_URL</code>).
            </li>
          </ol>
          <button type="button" className="boton boton-sec" onClick={() => void ejecutar("/salud")}>
            Volver a probar
          </button>
        </div>
      ) : (
        <CifraPortada valor="…" etiqueta="Comprobando la conexión con la API" />
      )}
    </div>
  );
}
