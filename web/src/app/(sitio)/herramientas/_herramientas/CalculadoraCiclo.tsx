"use client";

import * as Plot from "@observablehq/plot";
import { useEffect, useId, useMemo, useState } from "react";
import { Cifra, FilaCifras } from "@/components/Cifra";
import { Figura } from "@/components/Figura";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { Desplegable } from "@/components/Nota";
import { conSigno, num, pctFraccion, usd } from "@/lib/formato";
import { nombreCorte, useConsulta, useVariedades, type Supuestos } from "./consulta";
import { Respuesta, RespuestaJson } from "./Respuesta";
import s from "./herramientas.module.css";

type RespuestaCiclo = {
  variedad: string;
  ciclo_optimo_cortes: number;
  margen_anual_usd_acre: number;
  margen_anual_usd_ha: number;
  ganancia_vs_testigos_usd_acre: number;
  testigo_promedio: { ciclo_optimo_cortes: number; margen_anual_usd_acre: number };
  precio_equilibrio_usd_lb: number | null;
  margen_por_ciclo: { cortes: number; margen_anual_usd_acre: number }[];
  evidencia: { anios: number; ensayos: number; ultimo_corte_medido: number; es_testigo: boolean; ventaja_extrapolada: boolean };
  certeza_con_supuestos_base: { P_top3: number; ganancia_ic90_usd_acre: [number, number] };
  supuestos: Supuestos;
};

// Rango del control de precio. La API acepta de US$0.05 a 1.00/lb (api/esquemas.py, SupuestosEntrada).
const PRECIO_MIN = 0.05;
const PRECIO_MAX = 0.4;

// Precio más alto con el que la API busca el equilibrio; si ni así cubre costos, devuelve null
// (api/servicios.py, _precio_equilibrio).
const PRECIO_BUSQUEDA = 0.6;

// Costos opcionales con los topes que valida la API (api/esquemas.py, SupuestosEntrada).
const COSTOS = [
  { clave: "corte", etiqueta: "Corte, alce y transporte", unidad: "US$ por tonelada corta de caña", max: 100, paso: 0.5 },
  { clave: "mantenimiento", etiqueta: "Mantenimiento del cultivo", unidad: "US$ por acre al año", max: 3000, paso: 10 },
  { clave: "renovacion", etiqueta: "Renovación (preparación y siembra)", unidad: "US$ por acre, en la plantía", max: 10000, paso: 50 },
] as const;
type ClaveCosto = (typeof COSTOS)[number]["clave"];
const COSTOS_VACIOS: Record<ClaveCosto, string> = { corte: "", mantenimiento: "", renovacion: "" };

/** Cifra sin ceros de más: 14 → "14", 14.5 → "14.50". */
const monto = (x: number) => usd(x, Number.isInteger(x) ? 0 : 2);

export function CalculadoraCiclo() {
  const id = useId();
  const catalogo = useVariedades();
  const { ejecutar, ...consulta } = useConsulta<RespuestaCiclo>();

  const [variedad, setVariedad] = useState<string>();
  const [precio, setPrecio] = useState<number>();
  const [costos, setCostos] = useState(COSTOS_VACIOS);
  const [barbecho, setBarbecho] = useState<number>();
  const [extrapolar, setExtrapolar] = useState(false);

  const cat = catalogo.datos?.catalogo;
  const base = cat?.supuestos_por_defecto;
  // Mientras la persona no elija, se usa la primera del ranking y los supuestos de la prueba.
  const v = variedad ?? catalogo.datos?.variedades[0]?.variedad;
  const p = precio ?? base?.precio;
  const b = barbecho ?? base?.barbecho;

  const cuerpo = useMemo(() => {
    if (!v || p === undefined) return null;
    const c: Record<string, unknown> = { variedad: v, precio: p, extrapolar };
    for (const { clave } of COSTOS) {
      const x = Number(costos[clave]);
      if (costos[clave].trim() !== "" && Number.isFinite(x)) c[clave] = x;
    }
    if (b !== undefined) c.barbecho = b;
    return c;
  }, [v, p, costos, b, extrapolar]);

  useEffect(() => {
    if (!cuerpo) return;
    const t = setTimeout(() => void ejecutar("/campo/ciclo", cuerpo), 250);
    return () => clearTimeout(t);
  }, [cuerpo, ejecutar]);

  const restablecer = () => {
    setPrecio(undefined);
    setCostos(COSTOS_VACIOS);
    setBarbecho(undefined);
    setExtrapolar(false);
  };

  const d = consulta.datos;
  const errorCatalogo = catalogo.error;

  return (
    <div className={s.herramienta}>
      <form className={s.controles} onSubmit={(e) => e.preventDefault()} aria-label="Datos del escenario">
        <p className={`etiqueta ${s.tituloPanel}`}>Escenario</p>
        <div className="campo-form">
          <label htmlFor={`${id}-variedad`}>Variedad</label>
          <select
            id={`${id}-variedad`}
            value={v ?? ""}
            disabled={!cat}
            onChange={(e) => setVariedad(e.target.value)}
          >
            {!cat && <option value="">Cargando variedades…</option>}
            {cat?.variedades_ciclo.map((x) => (
              <option key={x} value={x}>
                {cat.testigos_nucleo.includes(x) ? `${x} (testigo)` : x}
              </option>
            ))}
          </select>
          {cat && <span className="ayuda">Las {cat.variedades_ciclo.length} variedades con evidencia suficiente.</span>}
        </div>

        <div className="campo-form">
          <div className={s.filaEtiqueta}>
            <label htmlFor={`${id}-precio`}>Precio del azúcar</label>
            <output htmlFor={`${id}-precio`} className={s.valorControl}>
              {p !== undefined ? `${usd(p, 2)}/lb` : "…"}
            </output>
          </div>
          <input
            id={`${id}-precio`}
            type="range"
            min={PRECIO_MIN}
            max={PRECIO_MAX}
            step={0.01}
            value={p ?? PRECIO_MIN}
            disabled={p === undefined}
            aria-valuetext={p !== undefined ? `${usd(p, 2)} por libra` : undefined}
            onChange={(e) => setPrecio(Math.round(Number(e.target.value) * 100) / 100)}
          />
          <div className={s.rangoExtremos} aria-hidden="true">
            <span>{usd(PRECIO_MIN, 2)}</span>
            <span>{usd(PRECIO_MAX, 2)}</span>
          </div>
        </div>

        <Desplegable titulo="Costos y barbecho (opcional)">
          <p className={s.ayuda}>Vacío = supuesto de la prueba.</p>
          {COSTOS.map((c) => (
            <div className="campo-form" key={c.clave}>
              <label htmlFor={`${id}-${c.clave}`}>{c.etiqueta}</label>
              <input
                id={`${id}-${c.clave}`}
                type="number"
                inputMode="decimal"
                min={0}
                max={c.max}
                step={c.paso}
                placeholder={base ? num(base[c.clave], Number.isInteger(base[c.clave]) ? 0 : 2) : ""}
                value={costos[c.clave]}
                onChange={(e) => setCostos((x) => ({ ...x, [c.clave]: e.target.value }))}
              />
              <span className="ayuda">
                {c.unidad}. La API acepta de 0 a {num(c.max)}.
              </span>
            </div>
          ))}
          <div className="campo-form">
            <label htmlFor={`${id}-barbecho`}>Barbecho antes de resembrar</label>
            <select id={`${id}-barbecho`} value={b ?? 0} onChange={(e) => setBarbecho(Number(e.target.value))}>
              <option value={0}>Sin barbecho</option>
              <option value={1}>1 año sin caña</option>
              <option value={2}>2 años sin caña</option>
            </select>
          </div>
          <label className={s.casilla}>
            <input type="checkbox" checked={extrapolar} onChange={(e) => setExtrapolar(e.target.checked)} />
            Extender la ventaja de la variedad más allá del último corte medido (sensibilidad)
          </label>
        </Desplegable>

        <div className={s.acciones}>
          <button type="button" className={`boton boton-sec ${s.botonChico}`} onClick={restablecer}>
            Volver a los supuestos de la prueba
          </button>
        </div>
      </form>

      <div className={s.salida}>
        <Respuesta
          fase={errorCatalogo ? "error" : catalogo.cargando ? "cargando" : consulta.fase}
          ruta={errorCatalogo || catalogo.cargando ? "GET /campo/variedades" : consulta.ruta}
          ms={consulta.ms}
          error={errorCatalogo ?? consulta.error}
          onReintentar={errorCatalogo ? catalogo.reintentar : () => cuerpo && void ejecutar("/campo/ciclo", cuerpo)}
          titular={d && <TitularCiclo d={d} />}
        >
          {d && <DetalleCiclo d={d} />}
        </Respuesta>
      </div>
    </div>
  );
}

function TitularCiclo({ d }: { d: RespuestaCiclo }) {
  const precio = `${usd(d.supuestos.precio, 2)}/lb`;
  if (d.margen_anual_usd_acre < 0) {
    return (
      <>
        Con {precio}, {d.variedad} no cubre sus costos: aun en su mejor ciclo pierde {usd(-d.margen_anual_usd_acre, 1)} por
        acre al año.
      </>
    );
  }
  return (
    <>
      Con {precio}, {d.variedad} deja el mayor margen si se renueva cada {d.ciclo_optimo_cortes} cortes:{" "}
      {usd(d.margen_anual_usd_acre, 1)} por acre al año.
    </>
  );
}

function DetalleCiclo({ d }: { d: RespuestaCiclo }) {
  const n = d.ciclo_optimo_cortes;
  const t = d.testigo_promedio;
  const ev = d.evidencia;
  const cert = d.certeza_con_supuestos_base;
  const sp = d.supuestos;
  return (
    <>
      <div className={s.pilaCifras}>
        <FilaCifras columnas={2}>
          <Cifra
            serie="campo"
            valor={n}
            unidad="cortes"
            etiqueta="Ciclo óptimo"
            detalle={`${n === 1 ? "Solo la plantía" : `Plantía y ${n - 1} ${n - 1 === 1 ? "soca" : "socas"}`}. Testigo promedio: ${t.ciclo_optimo_cortes} cortes.`}
          />
          <Cifra
            serie="campo"
            valor={num(d.margen_anual_usd_acre, 1)}
            unidad="US$/acre/año"
            etiqueta="Margen anual en ese ciclo"
            detalle={`${usd(d.margen_anual_usd_ha, 1)} por hectárea al año.`}
          />
        </FilaCifras>
        <FilaCifras columnas={2}>
          <Cifra
            serie="campo"
            valor={conSigno(d.ganancia_vs_testigos_usd_acre, 1)}
            unidad="US$/acre/año"
            etiqueta="Contra el testigo promedio"
            detalle={`El testigo deja ${usd(t.margen_anual_usd_acre, 1)} por acre al año.`}
          />
          <Cifra
            serie="campo"
            valor={d.precio_equilibrio_usd_lb === null ? "—" : num(d.precio_equilibrio_usd_lb, 3)}
            unidad="US$/lb"
            etiqueta="Precio de equilibrio"
            detalle={
              d.precio_equilibrio_usd_lb === null
                ? `Ni con ${usd(PRECIO_BUSQUEDA, 2)}/lb el mejor ciclo cubre los costos.`
                : "Debajo de este precio, ningún ciclo cubre los costos."
            }
          />
        </FilaCifras>
      </div>

      <Figura
        numero={1}
        titulo={`Con ${usd(sp.precio, 2)}/lb, el margen anual de ${d.variedad} es máximo si el ciclo dura ${n} cortes`}
        nota={`Cada barra es el margen promedio por año si se renueva después de ese número de cortes. En verde y rotulado, el ciclo óptimo. La línea punteada es el testigo promedio en su propio ciclo óptimo (${usd(t.margen_anual_usd_acre, 1)} por acre al año con ${t.ciclo_optimo_cortes} cortes).`}
        fuente="API, POST /campo/ciclo · curvas del notebook 02 (outputs/models/serie1_curvas.json)"
      >
        <GraficoCiclo d={d} />
      </Figura>

      <div>
        <p className={s.lineaDato}>
          Evidencia: {ev.ensayos} ensayos en {ev.anios} años; último corte medido: {nombreCorte(ev.ultimo_corte_medido)}.{" "}
          {ev.ventaja_extrapolada
            ? "Con la ventaja extendida más allá de ese corte (sensibilidad)."
            : n - 1 > ev.ultimo_corte_medido
              ? "Después de ese corte, el cálculo supone que la variedad cae al ritmo de los testigos."
              : ""}
        </p>
        <p className={s.lineaDato}>
          Certeza con los supuestos base: quedó entre las 3 mejores en el {pctFraccion(cert.P_top3, 1)} de las réplicas del
          remuestreo de ensayos; ganancia contra el testigo con IC90 de {usd(cert.ganancia_ic90_usd_acre[0], 1)} a{" "}
          {usd(cert.ganancia_ic90_usd_acre[1], 1)} por acre al año.
        </p>
        <p className={s.lineaDato}>
          Supuestos de esta respuesta: azúcar {usd(sp.precio, 2)}/lb · corte, alce y transporte {monto(sp.corte)}/t corta ·
          mantenimiento {monto(sp.mantenimiento)}/acre/año · renovación {monto(sp.renovacion)}/acre · barbecho{" "}
          {sp.barbecho === 0 ? "ninguno" : `${sp.barbecho} ${sp.barbecho === 1 ? "año" : "años"}`}.
        </p>
      </div>
      <RespuestaJson datos={d} />
    </>
  );
}

function GraficoCiclo({ d }: { d: RespuestaCiclo }) {
  const filas = d.margen_por_ciclo.map((f) => ({ ...f, optimo: f.cortes === d.ciclo_optimo_cortes }));
  const ref = d.testigo_promedio;
  const etiqueta = `Margen anual por número de cortes. El máximo, ${usd(d.margen_anual_usd_acre, 1)} por acre al año, está en ${d.ciclo_optimo_cortes} cortes.`;
  return (
    <PlotFigura
      alto={320}
      etiqueta={etiqueta}
      dependencias={[d]}
      crear={(ancho) => {
        const angosto = ancho < 560;
        const textoRef = `Testigo promedio: ${num(ref.margen_anual_usd_acre, 1)} (${ref.ciclo_optimo_cortes} cortes)`;
        return {
          marginTop: 44, // espacio para el rótulo de dos líneas del ciclo óptimo
          marginLeft: 56,
          marginRight: angosto ? 12 : 190,
          x: { label: "Cortes por ciclo (plantía + socas)", domain: filas.map((f) => f.cortes), padding: 0.35 },
          y: { label: "Margen anual (US$/acre/año)", grid: true, nice: true, tickFormat: (y: number) => num(y) },
          marks: [
            Plot.barY(filas, {
              x: "cortes",
              y: "margen_anual_usd_acre",
              fill: (f: (typeof filas)[number]) => (f.optimo ? COLORES.campo : COLORES.contexto),
            }),
            Plot.ruleY([0], { stroke: COLORES.tinta }),
            Plot.ruleY([ref.margen_anual_usd_acre], { stroke: COLORES.tinta2, strokeDasharray: "4,3" }),
            // En pantallas angostas el rótulo taparía las barras: el valor del testigo queda en la cifra y en la nota.
            ...(angosto
              ? []
              : [
                  Plot.text([ref.margen_anual_usd_acre], {
                    y: (y: number) => y,
                    text: () => textoRef,
                    frameAnchor: "right",
                    textAnchor: "start",
                    dx: 8,
                    fill: COLORES.tinta2,
                  }),
                ]),
            Plot.text(
              filas.filter((f) => f.margen_anual_usd_acre >= 0),
              {
                x: "cortes",
                y: "margen_anual_usd_acre",
                text: (f: (typeof filas)[number]) => `${f.optimo ? "óptimo\n" : ""}${num(f.margen_anual_usd_acre, 1)}`,
                lineAnchor: "bottom",
                dy: -5,
                fill: COLORES.tinta,
              },
            ),
            Plot.text(
              filas.filter((f) => f.margen_anual_usd_acre < 0),
              {
                x: "cortes",
                y: "margen_anual_usd_acre",
                text: (f: (typeof filas)[number]) => `${num(f.margen_anual_usd_acre, 1)}${f.optimo ? "\nóptimo" : ""}`,
                lineAnchor: "top",
                dy: 5,
                fill: COLORES.tinta,
              },
            ),
          ],
        };
      }}
    />
  );
}
