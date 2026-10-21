"use client";

import { useCallback, useEffect, useState } from "react";
import { consultar } from "@/lib/api";
import s from "./presentacion.module.css";

type Salud = { estado: string; version: string; variedades_ciclo: number; variedades_pronostico: number; grupos: number };
type Estado = { tipo: "consultando" } | { tipo: "ok"; salud: Salud; hora: string } | { tipo: "error" };

const ESPERA_MS = 15000;

/**
 * Prueba viva de que la API está en producción: pregunta a GET /salud (no gasta la cuota) al abrir la presentación y
 * con el botón. Dice si responde, a qué hora y qué cargó, sin nombrar la nube.
 */
export function EstadoApiD() {
  const [estado, setEstado] = useState<Estado>({ tipo: "consultando" });

  const pedir = useCallback(async () => {
    setEstado({ tipo: "consultando" });
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), ESPERA_MS);
    try {
      const salud = await consultar<Salud>("/salud", undefined, { signal: control.signal, cache: "no-store" });
      const hora = new Date().toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
      setEstado({ tipo: "ok", salud, hora });
    } catch {
      setEstado({ tipo: "error" });
    } finally {
      clearTimeout(reloj);
    }
  }, []);

  useEffect(() => {
    // Primera consulta al montar: el estado inicial ya es "consultando".
    let vigente = true;
    const control = new AbortController();
    consultar<Salud>("/salud", undefined, { signal: control.signal, cache: "no-store" })
      .then((salud) => {
        if (!vigente) return;
        const hora = new Date().toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
        setEstado({ tipo: "ok", salud, hora });
      })
      .catch(() => vigente && setEstado({ tipo: "error" }));
    const reloj = setTimeout(() => control.abort(), ESPERA_MS);
    return () => {
      vigente = false;
      clearTimeout(reloj);
      control.abort();
    };
  }, []);

  const rotulo = { consultando: "Consultando la API…", ok: "La API responde", error: "La API no respondió" }[estado.tipo];

  return (
    <div className={s.estadoApi} data-estado={estado.tipo}>
      <p className={s.estadoRotulo} role="status" aria-live="polite">
        <span className={s.estadoMarca} aria-hidden="true" />
        {rotulo}
      </p>
      <p className={s.estadoDetalle}>
        {estado.tipo === "ok" ? (
          <>
            Consulta en vivo a <code>GET /salud</code> a las <span className={s.num}>{estado.hora}</span>: versión{" "}
            {estado.salud.version}, con {estado.salud.variedades_ciclo} variedades para el ciclo,{" "}
            {estado.salud.variedades_pronostico} para el pronóstico y {estado.salud.grupos} perfiles cargados.
          </>
        ) : estado.tipo === "error" ? (
          <>Si nadie la usó en un rato, arranca en unos segundos. Abrir las herramientas antes de presentar la despierta.</>
        ) : (
          <>Pregunta a <code>GET /salud</code>, que no gasta la cuota.</>
        )}
      </p>
      <button type="button" className={s.estadoBoton} onClick={pedir} disabled={estado.tipo === "consultando"}>
        Consultar de nuevo
      </button>
    </div>
  );
}
