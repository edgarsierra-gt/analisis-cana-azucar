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

/**
 * Estado en vivo de la API, en una sola fila: si responde (GET /salud, que no gasta la cuota), dónde está, qué versión
 * corre y qué cargó. `version` es la del código (api/main.py); si la API responde, se muestra la que ella dice.
 */
export function EstadoApi({ version }: { version: string }) {
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
        <p id="estado-api-titulo" className={s.titulo}>Estado en vivo de la API</p>
        <p className={s.rotulo} role="status" aria-live="polite">
          <span className={s.marca} aria-hidden="true" />
          {rotulo}
        </p>
        <p className={s.consulta}>
          Pregunta a <code>GET /salud</code>
          {/* "es-GT" da la hora como "02:30 a. m.": ya trae su punto, no se le agrega otro */}
          {estado.tipo === "ok" ? (
            <>, a las <span className="num">{estado.hora}</span>{estado.hora.endsWith(".") ? "" : "."}</>
          ) : "."}
        </p>
      </div>

      <dl className={s.datos}>
        <div className={s.direccion}>
          <dt>Dirección</dt>
          <dd><code className={s.url}>{API_URL}</code></dd>
        </div>
        <div>
          <dt>Versión</dt>
          <dd className="num">{estado.tipo === "ok" ? estado.salud.version : version}</dd>
        </div>
        {estado.tipo === "ok" && (
          <div className={s.cargo}>
            <dt>Cargó</dt>
            <dd>
              {estado.salud.variedades_ciclo} variedades para el ciclo, {estado.salud.variedades_pronostico} para el
              pronóstico y {estado.salud.grupos} grupos
            </dd>
          </div>
        )}
      </dl>

      <div className={s.acciones}>
        <button type="button" className="boton boton-sec" onClick={reintentar} disabled={estado.tipo === "consultando"}>
          Consultar de nuevo
        </button>
      </div>

      {estado.tipo === "error" && (
        <div className={s.aviso}>
          <p>{estado.mensaje}</p>
          <p>
            En el sitio publicado la API corre en Cloud Run. En local se levanta con <code>docker compose up --build</code> desde la raíz del repositorio.
          </p>
        </div>
      )}
    </section>
  );
}
