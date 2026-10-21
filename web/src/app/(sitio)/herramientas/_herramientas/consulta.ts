"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorApi, consultar } from "@/lib/api";

/** Texto para cuando el navegador no llega a la API (Docker apagado o servicio en frío). */
export const SIN_CONEXION =
  "No hay conexión con la API. Puede estar arrancando: espere unos segundos y vuelva a intentar.";

/** Mensaje para la persona: los 422 de la API se muestran tal cual, con el código. */
export function mensajeError(e: unknown): string {
  if (e instanceof ErrorApi) {
    if (e.estado === 0) return SIN_CONEXION;
    if (e.estado === 422) return `La API rechazó la entrada (422): ${e.message}`;
    // consultar() devuelve "Error <código>" cuando la respuesta no trae detalle: no repetir el código.
    return e.message === `Error ${e.estado}`
      ? `La API respondió con error ${e.estado}.`
      : `La API respondió con error ${e.estado}: ${e.message}`;
  }
  return "La respuesta de la API no se pudo leer.";
}

export type Fase = "inactivo" | "cargando" | "listo" | "error";

export type EstadoConsulta<T> = {
  fase: Fase;
  datos?: T;
  error?: string;
  /** Método y ruta de la última consulta, para mostrarla junto a la respuesta. */
  ruta?: string;
  /** Tiempo de respuesta, en milisegundos. */
  ms?: number;
};

/**
 * Una consulta a la API con estado de carga y error. Cancela la consulta anterior si llega otra:
 * así una respuesta vieja nunca pisa a una nueva.
 */
export function useConsulta<T>() {
  const [estado, setEstado] = useState<EstadoConsulta<T>>({ fase: "inactivo" });
  const control = useRef<AbortController | null>(null);

  useEffect(() => () => control.current?.abort(), []);

  /** `alListo` recibe la respuesta si llegó bien y no fue reemplazada por otra consulta. */
  const ejecutar = useCallback(async (ruta: string, cuerpo?: unknown, alListo?: (datos: T) => void) => {
    control.current?.abort();
    const c = new AbortController();
    control.current = c;
    const etiqueta = `${cuerpo === undefined ? "GET" : "POST"} ${ruta}`;
    setEstado((e) => ({ ...e, fase: "cargando", error: undefined, ruta: etiqueta }));
    const t0 = performance.now();
    try {
      const datos = await consultar<T>(ruta, cuerpo, { signal: c.signal });
      if (c.signal.aborted) return;
      setEstado({ fase: "listo", datos, ruta: etiqueta, ms: Math.round(performance.now() - t0) });
      alListo?.(datos);
    } catch (e) {
      if (!c.signal.aborted) setEstado({ fase: "error", error: mensajeError(e), ruta: etiqueta });
    }
  }, []);

  return { ...estado, ejecutar };
}

// ───────────────────────────────────────────────────────────────── catálogo de campo (GET /campo/variedades)

export type Supuestos = { precio: number; corte: number; mantenimiento: number; renovacion: number; barbecho: number };

export type Catalogo = {
  variedades_ciclo: string[];
  variedades_pronostico: string[];
  fincas_pronostico: string[];
  testigos_nucleo: string[];
  grupos: string[];
  supuestos_por_defecto: Supuestos;
};

export type RespuestaVariedades = {
  supuestos: Supuestos;
  testigo_promedio: { ciclo_optimo_cortes: number; margen_anual_usd_acre: number };
  variedades: { puesto: number; variedad: string; ciclo_optimo_cortes: number; margen_anual_usd_acre: number }[];
  catalogo: Catalogo;
};

let pendiente: Promise<RespuestaVariedades> | null = null;

/** Una sola consulta al catálogo para todas las herramientas de campo; si falla, el próximo intento consulta de nuevo. */
function obtenerVariedades(): Promise<RespuestaVariedades> {
  pendiente ??= consultar<RespuestaVariedades>("/campo/variedades").catch((e: unknown) => {
    pendiente = null;
    throw e;
  });
  return pendiente;
}

export function useVariedades() {
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState<{ datos?: RespuestaVariedades; error?: string }>({});

  useEffect(() => {
    let vigente = true;
    obtenerVariedades().then(
      (datos) => {
        if (vigente) setEstado({ datos });
      },
      (e: unknown) => {
        if (vigente) setEstado({ error: mensajeError(e) });
      },
    );
    return () => {
      vigente = false;
    };
  }, [intento]);

  const reintentar = useCallback(() => {
    setEstado({});
    setIntento((n) => n + 1);
  }, []);

  return { ...estado, cargando: !estado.datos && !estado.error, reintentar };
}

/** Texto de un número de corte: 0 = plantía. */
export const nombreCorte = (k: number) => (k === 0 ? "plantía" : `soca ${k}`);
