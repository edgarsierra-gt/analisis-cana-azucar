"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { API_URL, consultar } from "@/lib/api";
import { num } from "@/lib/formato";
import s from "./inicio.module.css";

type Salud = { estado: string; version: string; variedades_ciclo: number; variedades_pronostico: number; grupos: number };
type Estado =
  | { tipo: "consultando" }
  | { tipo: "ok"; salud: Salud; ms: number; hora: string }
  | { tipo: "error" };

/** El sitio publicado consulta la API de Cloud Run; en local, la del Docker de `docker compose up`. */
const EN_LA_NUBE = API_URL.includes("run.app");
const ESPERA_MS = 20000;
/** Desde este tiempo la respuesta fue lenta: lo normal es que la API estuviera apagada y tuviera que arrancar. */
const LENTO_MS = 1500;

async function pedirSalud(): Promise<Estado> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MS);
  const t0 = performance.now();
  try {
    const salud = await consultar<Salud>("/salud", undefined, { signal: control.signal, cache: "no-store" });
    const ms = Math.round(performance.now() - t0);
    const hora = new Date().toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    return salud.estado === "ok" ? { tipo: "ok", salud, ms, hora } : { tipo: "error" };
  } catch {
    return { tipo: "error" };
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Prueba en vivo de que los modelos corren en producción: al abrir la portada, el navegador pregunta a la API
 * (GET /salud, que no gasta la cuota) y muestra si respondió, en cuánto tiempo y qué cargó. Un fallo es un estado más.
 */
export function ApiEnVivo() {
  const [estado, setEstado] = useState<Estado>({ tipo: "consultando" });

  const consultarAhora = useCallback(async () => {
    setEstado({ tipo: "consultando" });
    setEstado(await pedirSalud());
  }, []);

  useEffect(() => {
    let vigente = true;
    pedirSalud().then((e) => {
      if (vigente) setEstado(e);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const donde = EN_LA_NUBE ? "en Cloud Run" : "local, en Docker,";

  return (
    <div className={s.vivo} data-estado={estado.tipo}>
      <p className={s.vivoEstado} role="status" aria-live="polite">
        <span className={s.vivoMarca} aria-hidden="true" />
        {estado.tipo === "ok" ? "La API responde" : estado.tipo === "error" ? "La API no respondió" : "Preguntando a la API…"}
      </p>
      <div className={s.vivoTexto}>
        {estado.tipo === "ok" ? (
          <p>
            Su navegador le preguntó <code>GET /salud</code> a la API {donde} a las{" "}
            <span className="num">{estado.hora}</span> y contestó en <strong className="num">{num(estado.ms)}&nbsp;ms</strong>.
            Versión {estado.salud.version}: cargó{" "}
            {estado.salud.variedades_ciclo} variedades para el ciclo, {estado.salud.variedades_pronostico} para el pronóstico
            y {estado.salud.grupos} grupos.
            {/* fuente: README, "Costos" (Cloud Run escala a cero cuando nadie la usa) */}
            {EN_LA_NUBE && estado.ms > LENTO_MS && <> Si tardó segundos, estaba apagada: Cloud Run la enciende con la primera consulta.</>}
          </p>
        ) : estado.tipo === "error" ? (
          <p>
            Puede estar arrancando: Cloud Run la apaga cuando nadie la usa. Espere unos segundos y vuelva a preguntar. En
            local se levanta con <code>docker compose up --build</code>.
          </p>
        ) : (
          <p>
            Su navegador le pregunta <code>GET /salud</code> en este momento.
          </p>
        )}
      </div>
      <div className={s.vivoAcciones}>
        {estado.tipo === "error" ? (
          <button type="button" className="boton boton-sec" onClick={() => void consultarAhora()}>
            Preguntar de nuevo
          </button>
        ) : (
          <Link href="/api">Ver la API y sus consultas</Link>
        )}
      </div>
    </div>
  );
}
