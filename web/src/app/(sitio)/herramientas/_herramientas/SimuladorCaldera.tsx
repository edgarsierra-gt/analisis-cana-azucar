"use client";

import * as Plot from "@observablehq/plot";
import { useId, useState } from "react";
import { Cifra, FilaCifras } from "@/components/Cifra";
import { Figura } from "@/components/Figura";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { Tabla } from "@/components/Tabla";
import { conSigno, num } from "@/lib/formato";
import { useAlAsomar, useConsulta } from "./consulta";
import { BloqueDetalle, DetalleTecnico, Respuesta, Secundarias } from "./Respuesta";
import s from "./herramientas.module.css";

export type MinutoMuestra = { hora: string; valores: Record<string, number> };

// Campos que pide cada consulta (api/esquemas.py: VAPOR_SPEC y VERIF_SPEC). ZZQBCHLL es el medidor de vapor:
// el sensor virtual no lo usa, solo lo compara.
const CAMPOS_VAPOR = [
  "PTCA_8322A", "PTCA_8324", "TE_8313B", "TE_8303", "TE_8304", "TV_8329ZC", "FT_8301", "FT_8302", "YFJ3_AI",
  "YFJ3_ZD1", "SXLTCYY", "YJJWSLL", "TE_8332A", "presion_hogar", "lecho", "o2", "t_gases", "retorno_total", "ZZQBCHLL",
];
const CAMPOS_VERIF = [
  "PT_8313A", "PT_8313B", "PT_8313C", "PT_8313D", "PT_8313E", "PT_8313F", "AIR_8301A", "AIR_8301B", "ZCLCCY", "YCLCCY",
  "TE_8319A", "TE_8319B", "FT_8306A", "FT_8306B", "ZZQBCHLL", "YJJWSLL", "TV_8329ZC", "PTCA_8322A", "PTCA_8324", "TE_8332A",
];

// Fallas simuladas: las mismas que comprueban tests/test_api_caldera_mercado.py y docs/api.md.
const MINUTOS_FALLA = 6;
// El botón dice la falla en palabras; los códigos de sensor quedan para el detalle técnico.
const FALLAS = [
  { id: "normal", texto: "Operación normal", detalle: "los datos reales, sin cambios", codigos: "", sensores: [] as string[], suma: 0 },
  { id: "vapor", texto: "Deriva del medidor de vapor", detalle: "+3 t/h en el medidor", codigos: "+3 t/h en ZZQBCHLL", sensores: ["ZZQBCHLL"], suma: 3 },
  { id: "presion", texto: "Presión de hogar C desplazada", detalle: "+300 Pa en esa presión", codigos: "+300 Pa en PT_8313C", sensores: ["PT_8313C"], suma: 300 },
  { id: "hogar", texto: "Evento del hogar", detalle: "+300 Pa en las presiones D, E y F", codigos: "+300 Pa en PT_8313D, E y F", sensores: ["PT_8313D", "PT_8313E", "PT_8313F"], suma: 300 },
];
type Falla = (typeof FALLAS)[number];

const NOMBRE_CHEQUEO: Record<string, [string, string]> = {
  "O2 izq. − der.": ["O₂ izquierdo contra derecho", "O₂ izq.–der."],
  "Lecho izq. − der.": ["Lecho izquierdo contra derecho", "Lecho izq.–der."],
  "Gases izq. − der.": ["Gases izquierda contra derecha", "Gases izq.–der."],
  "Retorno izq. − der.": ["Aire de retorno izquierdo contra derecho", "Retorno izq.–der."],
  "Vapor medido − virtual": ["Vapor medido contra la fórmula de dos variables", "Vapor medido–virtual"],
  "Agua − f(válvula)": ["Agua de atemperación contra apertura de la válvula", "Agua–válvula"],
};
const nombreChequeo = (c: string, corto = false) =>
  c.startsWith("PT_8313")
    ? corto ? `Presión ${c.slice(-1)}` : `Presión de hogar ${c.slice(-1)} contra la mediana de las otras 5`
    : (NOMBRE_CHEQUEO[c]?.[corto ? 1 : 0] ?? c);

type RespuestaVapor = {
  vapor_t_h: number;
  banda_90_t_h: [number, number];
  error_tipico_t_h: number;
  otras_estimaciones: { hidraulico_una_variable: number; formula_dos_variables: number };
  vapor_medido_t_h?: number;
  medido_menos_estimado_t_h?: number;
  minutos_usados: number;
};
type Chequeo = {
  z: number; umbral_z: number; fuera_de_umbral: boolean; minutos_seguidos_fuera: number; alarma: boolean;
  falla_minima_detectable: number;
};
type RespuestaVerificar = {
  diagnostico: string;
  chequeos_en_alarma: string[];
  minutos_evaluados: number;
  persistencia_min: number;
  chequeos: Record<string, Chequeo>;
  aviso: string;
};

const hhmm = (iso: string) => iso.slice(11, 16);
/** Primera letra en minúscula para usar un nombre dentro de una frase, sin tocar siglas (O₂) ni letras de sensor (C). */
const enMinuscula = (t: string) => (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const aFecha = (iso: string) => new Date(iso);

export function SimuladorCaldera({
  minutos, ventana, errorTipico, unidades, persistencia, nChequeos, metodo, contexto,
}: {
  /** Cómo calculan las consultas (texto de la página), para el detalle técnico. */
  metodo?: React.ReactNode;
  /** "Cómo lo sé" y el límite: van entre la herramienta y su detalle técnico. */
  contexto?: React.ReactNode;
  minutos: MinutoMuestra[];
  /** Minutos que necesita el sensor virtual (media de 10 min, notebook 08). */
  ventana: number;
  /** Error típico del Ridge final en la validación hacia adelante (t/h). */
  errorTipico: number;
  /** Unidad de la falla mínima detectable de cada chequeo (notebook 09). */
  unidades: Record<string, string>;
  /** Minutos seguidos fuera de umbral para que haya alarma (notebook 09). */
  persistencia: number;
  nChequeos: number;
}) {
  const id = useId();
  const total = minutos.length;
  const [minuto, setMinuto] = useState(total);
  const [estimaciones, setEstimaciones] = useState<Record<number, RespuestaVapor>>({});
  const [minutoEstimado, setMinutoEstimado] = useState(total);
  const [ultimaFalla, setUltimaFalla] = useState<{ falla: Falla; minuto: number }>();
  const [intentada, setIntentada] = useState<Falla>(); // para reintentar aunque la primera consulta falle
  const vapor = useConsulta<RespuestaVapor>();
  const verif = useConsulta<RespuestaVerificar>();

  const tramo = minutos.slice(minuto - ventana, minuto);
  const inicio = hhmm(tramo[0].hora);
  const fin = hhmm(tramo[tramo.length - 1].hora);

  const filas = (campos: string[], falla?: Falla) =>
    tramo.map((m, i) => {
      const fila: Record<string, number> = {};
      for (const c of campos) fila[c] = m.valores[c];
      if (falla && i >= tramo.length - MINUTOS_FALLA) for (const c of falla.sensores) fila[c] += falla.suma;
      return fila;
    });

  const estimar = () => {
    const k = minuto;
    void vapor.ejecutar("/caldera/vapor-virtual", { minutos: filas(CAMPOS_VAPOR) }, (r) => {
      setEstimaciones((e) => ({ ...e, [k]: r }));
      setMinutoEstimado(k);
    });
  };

  const verificar = (falla: Falla) => {
    const k = minuto;
    setIntentada(falla);
    void verif.ejecutar("/caldera/verificar", { minutos: filas(CAMPOS_VERIF, falla), retorno_confirmado: true }, () =>
      setUltimaFalla({ falla, minuto: k }),
    );
  };

  const controlMinuto = (sufijo: string) => (
    <div className="campo-form">
      <div className={s.filaEtiqueta}>
        <label htmlFor={`${id}-${sufijo}`}>Minuto</label>
        <output htmlFor={`${id}-${sufijo}`} className={s.valorControl}>
          {minuto} · {fin}
        </output>
      </div>
      <input
        id={`${id}-${sufijo}`}
        type="range"
        min={ventana}
        max={total}
        step={1}
        value={minuto}
        aria-valuetext={`minuto ${minuto} de ${total}, ${fin}`}
        onChange={(e) => setMinuto(Number(e.target.value))}
      />
      <div className={s.rangoExtremos} aria-hidden="true">
        <span>{hhmm(minutos[ventana - 1].hora)}</span>
        <span>{hhmm(minutos[total - 1].hora)}</span>
      </div>
      <span className="ayuda">
        Ventana: los {ventana} minutos de {inicio} a {fin}.
      </span>
    </div>
  );

  // Al asomar la sección: la estimación del último minuto y la verificación con operación normal, una vez cada una.
  const raiz = useAlAsomar<HTMLDivElement>(() => {
    if (!vapor.datos && vapor.fase === "inactivo") estimar();
    if (!verif.datos && verif.fase === "inactivo") verificar(FALLAS[0]);
  });

  const dv = vapor.datos;
  const dz = verif.datos;

  return (
    <>
      <div className={s.herramienta} ref={raiz}>
        <form className={s.controles} onSubmit={(e) => { e.preventDefault(); estimar(); }} aria-label="Sensor virtual" data-ui="">
          <p className={s.tituloPanel}>Sensor virtual</p>
          {controlMinuto("vapor")}
          <button type="submit" className="boton">
            Estimar el vapor en este minuto
          </button>
          <span className={s.ayuda}>
            Manda a la API los {ventana} minutos de la ventana con {CAMPOS_VAPOR.length - 1} variables. El medidor va
            aparte, solo para comparar.
          </span>
        </form>

        <div className={s.salida}>
          <Respuesta
            fase={vapor.fase}
            ruta={vapor.ruta}
            ms={vapor.ms}
            error={vapor.error}
            onReintentar={estimar}
            vacio="Elija un minuto y pida la estimación."
            titular={
              dv && (
                <>
                  A las {hhmm(minutos[minutoEstimado - 1].hora)}, el sensor virtual estima {num(dv.vapor_t_h, 2)} t/h
                  {dv.vapor_medido_t_h !== undefined && (
                    <>
                      {" "}y el medidor marca {num(dv.vapor_medido_t_h, 2)} t/h:{" "}
                      {dv.vapor_medido_t_h >= dv.banda_90_t_h[0] && dv.vapor_medido_t_h <= dv.banda_90_t_h[1]
                        ? "el medido cae dentro de la banda de 90 %"
                        : "el medido queda fuera de la banda de 90 %"}
                    </>
                  )}
                  .
                </>
              )
            }
            cabeza={dv && <CifrasVapor d={dv} errorTipico={errorTipico} />}
          >
            <Figura
              titulo="El sensor virtual sigue al medidor sin usarlo"
              nota="Línea gris: vapor medido, promedios de 1 min. Sombreado: la ventana que se manda a la API. Círculo negro: el minuto elegido. Puntos con barra: cada estimación pedida, con su banda de 90 %."
              fuente="API, POST /caldera/vapor-virtual · Ridge final del notebook 08 · muestra outputs/tables/serie2_muestra_api_vapor.csv"
            >
              <GraficoVapor minutos={minutos} minuto={minuto} ventana={ventana} estimaciones={estimaciones} />
            </Figura>
          </Respuesta>
        </div>
      </div>

      <div className={s.subtitulo}>
        <h3>Un sensor dañado se separa de sus pares; un evento del hogar los mueve juntos</h3>
        <p>
          {/* fuente: docs/api.md, POST /caldera/verificar (cada presión de hogar contra la mediana de las otras 5) */}
          Elija una falla. La API recibe la misma ventana con la falla sumada en los últimos {MINUTOS_FALLA} minutos y corre
          los {nChequeos} chequeos de redundancia del notebook 09: cada presión de hogar contra la mediana de las otras 5, los pares
          izquierda-derecha, el vapor medido contra la física y el agua contra la válvula. Un chequeo entra en alarma si lleva{" "}
          {persistencia} minutos seguidos fuera de su umbral.
        </p>
      </div>

      <div className={s.herramienta}>
        <form className={s.controles} onSubmit={(e) => e.preventDefault()} aria-label="Verificación de sensores" data-ui="">
          <p className={s.tituloPanel}>Verificación de sensores</p>
          {controlMinuto("verif")}
          <fieldset>
            <legend>Simular</legend>
            <div className={s.listaFallas}>
              {FALLAS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`boton boton-sec ${s.botonFalla}`}
                  aria-pressed={ultimaFalla?.falla.id === f.id && verif.fase !== "error"}
                  onClick={() => verificar(f)}
                >
                  <span>
                    {f.texto}
                    <span className="solo-lectores">: {f.detalle}</span>
                    <span className={s.detalleBoton} aria-hidden="true">
                      {f.detalle}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        </form>

        <div className={s.salida}>
          <Respuesta
            fase={verif.fase}
            ruta={verif.ruta}
            ms={verif.ms}
            error={verif.error}
            onReintentar={intentada ? () => verificar(intentada) : undefined}
            vacio="Elija operación normal o una de las fallas."
            titular={dz && <TitularVerificacion d={dz} />}
          >
            {dz && ultimaFalla && (
              <DetalleVerificacion
                d={dz}
                falla={ultimaFalla.falla}
                ventanaTexto={`${hhmm(minutos[ultimaFalla.minuto - ventana].hora)} a ${hhmm(minutos[ultimaFalla.minuto - 1].hora)} del ${fechaCorta(minutos[0].hora)}`}
              />
            )}
          </Respuesta>
        </div>
      </div>
      {contexto}
      <DetalleTecnico
        metodo={metodo}
        respuestas={[
          ...(dv ? [{ titulo: "Respuesta del sensor virtual (JSON)", datos: dv }] : []),
          ...(dz ? [{ titulo: "Respuesta de la verificación (JSON)", datos: dz }] : []),
        ]}
      >
        {dv && (
          <BloqueDetalle titulo="Contra las fórmulas de pizarra">
            <p>
              Con la caída de presión domo-colector sola, la estimación es de{" "}
              {num(dv.otras_estimaciones.hidraulico_una_variable, 2)} t/h; si se agrega el agua de atemperación, de{" "}
              {num(dv.otras_estimaciones.formula_dos_variables, 2)} t/h. El medidor de vapor es <code>ZZQBCHLL</code>.
            </p>
          </BloqueDetalle>
        )}
        {dz && ultimaFalla && <TablaChequeos d={dz} falla={ultimaFalla.falla} unidades={unidades} />}
      </DetalleTecnico>
    </>
  );
}

function CifrasVapor({ d, errorTipico }: { d: RespuestaVapor; errorTipico: number }) {
  return (
    <>
      <FilaCifras columnas={2}>
        <Cifra
          serie="caldera"
          valor={num(d.vapor_t_h, 2)}
          unidad="t/h"
          etiqueta="Vapor estimado"
          detalle={`Banda de 90 %: ${num(d.banda_90_t_h[0], 2)} a ${num(d.banda_90_t_h[1], 2)} t/h.`}
        />
        <Cifra
          serie="caldera"
          tono="tinta"
          valor={d.vapor_medido_t_h === undefined ? "—" : num(d.vapor_medido_t_h, 2)}
          unidad="t/h"
          etiqueta="Vapor medido"
          detalle="El medidor real. No entra al modelo: solo se compara."
        />
      </FilaCifras>
      <Secundarias>
        <li>
          <strong className="num">
            {d.medido_menos_estimado_t_h === undefined ? "—" : conSigno(d.medido_menos_estimado_t_h, 2)} t/h
          </strong>{" "}
          de diferencia entre lo medido y lo estimado. El error típico del modelo es de {num(errorTipico, 2)} t/h.
        </li>
      </Secundarias>
    </>
  );
}

function TitularVerificacion({ d }: { d: RespuestaVerificar }) {
  const alarmas = d.chequeos_en_alarma;
  if (d.diagnostico.startsWith("proceso")) {
    return (
      <>
        Evento del hogar, no sensores dañados: {alarmas.length} presiones de hogar alarman a la vez y ningún otro chequeo
        alarma.
      </>
    );
  }
  if (alarmas.length > 0) {
    return (
      <>
        Falla de sensor en {alarmas.length === 1 ? "el chequeo" : "los chequeos"}{" "}
        {alarmas.map((c) => enMinuscula(nombreChequeo(c))).join("; ")}: lleva{alarmas.length === 1 ? "" : "n"}{" "}
        {Math.max(...alarmas.map((c) => d.chequeos[c].minutos_seguidos_fuera))} minutos seguidos fuera de su umbral.
      </>
    );
  }
  return <>Sin falla de sensor: ningún chequeo lleva {d.persistencia_min} minutos seguidos fuera de su umbral.</>;
}

const ordenarChequeos = (d: RespuestaVerificar) =>
  Object.entries(d.chequeos)
    .map(([clave, c]) => ({ clave, ...c, veces: Math.abs(c.z) / c.umbral_z }))
    .sort((a, b) => Number(b.alarma) - Number(a.alarma) || b.veces - a.veces);

function DetalleVerificacion({ d, falla, ventanaTexto }: { d: RespuestaVerificar; falla: Falla; ventanaTexto: string }) {
  const filas = ordenarChequeos(d);
  return (
    <>
      <p className={s.lineaDato}>
        {falla.id === "normal" ? "Sin falla simulada" : `Falla simulada: ${enMinuscula(falla.texto)} (${falla.detalle})`},
        ventana de {ventanaTexto}. Diagnóstico de la API: <code>{d.diagnostico}</code>.
      </p>
      <Figura
        titulo={tituloChequeos(d, filas.length)}
        nota={`Cada barra es la desviación del chequeo dividida entre su umbral: arriba de 1 está fuera de umbral. Hay alarma si dura ${d.persistencia_min} minutos seguidos: esas barras van en color y dicen «alarma».`}
        fuente="API, POST /caldera/verificar · chequeos del notebook 09 (outputs/models/serie2_verificacion.json)"
      >
        <GraficoChequeos filas={filas} />
      </Figura>
    </>
  );
}

/** La tabla de los chequeos, con los códigos de sensor y la escala z: va en el detalle técnico. */
function TablaChequeos({ d, falla, unidades }: { d: RespuestaVerificar; falla: Falla; unidades: Record<string, string> }) {
  const filas = ordenarChequeos(d);
  return (
    <BloqueDetalle titulo="Los chequeos, del más alto al más bajo">
      <p>
        {falla.id === "normal" ? "Sin falla simulada." : `Falla simulada: ${falla.codigos}, en los últimos ${MINUTOS_FALLA} minutos.`}{" "}
        Cada chequeo mide su residuo en unidades de su escala normal (z).
      </p>
      <div className={s.encabezadosPartidos}>
        <Tabla
          compacta
          columnas={[
            {
              clave: "clave",
              titulo: "Chequeo",
              valor: (x) => (
                <>
                  {nombreChequeo(x.clave)} <span className="apagado dato">{x.clave.startsWith("PT_8313") ? x.clave : ""}</span>
                </>
              ),
            },
            { clave: "z", titulo: "z", tipo: "num", valor: (x) => num(x.z, 2) },
            { clave: "umbral_z", titulo: "Umbral de |z|", tipo: "num" },
            { clave: "minutos_seguidos_fuera", titulo: "Minutos seguidos fuera", tipo: "num" },
            {
              clave: "falla_minima_detectable",
              titulo: "Falla mínima detectable",
              tipo: "num",
              // Dos decimales, como la tabla de sensibilidad del notebook 09.
              valor: (x) => `${num(x.falla_minima_detectable, 2)} ${unidades[x.clave] ?? ""}`,
            },
            { clave: "alarma", titulo: "Estado", valor: (x) => (x.alarma ? <strong>alarma</strong> : x.fuera_de_umbral ? "fuera, sin persistencia" : "normal") },
          ]}
          filas={filas}
          destacar={(x) => x.alarma}
        />
      </div>
      <p>{d.aviso}</p>
    </BloqueDetalle>
  );
}

type FilaChequeo = Chequeo & { clave: string; veces: number };

/** Título de la figura 4: dice qué concluye la verificación. */
function tituloChequeos(d: RespuestaVerificar, total: number) {
  const alarmas = d.chequeos_en_alarma;
  if (alarmas.length === 0) return `Los ${total} chequeos quedan sin alarma: no hay falla de sensor`;
  if (d.diagnostico.startsWith("proceso")) {
    return `${alarmas.length} presiones de hogar alarman juntas y nada más: es un evento del hogar`;
  }
  if (alarmas.length === 1) return `Solo alarma ${nombreChequeo(alarmas[0], true)}: ese sensor se separó de sus pares`;
  return `Alarman ${alarmas.length} de ${total} chequeos (${alarmas.map((c) => nombreChequeo(c, true)).join(", ")}): falla de sensor`;
}

function GraficoChequeos({ filas }: { filas: FilaChequeo[] }) {
  const tope = Math.max(1.2, ...filas.map((f) => f.veces));
  const alarmas = filas.filter((f) => f.alarma).length;
  const etiqueta = alarmas
    ? `${alarmas} chequeos en alarma; el más alto está a ${num(filas[0].veces, 1)} veces su umbral.`
    : `Ningún chequeo en alarma; el más alto está a ${num(filas[0].veces, 2)} veces su umbral.`;
  return (
    <PlotFigura
      alto={filas.length * 26 + 60}
      etiqueta={etiqueta}
      dependencias={[filas]}
      crear={() => ({
        marginLeft: 136,
        marginRight: 16,
        // Espacio a la derecha para el rótulo "· alarma" de la barra más larga.
        x: { label: "|z| ÷ umbral", domain: [0, tope * 1.3], grid: true, tickFormat: (x: number) => num(x, Number.isInteger(x) ? 0 : 1) },
        y: { label: null, domain: filas.map((f) => nombreChequeo(f.clave, true)) },
        marks: [
          Plot.barX(filas, {
            y: (f: FilaChequeo) => nombreChequeo(f.clave, true),
            x: "veces",
            fill: (f: FilaChequeo) => (f.alarma ? COLORES.caldera : COLORES.contexto),
          }),
          Plot.ruleX([0], { stroke: COLORES.tinta }),
          Plot.ruleX([1], { stroke: COLORES.tinta, strokeDasharray: "4,3" }),
          Plot.text([1], { x: (x: number) => x, frameAnchor: "top", text: () => "umbral", dy: -12, fill: COLORES.tinta2 }),
          Plot.text(filas, {
            y: (f: FilaChequeo) => nombreChequeo(f.clave, true),
            x: "veces",
            text: (f: FilaChequeo) => `${num(f.veces, 1)}${f.alarma ? " · alarma" : ""}`,
            textAnchor: "start",
            dx: 4,
            fill: COLORES.tinta2,
          }),
        ],
      })}
    />
  );
}

function GraficoVapor({
  minutos, minuto, ventana, estimaciones,
}: { minutos: MinutoMuestra[]; minuto: number; ventana: number; estimaciones: Record<number, RespuestaVapor> }) {
  const medido = minutos.map((m) => ({ t: aFecha(m.hora), v: m.valores.ZZQBCHLL }));
  const est = Object.entries(estimaciones).map(([k, r]) => ({ t: aFecha(minutos[Number(k) - 1].hora), ...r }));
  const t0 = medido[minuto - ventana].t;
  const t1 = medido[minuto - 1].t;
  const actual = medido[minuto - 1];
  const etiqueta = `Vapor medido durante ${minutos.length} minutos, entre ${num(Math.min(...medido.map((m) => m.v)), 1)} y ${num(Math.max(...medido.map((m) => m.v)), 1)} t/h, con ${est.length} estimaciones del sensor virtual.`;
  return (
    <PlotFigura
      alto={300}
      etiqueta={etiqueta}
      dependencias={[minuto, estimaciones]}
      crear={() => ({
        marginLeft: 44,
        x: { type: "utc", label: null, tickFormat: (t: Date) => t.toISOString().slice(11, 16) },
        y: { label: "Vapor (t/h)", grid: true, nice: true },
        marks: [
          Plot.rect([{ t0, t1 }], { x1: "t0", x2: "t1", fill: COLORES.caldera, fillOpacity: 0.1 }),
          Plot.lineY(medido, { x: "t", y: "v", stroke: COLORES.contexto, strokeWidth: 1.5 }),
          Plot.ruleX(est, { x: "t", y1: (r: (typeof est)[number]) => r.banda_90_t_h[0], y2: (r: (typeof est)[number]) => r.banda_90_t_h[1], stroke: COLORES.caldera, strokeWidth: 2 }),
          Plot.dot(est, { x: "t", y: "vapor_t_h", fill: COLORES.caldera, r: 3.5 }),
          Plot.dot([actual], { x: "t", y: "v", stroke: COLORES.tinta, r: 5 }),
        ],
      })}
    />
  );
}
