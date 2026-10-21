"use client";

import { useEffect } from "react";
import { API_URL } from "@/lib/api";
import { useConsulta } from "./consulta";
import s from "./herramientas.module.css";

type Salud = { estado: string; version: string; variedades_ciclo: number; variedades_pronostico: number; grupos: number };

/** Estado de la API (GET /salud) y qué hacer si no responde. */
export function EstadoApi() {
  const { fase, datos, error, ms, ejecutar } = useConsulta<Salud>();

  useEffect(() => {
    void ejecutar("/salud");
  }, [ejecutar]);

  const ok = fase === "listo" && datos?.estado === "ok";
  const marca = ok ? s.marcaOk : fase === "error" ? s.marcaError : "";

  return (
    <div className={s.estado}>
      <span className={`${s.marca} ${marca}`} aria-hidden="true" />
      <div className={s.estadoTexto} role="status" aria-live="polite">
        {ok && datos ? (
          <>
            <p className={s.estadoTitulo}>
              API en línea · versión {datos.version}
              {ms !== undefined ? ` · respondió en ${ms} ms` : ""}
            </p>
            <p>
              Cargó los modelos de los notebooks: {datos.variedades_ciclo} variedades para el ciclo de renovación,{" "}
              {datos.variedades_pronostico} para el pronóstico de azúcar y {datos.grupos} grupos de variedades.
            </p>
          </>
        ) : fase === "error" ? (
          <>
            <p className={s.estadoTitulo}>La API no responde</p>
            <p>{error}</p>
            <ol>
              <li>
                En una computadora: abra Docker Desktop y, desde la raíz del repositorio, corra{" "}
                <code>docker compose up --build</code>. La API queda en <code>http://localhost:8000</code>.
              </li>
              <li>
                En la nube: si nadie la usó en un rato, la API está apagada y tarda unos segundos en arrancar. Espere y
                vuelva a probar.
              </li>
              <li>
                El sitio busca la API en <code>{API_URL}</code> (variable <code>NEXT_PUBLIC_API_URL</code>).
              </li>
            </ol>
          </>
        ) : (
          <p className={s.estadoTitulo}>Comprobando la conexión con la API…</p>
        )}
      </div>
      {fase === "error" && (
        <button type="button" className="boton boton-sec" onClick={() => void ejecutar("/salud")}>
          Volver a probar
        </button>
      )}
    </div>
  );
}
