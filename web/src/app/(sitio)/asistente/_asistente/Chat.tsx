"use client";

import { useEffect, useId, useRef, useState } from "react";
import { API_URL, ErrorApi, consultar } from "@/lib/api";
import { num } from "@/lib/formato";
import {
  LIMITES,
  MODELO,
  SUGERENCIAS,
  nombreModelo,
  type EstadoAsistente,
  type LlamadaHerramienta,
  type Mensaje,
  type RespuestaAsistente,
} from "./contrato";
import { RespuestaMarkdown } from "./RespuestaMarkdown";
import s from "./Chat.module.css";

const ESPERA_ESTADO_MS = 15_000;
// Cada llamada al modelo tiene 45 s de tiempo máximo en la API (api/asistente.py); las respuestas normales tardan
// de 2 a 7 s (bitácora D82). Más de 3 minutos ya no es una espera razonable.
const ESPERA_RESPUESTA_MS = 180_000;

type Turno = {
  id: number;
  pregunta: string;
  fase: "esperando" | "listo" | "error";
  respuesta?: RespuestaAsistente;
  error?: { mensaje: string; reintentable: boolean };
};

type Disponibilidad =
  | { tipo: "consultando" }
  | { tipo: "listo"; estado: EstadoAsistente }
  /** La API responde, pero no tiene /asistente (404): una versión anterior, por ejemplo el Docker local. */
  | { tipo: "sin-asistente" }
  /** `conexion`: el navegador no llegó a la API. Si no, la API respondió con otro error (por ejemplo, 429 o 500). */
  | { tipo: "error"; mensaje: string; conexion: boolean };

/** Sin conexión con la API. Es el mensaje de ErrorApi, con trato de usted como el resto del chat. */
const SIN_CONEXION = "No hay conexión con la API. Puede estar arrancando: espere unos segundos y vuelva a intentar.";

const esEstado = (x: unknown): x is EstadoAsistente =>
  typeof x === "object" &&
  x !== null &&
  typeof (x as EstadoAsistente).disponible === "boolean" &&
  typeof (x as EstadoAsistente).restantes_hoy === "number";

const esRespuesta = (x: unknown): x is RespuestaAsistente =>
  typeof x === "object" &&
  x !== null &&
  typeof (x as RespuestaAsistente).respuesta === "string" &&
  Array.isArray((x as RespuestaAsistente).herramientas) &&
  typeof (x as RespuestaAsistente).restantes_hoy === "number";

/** El `detail` de la API tal cual; si la respuesta no trae detalle, el código. */
function textoError(e: unknown): string {
  if (e instanceof ErrorApi) {
    if (e.estado === 0) return SIN_CONEXION;
    return e.message === `Error ${e.estado}` ? `La API respondió con error ${e.estado}.` : e.message;
  }
  return "La respuesta de la API no se pudo leer.";
}

/** GET /asistente/estado. No gasta la cuota y nunca lanza: un fallo es un estado más. */
async function pedirEstado(): Promise<Disponibilidad> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_ESTADO_MS);
  try {
    const e = await consultar<unknown>("/asistente/estado", undefined, { signal: control.signal, cache: "no-store" });
    return esEstado(e) ? { tipo: "listo", estado: e } : { tipo: "sin-asistente" };
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 404) return { tipo: "sin-asistente" };
    return { tipo: "error", mensaje: textoError(e), conexion: e instanceof ErrorApi && e.estado === 0 };
  } finally {
    clearTimeout(reloj);
  }
}

/** Recorta un mensaje del historial al largo que acepta la API, sin partir un carácter de dos unidades (emoji). */
function recortar(t: string): string {
  if (t.length <= LIMITES.maxTextoHistorial) return t;
  const r = t.slice(0, LIMITES.maxTextoHistorial);
  return /[\uD800-\uDBFF]$/.test(r) ? r.slice(0, -1) : r;
}

/** Los últimos mensajes completos de la conversación, sin la pregunta actual ni los turnos con error. */
function historialDe(turnos: Turno[]): Mensaje[] {
  return turnos
    .flatMap((t): Mensaje[] =>
      t.fase === "listo" && t.respuesta
        ? [
            { rol: "usuario", texto: recortar(t.pregunta) },
            { rol: "asistente", texto: recortar(t.respuesta.respuesta) },
          ]
        : [],
    )
    .slice(-LIMITES.maxHistorial);
}

const disponibles = (n: number) => `${num(n)} ${n === 1 ? "pregunta disponible" : "preguntas disponibles"}`;

/**
 * Chat con el asistente. Guarda la conversación solo en el estado del componente: la API no guarda nada, así que cada
 * pregunta lleva los últimos mensajes como historial.
 */
export function Chat() {
  const id = useId();
  const [disp, setDisp] = useState<Disponibilidad>({ tipo: "consultando" });
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [borrador, setBorrador] = useState("");
  /** 429 por la cuota del día: el chat queda en solo lectura con este mensaje. */
  const [bloqueo, setBloqueo] = useState<string | null>(null);
  /** 503 al preguntar: el asistente no está disponible en este entorno. */
  const [caido, setCaido] = useState<string | null>(null);
  const [copia, setCopia] = useState<{ id: number; ok: boolean } | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const avisoRef = useRef<HTMLDivElement>(null);
  const registro = useRef<HTMLDivElement>(null);
  const control = useRef<AbortController | null>(null);
  const siguiente = useRef(1);
  const relojCopia = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let vigente = true;
    void pedirEstado().then((d) => {
      if (vigente) setDisp(d);
    });
    return () => {
      vigente = false;
    };
  }, []);

  // Al salir de la página: cancelar la pregunta en curso y el aviso de "Copiada".
  useEffect(() => {
    const pendiente = control;
    const reloj = relojCopia;
    return () => {
      pendiente.current?.abort();
      clearTimeout(reloj.current);
    };
  }, []);

  // Cada pregunta nueva sube al inicio del registro; la respuesta aparece debajo sin mover la lectura.
  const ultimo = turnos.length > 0 ? turnos[turnos.length - 1].id : undefined;
  useEffect(() => {
    const cont = registro.current;
    if (ultimo === undefined || !cont) return;
    const el = cont.querySelector<HTMLElement>(`[data-turno="${ultimo}"]`);
    // En un teléfono el registro no tiene alto máximo (se desplaza la página): no hay nada que mover adentro.
    if (!el || cont.scrollHeight <= cont.clientHeight) return;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cont.scrollTo({ top: Math.max(0, el.offsetTop - 8), behavior: suave ? "smooth" : "auto" });
  }, [ultimo]);

  const estado = disp.tipo === "listo" ? disp.estado : null;
  const ocupado = turnos.some((t) => t.fase === "esperando");
  const agotadas = estado !== null && estado.restantes_hoy <= 0;
  const soloLectura = bloqueo !== null || agotadas;
  const disponible = estado !== null && estado.disponible && caido === null;
  const habilitado = disponible && !soloLectura;
  const maxCar = estado?.max_caracteres ?? LIMITES.maxCaracteres;
  const limiteDia = estado?.limite_dia ?? LIMITES.porDia;
  const pregunta = borrador.trim();
  const puedeEnviar = habilitado && !ocupado && pregunta.length > 0 && pregunta.length <= maxCar;

  // Si el chat se cierra después de preguntar (cuota del día o 503), el área de texto queda deshabilitada y pierde el
  // foco: el foco pasa al aviso, que dice qué pasó. Al abrir la página no se mueve el foco.
  const cerrado = soloLectura || caido !== null;
  const conversacion = turnos.length > 0;
  useEffect(() => {
    if (cerrado && conversacion) avisoRef.current?.focus();
  }, [cerrado, conversacion]);

  async function enviar(texto: string) {
    const p = texto.trim();
    // control.current marca una pregunta en curso aunque el estado todavía no se haya actualizado (doble clic).
    if (!habilitado || ocupado || control.current || p.length === 0 || p.length > maxCar) return;
    const historial = historialDe(turnos);
    const idTurno = siguiente.current++;
    setTurnos((t) => [...t, { id: idTurno, pregunta: p, fase: "esperando" }]);
    setBorrador("");
    setCopia(null);
    area.current?.focus();

    const c = new AbortController();
    control.current = c;
    let agotado = false;
    const reloj = setTimeout(() => {
      agotado = true;
      c.abort();
    }, ESPERA_RESPUESTA_MS);
    const cerrar = (cambio: Partial<Turno>) =>
      setTurnos((t) => t.map((x) => (x.id === idTurno ? { ...x, ...cambio } : x)));

    try {
      const r = await consultar<unknown>("/asistente", { pregunta: p, historial }, { signal: c.signal });
      if (!esRespuesta(r)) throw new Error("respuesta sin la forma del contrato");
      cerrar({ fase: "listo", respuesta: r });
      setDisp((d) => (d.tipo === "listo" ? { ...d, estado: { ...d.estado, restantes_hoy: r.restantes_hoy } } : d));
    } catch (e) {
      if (c.signal.aborted && !agotado) return; // la canceló "Nueva conversación"
      if (agotado) {
        cerrar({
          fase: "error",
          error: { mensaje: "La respuesta tardó más de 3 minutos y se canceló. Vuelva a intentar en un momento.", reintentable: true },
        });
        return;
      }
      const mensaje = textoError(e);
      const codigo = e instanceof ErrorApi ? e.estado : -1;
      if (codigo === 429) {
        // 429 por minuto es pasajero; por cuota del día o por el tope global, el chat queda en solo lectura.
        const pasajero = /minuto/i.test(mensaje);
        cerrar({ fase: "error", error: { mensaje, reintentable: pasajero } });
        const d = await pedirEstado();
        if (d.tipo === "listo") setDisp(d);
        if (!pasajero || (d.tipo === "listo" && d.estado.restantes_hoy <= 0)) setBloqueo(mensaje);
        return;
      }
      if (codigo === 503) setCaido(mensaje);
      if (codigo === 404) setDisp({ tipo: "sin-asistente" });
      cerrar({ fase: "error", error: { mensaje, reintentable: codigo !== 422 && codigo !== 503 && codigo !== 404 } });
    } finally {
      clearTimeout(reloj);
      if (control.current === c) control.current = null;
    }
  }

  const nueva = () => {
    control.current?.abort();
    control.current = null;
    setTurnos([]);
    setCopia(null);
    area.current?.focus();
  };

  const reintentar = (t: Turno) => {
    setTurnos((xs) => xs.filter((x) => x.id !== t.id));
    void enviar(t.pregunta);
  };

  const editar = (t: Turno) => {
    setTurnos((xs) => xs.filter((x) => x.id !== t.id));
    setBorrador(t.pregunta);
    area.current?.focus();
  };

  const copiar = async (t: Turno) => {
    if (!t.respuesta) return;
    let ok = true;
    try {
      await navigator.clipboard.writeText(t.respuesta.respuesta);
    } catch {
      ok = false;
    }
    setCopia({ id: t.id, ok });
    clearTimeout(relojCopia.current);
    relojCopia.current = setTimeout(() => setCopia(null), 2500);
  };

  const revisarEstado = async () => {
    setDisp({ tipo: "consultando" });
    setDisp(await pedirEstado());
  };

  const alTeclear = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void enviar(borrador);
    }
  };

  // Línea de estado (región aria-live) y aviso con qué hacer.
  let rotulo = "Comprobando el asistente…";
  let tono: "ok" | "error" | "espera" = "error";
  if (disp.tipo === "consultando") tono = "espera";
  else if (disp.tipo === "sin-asistente") rotulo = "Esta API no tiene el asistente";
  else if (disp.tipo === "error") rotulo = disp.conexion ? "Sin conexión con la API" : "No se pudo consultar el asistente";
  else if (!disponible) rotulo = "No disponible en este entorno";
  else if (soloLectura) rotulo = "Sin preguntas por hoy: solo lectura";
  else {
    rotulo = `${disponibles(disp.estado.restantes_hoy)} hoy, de ${num(limiteDia)}`;
    tono = "ok";
  }

  const enLocal = (
    <>
      En el sitio publicado funciona con la API de Cloud Run. En local hace falta esa API: apunte{" "}
      <code>NEXT_PUBLIC_API_URL</code> a Cloud Run.
    </>
  );
  let aviso: { titulo: string; cuerpo: React.ReactNode; probar?: boolean } | null = null;
  if (disp.tipo === "sin-asistente") {
    aviso = {
      titulo: "El asistente no está en esta API",
      cuerpo: (
        <>
          La API en <code>{API_URL}</code> no tiene la consulta <code>/asistente</code>. {enLocal}
        </>
      ),
      probar: true,
    };
  } else if (disp.tipo === "error") {
    aviso = {
      titulo: disp.conexion ? "No hay conexión con la API" : "La API no dijo si el asistente está disponible",
      cuerpo: (
        <>
          {disp.mensaje} El sitio busca la API en <code>{API_URL}</code>.
        </>
      ),
      probar: true,
    };
  } else if (estado && !estado.disponible) {
    aviso = {
      titulo: "El asistente no está disponible en este entorno",
      cuerpo: (
        <>
          La API responde, pero no tiene Vertex AI configurado: pasa al correrla en Docker sin un proyecto de Google
          Cloud. {enLocal}
        </>
      ),
    };
  } else if (caido) {
    aviso = { titulo: "El asistente no está disponible", cuerpo: caido };
  } else if (bloqueo) {
    aviso = { titulo: "Solo lectura por hoy", cuerpo: `${bloqueo} Puede leer y copiar las respuestas de esta conversación.` };
  } else if (agotadas) {
    aviso = {
      titulo: "Solo lectura por hoy",
      cuerpo: `Ya usó las ${num(limiteDia)} preguntas de hoy. El contador se reinicia a la medianoche, hora de Guatemala. Puede leer y copiar las respuestas de esta conversación.`,
    };
  }

  const marcador =
    disp.tipo === "consultando"
      ? "Comprobando el asistente…"
      : !disponible
        ? "El asistente no está disponible."
        : soloLectura
          ? "Ya no quedan preguntas por hoy."
          : "Por ejemplo: ¿cada cuántos cortes conviene renovar HOCP14-885?";

  return (
    <section className={s.chat} aria-labelledby={`${id}-titulo`}>
      <div className={s.barra}>
        <div className={s.barraTexto}>
          <h3 id={`${id}-titulo`} className="etiqueta">
            Asistente · {nombreModelo(estado?.modelo ?? MODELO)}
          </h3>
          <p className={s.estado} data-tono={tono} role="status" aria-live="polite">
            <span className={s.marca} aria-hidden="true" />
            {rotulo}
          </p>
        </div>
        {turnos.length > 0 && (
          <button type="button" className={`boton boton-sec ${s.botonChico}`} onClick={nueva}>
            Nueva conversación
          </button>
        )}
      </div>

      {aviso && (
        <div ref={avisoRef} className={s.aviso} tabIndex={-1}>
          <p className={s.avisoTitulo}>{aviso.titulo}</p>
          <p>{aviso.cuerpo}</p>
          {aviso.probar && (
            <button type="button" className={`boton boton-sec ${s.botonChico}`} onClick={() => void revisarEstado()}>
              Volver a probar
            </button>
          )}
        </div>
      )}

      {turnos.length === 0 && (
        <div className={s.sugerencias}>
          <p className="etiqueta" id={`${id}-sugeridas`}>
            Preguntas sugeridas
          </p>
          <ul className={s.listaSugerencias} aria-labelledby={`${id}-sugeridas`}>
            {SUGERENCIAS.map((x) => (
              <li key={x.pregunta} data-serie={x.serie}>
                <button type="button" className={s.sugerencia} onClick={() => void enviar(x.pregunta)} disabled={!habilitado}>
                  <span className={s.rotuloSerie}>{x.rotulo}</span>
                  <span>{x.pregunta}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        ref={registro}
        className={s.registro}
        role="log"
        aria-live="polite"
        aria-label="Conversación con el asistente"
        tabIndex={turnos.length > 0 ? 0 : undefined}
      >
        {turnos.map((t, i) => (
          <TurnoVista
            key={t.id}
            t={t}
            ultimo={i === turnos.length - 1}
            habilitado={habilitado}
            copia={copia?.id === t.id ? copia.ok : undefined}
            onCopiar={() => void copiar(t)}
            onReintentar={() => reintentar(t)}
            onEditar={() => editar(t)}
          />
        ))}
      </div>

      <form
        className={s.formulario}
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(borrador);
        }}
      >
        <label htmlFor={`${id}-pregunta`} className={s.rotuloArea}>
          Su pregunta
        </label>
        <textarea
          id={`${id}-pregunta`}
          ref={area}
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          onKeyDown={alTeclear}
          maxLength={maxCar}
          rows={3}
          disabled={!habilitado}
          placeholder={marcador}
          aria-describedby={`${id}-ayuda ${id}-contador`}
        />
        <div className={s.pieForm}>
          <p id={`${id}-ayuda`} className={s.ayuda}>
            <kbd>Enter</kbd> envía. <kbd>Shift</kbd> + <kbd>Enter</kbd> agrega una línea.
          </p>
          <p id={`${id}-contador`} className={s.contador} data-cerca={borrador.length >= maxCar * 0.9 ? "" : undefined}>
            <span className="solo-lectores">Caracteres usados: </span>
            {num(borrador.length)} / {num(maxCar)}
          </p>
          <button type="submit" className="boton" disabled={!puedeEnviar}>
            Enviar
          </button>
        </div>
      </form>
    </section>
  );
}

/** Etiquetas de las herramientas usadas, sin repetir: "Ciclo de renovación (2 veces)". */
function agrupar(herramientas: LlamadaHerramienta[]) {
  const veces = new Map<string, number>();
  for (const h of herramientas) veces.set(h.etiqueta, (veces.get(h.etiqueta) ?? 0) + 1);
  return [...veces].map(([etiqueta, n]) => (n > 1 ? `${etiqueta} (${n} veces)` : etiqueta));
}

const valor = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? num(v, Number.isInteger(v) ? 0 : 2) : JSON.stringify(v));
const argumentos = (a: Record<string, unknown> | undefined) => {
  const pares = Object.entries(a ?? {});
  return pares.length === 0 ? "sin argumentos" : pares.map(([k, v]) => `${k}: ${valor(v)}`).join(" · ");
};

function TurnoVista({
  t, ultimo, habilitado, copia, onCopiar, onReintentar, onEditar,
}: {
  t: Turno;
  ultimo: boolean;
  habilitado: boolean;
  /** true: se copió; false: no se pudo; undefined: sin aviso. */
  copia?: boolean;
  onCopiar: () => void;
  onReintentar: () => void;
  onEditar: () => void;
}) {
  const r = t.respuesta;
  const usadas = r ? agrupar(r.herramientas) : [];
  return (
    <article className={s.turno} data-turno={t.id}>
      <div className={s.pregunta}>
        <p className={`etiqueta ${s.quien}`}>Usted</p>
        <p className={s.textoPregunta}>{t.pregunta}</p>
      </div>

      <div className={s.respuesta}>
        <p className={`etiqueta ${s.quien}`}>Asistente</p>

        {t.fase === "esperando" && <p className={s.espera}>Consultando los datos…</p>}

        {t.fase === "listo" && r && (
          <>
            <RespuestaMarkdown texto={r.respuesta} />
            <div className={s.pieRespuesta}>
              <div className={s.consulto}>
                <span className={s.rotuloPie}>Consultó:</span>
                {usadas.length === 0 ? (
                  <span>ninguna herramienta</span>
                ) : (
                  <ul className={s.chips}>
                    {usadas.map((u) => (
                      <li key={u} className={s.chip}>
                        {u}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className={s.accionesRespuesta}>
                <span className={s.meta}>
                  {nombreModelo(r.modelo)} · {num(r.pasos)} {r.pasos === 1 ? "paso" : "pasos"}
                </span>
                <button type="button" className={s.botonTexto} onClick={onCopiar}>
                  {copia === undefined ? "Copiar respuesta" : copia ? "Copiada" : "No se pudo copiar"}
                </button>
                <span className="solo-lectores" role="status">
                  {copia === undefined ? "" : copia ? "Respuesta copiada." : "No se pudo copiar la respuesta."}
                </span>
              </div>
            </div>
            {r.herramientas.length > 0 && (
              <details className={s.argumentos}>
                <summary>Qué le pidió a cada herramienta</summary>
                <ol>
                  {r.herramientas.map((h, i) => (
                    <li key={i}>
                      <strong>{h.etiqueta}</strong> <code>{h.nombre}</code>: {argumentos(h.argumentos)}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </>
        )}

        {t.fase === "error" && t.error && (
          <div className={s.error}>
            <p>
              <strong>No se pudo responder.</strong> {t.error.mensaje}
            </p>
            {ultimo && habilitado && (
              <div className={s.accionesError}>
                {t.error.reintentable && (
                  <button type="button" className={`boton boton-sec ${s.botonChico}`} onClick={onReintentar}>
                    Volver a intentar
                  </button>
                )}
                <button type="button" className={`boton boton-sec ${s.botonChico}`} onClick={onEditar}>
                  Editar la pregunta
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
