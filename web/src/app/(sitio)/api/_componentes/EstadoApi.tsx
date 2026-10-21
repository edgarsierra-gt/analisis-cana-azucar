"use client";

import { useEffect, useState } from "react";
import { API_URL, consultar } from "@/lib/api";
import s from "./EstadoApi.module.css";

type Salud = { estado: string; version: string; variedades_ciclo: number; variedades_pronostico: number; grupos: number };
type Estado =
  | { tipo: "consultando" }
  | { tipo: "ok"; salud: Salud; hora: string }
  | { tipo: "error"; mensaje: string };

const ESPERA_MS = 15000;

/** Llama a GET /salud y devuelve el estado para mostrar. Nunca lanza: un fallo es un estado más. */
async function pedirSalud(): Promise<Estado> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MS);
  try {
    const salud = await consultar<Salud>("/salud", undefined, { signal: control.signal, cache: "no-store" });
    const hora = new Date().toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
    return { tipo: "ok", salud, hora };
  } catch (e) {
    return { tipo: "error", mensaje: e instanceof Error ? e.message : "Error desconocido." };
  } finally {
    clearTimeout(reloj);
  }
}

/** Estado en vivo de la API: si responde, su versión, qué cargó y dónde está la documentación interactiva. */
export function EstadoApi() {
  const [estado, setEstado] = useState<Estado>({ tipo: "consultando" });

  useEffect(() => {
    let vigente = true;
    pedirSalud().then((e) => {
      if (vigente) setEstado(e);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const reintentar = async () => {
    setEstado({ tipo: "consultando" });
    setEstado(await pedirSalud());
  };

  const rotulo = { consultando: "Consultando…", ok: "Responde", error: "No responde" }[estado.tipo];

  return (
    <section className={s.estado} data-estado={estado.tipo} aria-labelledby="estado-api-titulo">
      <div className={s.cabeza}>
        <p id="estado-api-titulo" className="etiqueta">Estado en vivo · GET /salud</p>
        <p className={s.rotulo} role="status" aria-live="polite">
          <span className={s.marca} aria-hidden="true" />
          {rotulo}
        </p>
      </div>

      <dl className={s.datos}>
        <div>
          <dt>Dirección</dt>
          <dd className={s.url}>{API_URL}</dd>
        </div>
        {estado.tipo === "ok" && (
          <>
            <div>
              <dt>Versión</dt>
              <dd className="dato">{estado.salud.version}</dd>
            </div>
            <div>
              <dt>Cargó</dt>
              <dd>
                {estado.salud.variedades_ciclo} variedades para el ciclo, {estado.salud.variedades_pronostico} para el
                pronóstico y {estado.salud.grupos} grupos
              </dd>
            </div>
            <div>
              <dt>Consultado</dt>
              <dd className="dato">{estado.hora}</dd>
            </div>
          </>
        )}
      </dl>

      {estado.tipo === "error" && (
        <div className={s.aviso}>
          <p>{estado.mensaje}</p>
          <p>
            En el sitio publicado la API corre en Cloud Run. En local se levanta con <code>docker compose up --build</code> desde la raíz del repositorio.
          </p>
        </div>
      )}

      <div className={s.acciones}>
        <a className="boton" href={`${API_URL}/docs`} target="_blank" rel="noreferrer">
          Abrir la documentación interactiva
        </a>
        <button type="button" className="boton boton-sec" onClick={reintentar} disabled={estado.tipo === "consultando"}>
          Consultar de nuevo
        </button>
      </div>
    </section>
  );
}
