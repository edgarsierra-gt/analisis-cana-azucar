"use client";

import * as Plot from "@observablehq/plot";
import { useEffect, useId, useState } from "react";
import { Cifra, FilaCifras } from "@/components/Cifra";
import { Figura } from "@/components/Figura";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { Tabla } from "@/components/Tabla";
import { conSigno, num, usd } from "@/lib/formato";
import { useConsulta } from "./consulta";
import { Respuesta, RespuestaJson } from "./Respuesta";
import s from "./herramientas.module.css";

type Par = [number, number];
type RespuestaMercado = {
  horizonte_meses: number;
  mes_objetivo: string;
  fecha_ultimo_cierre: string;
  centro_centavos_lb: number;
  bandas_centavos_lb: { "80": Par; "95": Par };
  bandas_pct: { "80": Par; "95": Par };
  centro_usd_t: number;
  bandas_usd_t: { "80": Par; "95": Par };
  volatilidad_3m_mensual_pct: number;
  aviso: string;
  ingreso_usd?: { toneladas: number; centro: number; "80": Par; "95": Par };
};

export type Cierre = { fecha: string; cierre: number };

const HORIZONTES = [1, 3] as const; // la API acepta 1 o 3 meses
const TONELADAS_MAX = 10_000_000; // tope de la API (api/main.py)
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const millones = (x: number) => num(x / 1e6, 2);

export function PronosticoPrecio({
  cierres, coberturas, junioParcial,
}: {
  /** Cierres diarios del No. 11 alrededor del último cierre de la prueba (¢/lb). */
  cierres: Cierre[];
  /** Cobertura real de las bandas según volatilidad en la validación del notebook 12 (%). */
  coberturas: Record<string, { "80": number; "95": number }>;
  /** Promedio real de junio de 2024 hasta el día 24 (¢/lb), con el que el notebook 12 revisa la banda a 1 mes. */
  junioParcial: number;
}) {
  const id = useId();
  const { ejecutar, ...consulta } = useConsulta<RespuestaMercado>();
  const [h, setH] = useState<1 | 3>(1);
  const [toneladas, setToneladas] = useState("10000"); // ejemplo de docs/api.md

  const ton = Number(toneladas);
  const ruta = `/mercado/pronostico?h=${h}${toneladas.trim() !== "" && Number.isFinite(ton) ? `&toneladas=${ton}` : ""}`;

  useEffect(() => {
    const t = setTimeout(() => void ejecutar(ruta), 250);
    return () => clearTimeout(t);
  }, [ruta, ejecutar]);

  const d = consulta.datos;

  return (
    <div className={s.herramienta}>
      <form className={s.controles} onSubmit={(e) => e.preventDefault()} aria-label="Datos del pronóstico de precio">
        <p className={`etiqueta ${s.tituloPanel}`}>Pronóstico</p>
        <fieldset>
          <legend>Horizonte</legend>
          <div className={s.segmentos}>
            {HORIZONTES.map((x) => (
              <label key={x}>
                <input type="radio" name={`${id}-h`} value={x} checked={h === x} onChange={() => setH(x)} />
                {x} {x === 1 ? "mes" : "meses"}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="campo-form">
          <label htmlFor={`${id}-ton`}>Toneladas sin fijar (opcional)</label>
          <input
            id={`${id}-ton`}
            type="number"
            inputMode="numeric"
            min={1}
            max={TONELADAS_MAX}
            step="any"
            value={toneladas}
            onChange={(e) => setToneladas(e.target.value)}
          />
          <span className="ayuda">
            Toneladas métricas de azúcar sin precio fijado. Vacío = sin rango de ingreso. La API acepta más de 0 y hasta{" "}
            {num(TONELADAS_MAX)}.
          </span>
        </div>
      </form>

      <div className={s.salida}>
        <Respuesta
          fase={consulta.fase}
          ruta={consulta.ruta}
          ms={consulta.ms}
          error={consulta.error}
          onReintentar={() => void ejecutar(ruta)}
          titular={
            d && (
              <>
                Para el promedio de {d.mes_objetivo}, el centro es {num(d.centro_centavos_lb, 2)} ¢/lb (el último cierre) y la
                banda de 80 % va de {num(d.bandas_centavos_lb["80"][0], 2)} a {num(d.bandas_centavos_lb["80"][1], 2)} ¢/lb.
              </>
            )
          }
        >
          {d && <DetalleMercado d={d} cierres={cierres} coberturas={coberturas} junioParcial={junioParcial} />}
        </Respuesta>
      </div>
    </div>
  );
}

function DetalleMercado({
  d, cierres, coberturas, junioParcial,
}: {
  d: RespuestaMercado;
  cierres: Cierre[];
  coberturas: Record<string, { "80": number; "95": number }>;
  junioParcial: number;
}) {
  const b80 = d.bandas_centavos_lb["80"];
  const p80 = d.bandas_pct["80"];
  const t80 = d.bandas_usd_t["80"];
  const ing = d.ingreso_usd;
  const cob = coberturas[String(d.horizonte_meses)];
  const rango = (p: Par, dec: number, f: (x: number, dec: number) => string = num) => `${f(p[0], dec)} a ${f(p[1], dec)}`;
  const porcentaje = (p: Par) => `${conSigno(p[0], 1)} % a ${conSigno(p[1], 1)} %`;
  const filas = [
    {
      nivel: "Centro (último cierre)",
      cl: num(d.centro_centavos_lb, 2),
      pct: "—",
      t: num(d.centro_usd_t, 1),
      ingreso: ing ? num(ing.centro) : "—",
    },
    ...(["80", "95"] as const).map((k) => ({
      nivel: `Banda de ${k} %`,
      cl: rango(d.bandas_centavos_lb[k], 2),
      pct: porcentaje(d.bandas_pct[k]),
      t: rango(d.bandas_usd_t[k], 1),
      ingreso: ing ? rango(ing[k], 0) : "—",
    })),
  ];
  const dentro = junioParcial >= b80[0] && junioParcial <= b80[1];
  const hastaDia = fechaCorta(cierres[cierres.length - 1].fecha).slice(0, 5);

  return (
    <>
      <FilaCifras columnas={3}>
        <Cifra
          serie="mercado"
          valor={num(d.centro_centavos_lb, 2)}
          unidad="¢/lb"
          etiqueta={`Centro: último cierre (${fechaCorta(d.fecha_ultimo_cierre)})`}
          detalle={`${usd(d.centro_usd_t, 1)} por tonelada.`}
        />
        <Cifra
          serie="mercado"
          valor={num(b80[0], 2)}
          unidad="¢/lb"
          etiqueta="Piso de la banda de 80 % (p10)"
          detalle={`${conSigno(p80[0], 1)} % · ${usd(t80[0], 1)} por tonelada.`}
        />
        <Cifra
          serie="mercado"
          valor={num(b80[1], 2)}
          unidad="¢/lb"
          etiqueta="Techo de la banda de 80 % (p90)"
          detalle={`${conSigno(p80[1], 1)} % · ${usd(t80[1], 1)} por tonelada.`}
        />
      </FilaCifras>
      {ing && (
        <p className={s.lineaDato}>
          Ingreso de {num(ing.toneladas)} t sin fijar: centro de US${millones(ing.centro)} millones. Con la banda de 80 %, entre
          US${millones(ing["80"][0])} y US${millones(ing["80"][1])} millones; con la de 95 %, entre US$
          {millones(ing["95"][0])} y US${millones(ing["95"][1])} millones.
        </p>
      )}

      <Figura
        numero={5}
        titulo={`A ${d.horizonte_meses} ${d.horizonte_meses === 1 ? "mes" : "meses"}, la banda de 80 % va de ${conSigno(p80[0], 0)} % a ${conSigno(p80[1], 0)} % del último cierre`}
        nota={`Línea gris: cierres diarios del No. 11 hasta el último cierre de la prueba; la parte punteada son los cierres que llegaron después y no entran al cálculo. A la derecha, el promedio del mes objetivo: banda de 95 % (clara), de 80 % (oscura) y centro.${d.horizonte_meses === 1 ? ` La raya negra es el promedio real de junio hasta el ${hastaDia} (${num(junioParcial, 2)} ¢/lb): ${dentro ? "quedó dentro" : "quedó fuera"} de la banda de 80 %.` : ""}`}
        fuente="API, GET /mercado/pronostico · notebook 12 (outputs/models/serie3_pronostico.json) · cierres de outputs/tables/serie3_precio_diario.csv"
      >
        <GraficoBanda d={d} cierres={cierres} junioParcial={junioParcial} />
      </Figura>

      <Tabla
        titulo={`Escenarios para ${d.mes_objetivo}`}
        compacta
        columnas={[
          { clave: "nivel", titulo: "Escenario" },
          { clave: "cl", titulo: "¢/lb", tipo: "num" },
          { clave: "pct", titulo: "Contra el cierre", tipo: "num" },
          { clave: "t", titulo: "US$/t", tipo: "num" },
          { clave: "ingreso", titulo: ing ? `Ingreso de ${num(ing.toneladas)} t (US$)` : "Ingreso (US$)", tipo: "num" },
        ]}
        filas={filas}
        nota="Precio No. 11 sin primas, flete ni tipo de cambio."
      />
      {cob && (
        <p className={s.lineaDato}>
          En la validación hacia adelante del notebook 12, la banda de 80 % a {d.horizonte_meses}{" "}
          {d.horizonte_meses === 1 ? "mes" : "meses"} cubrió el {num(cob["80"], 1)} % de los meses y la de 95 %, el{" "}
          {num(cob["95"], 1)} %. {/* notebook 12, celda 17: "volatilidad de 3 meses: 7.5 % mensual" (un decimal) */}
          Volatilidad de 3 meses al último cierre: {num(d.volatilidad_3m_mensual_pct, 1)} % mensual.
        </p>
      )}
      <RespuestaJson datos={d} />
    </>
  );
}

function GraficoBanda({ d, cierres, junioParcial }: { d: RespuestaMercado; cierres: Cierre[]; junioParcial: number }) {
  const origen = d.fecha_ultimo_cierre;
  const antes = cierres.filter((c) => c.fecha <= origen).map((c) => ({ t: new Date(c.fecha), v: c.cierre }));
  const despues = cierres.filter((c) => c.fecha >= origen).map((c) => ({ t: new Date(c.fecha), v: c.cierre }));
  const ultimo = antes[antes.length - 1];
  const o = new Date(origen);
  // El mes objetivo es el promedio del mes h después del último cierre.
  const desde = new Date(Date.UTC(o.getUTCFullYear(), o.getUTCMonth() + d.horizonte_meses, 1));
  const hasta = new Date(Date.UTC(o.getUTCFullYear(), o.getUTCMonth() + d.horizonte_meses + 1, 1));
  const ultimoDespues = despues[despues.length - 1];
  const caja = (k: "80" | "95") => ({ x1: desde, x2: hasta, y1: d.bandas_centavos_lb[k][0], y2: d.bandas_centavos_lb[k][1] });
  const junio = { x1: new Date(Date.UTC(o.getUTCFullYear(), o.getUTCMonth() + 1, 1)), x2: ultimoDespues?.t, y: junioParcial };
  const etiqueta = `Cierres diarios del azúcar No. 11 y banda del promedio de ${d.mes_objetivo}: centro ${num(d.centro_centavos_lb, 2)} ¢/lb, 80 % entre ${num(d.bandas_centavos_lb["80"][0], 2)} y ${num(d.bandas_centavos_lb["80"][1], 2)}.`;
  return (
    <PlotFigura
      alto={320}
      etiqueta={etiqueta}
      dependencias={[d, cierres]}
      crear={(ancho) => ({
        marginLeft: 40,
        marginRight: ancho < 560 ? 16 : 64,
        x: {
          type: "utc",
          label: null,
          domain: [antes[0].t, hasta],
          ticks: ancho < 560 ? 4 : 8,
          tickFormat: (t: Date) => `${MESES[t.getUTCMonth()]}${t.getUTCMonth() === 0 ? ` ${t.getUTCFullYear()}` : ""}`,
        },
        y: { label: "¢/lb", grid: true, nice: true },
        marks: [
          Plot.rect([caja("95")], { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: COLORES.mercado, fillOpacity: 0.16 }),
          Plot.rect([caja("80")], { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: COLORES.mercado, fillOpacity: 0.38 }),
          Plot.ruleY([{ y: d.centro_centavos_lb, x1: desde, x2: hasta }], { y: "y", x1: "x1", x2: "x2", stroke: COLORES.mercado, strokeWidth: 2.5 }),
          Plot.lineY(antes, { x: "t", y: "v", stroke: COLORES.contexto, strokeWidth: 1.5 }),
          Plot.lineY(despues, { x: "t", y: "v", stroke: COLORES.tinta2, strokeWidth: 1.25, strokeDasharray: "2,3" }),
          Plot.dot([ultimo], { x: "t", y: "v", fill: COLORES.tinta, r: 4 }),
          Plot.text([ultimo], {
            x: "t",
            y: "v",
            text: () => `Último cierre ${num(d.centro_centavos_lb, 2)}`,
            textAnchor: "end",
            dx: -6,
            dy: -12,
            fill: COLORES.tinta,
          }),
          ...(d.horizonte_meses === 1 && junio.x2
            ? [Plot.ruleY([junio], { y: "y", x1: "x1", x2: "x2", stroke: COLORES.tinta, strokeWidth: 2 })]
            : []),
          ...(ancho < 560
            ? []
            : [
                Plot.text([caja("80")], { x: "x2", y: "y2", text: () => "80 %", textAnchor: "start", dx: 6, fill: COLORES.mercado }),
                Plot.text([caja("95")], { x: "x2", y: "y2", text: () => "95 %", textAnchor: "start", dx: 6, fill: COLORES.mercado }),
              ]),
        ],
      })}
    />
  );
}
