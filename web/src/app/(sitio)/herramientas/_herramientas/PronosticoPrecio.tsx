"use client";

import * as Plot from "@observablehq/plot";
import { useEffect, useId, useState } from "react";
import { Cifra, FilaCifras } from "@/components/Cifra";
import { Figura } from "@/components/Figura";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { Tabla } from "@/components/Tabla";
import { conSigno, num, usd } from "@/lib/formato";
import { useConsulta } from "./consulta";
import { DetalleTecnico, Respuesta, Secundarias } from "./Respuesta";
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
/** Halo blanco detrás de un rótulo de la gráfica, para que ninguna línea lo tache (como en las gráficas de /campo). */
const HALO = { stroke: "var(--fondo)", strokeWidth: 4 } as const;
const millones = (x: number) => num(x / 1e6, 2);

export function PronosticoPrecio({
  cierres, coberturas, junioParcial, metodo, contexto,
}: {
  /** Cómo calcula la API (texto de la página), para el detalle técnico. */
  metodo?: React.ReactNode;
  /** "Cómo lo sé" y el límite: van entre la herramienta y su detalle técnico. */
  contexto?: React.ReactNode;
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
    <>
    <div className={s.herramienta}>
      <form className={s.controles} onSubmit={(e) => e.preventDefault()} aria-label="Datos del pronóstico de precio" data-ui="">
        <p className={s.tituloPanel}>Pronóstico</p>
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
          cabeza={d && <CifrasMercado d={d} />}
        >
          {d && <DetalleMercado d={d} cierres={cierres} coberturas={coberturas} junioParcial={junioParcial} />}
        </Respuesta>
      </div>
    </div>
    {contexto}
    <DetalleTecnico metodo={metodo} respuestas={d ? [{ titulo: "Respuesta completa de la API (JSON)", datos: d }] : []} />
    </>
  );
}

// "US$" + "${…}": el primer $ es texto; sin él, la plantilla se come el signo y sale "US3.80".
const millonesRango = (p: Par) => `US$${millones(p[0])} y US$${millones(p[1])} millones`;

/** Lo que responde: el rango (piso y techo de la banda de 80 %). El centro va como dato secundario. */
function CifrasMercado({ d }: { d: RespuestaMercado }) {
  const b80 = d.bandas_centavos_lb["80"];
  const p80 = d.bandas_pct["80"];
  const t80 = d.bandas_usd_t["80"];
  const ing = d.ingreso_usd;
  return (
    <>
      <FilaCifras columnas={2}>
        <Cifra
          serie="mercado"
          valor={num(b80[0], 2)}
          unidad="¢/lb"
          etiqueta="Piso de la banda de 80 %"
          detalle={`${conSigno(p80[0], 1)} % del último cierre · ${usd(t80[0], 1)} por tonelada.`}
        />
        <Cifra
          serie="mercado"
          valor={num(b80[1], 2)}
          unidad="¢/lb"
          etiqueta="Techo de la banda de 80 %"
          detalle={`${conSigno(p80[1], 1)} % del último cierre · ${usd(t80[1], 1)} por tonelada.`}
        />
      </FilaCifras>
      <Secundarias>
        <li>
          <strong className="num">{num(d.centro_centavos_lb, 2)} ¢/lb</strong> es el centro: el último cierre (
          {fechaCorta(d.fecha_ultimo_cierre)}), {usd(d.centro_usd_t, 1)} por tonelada.
        </li>
        {ing && (
          <li>
            <strong className="num">US${millones(ing.centro)} millones</strong> por {num(ing.toneladas)} t sin fijar. Con la
            banda de 80 %, entre {millonesRango(ing["80"])}; con la de 95 %, entre {millonesRango(ing["95"])}.
          </li>
        )}
      </Secundarias>
    </>
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
      <Figura
        titulo={
          d.horizonte_meses === 1
            ? `El promedio real de junio, hasta el ${hastaDia}, quedó ${dentro ? "dentro" : "fuera"} de la banda de 80 %`
            : `A ${d.horizonte_meses} meses, la banda de 80 % va de ${conSigno(p80[0], 0)} % a ${conSigno(p80[1], 0)} % del último cierre`
        }
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
        movil="apilar"
        nota="Precio No. 11 sin primas, flete ni tipo de cambio."
      />
      {cob && (
        <p className={s.lineaDato}>
          <strong>Qué tan confiable es.</strong> En la validación hacia adelante del notebook 12, la banda de 80 % a {d.horizonte_meses}{" "}
          {d.horizonte_meses === 1 ? "mes" : "meses"} cubrió el {num(cob["80"], 1)} % de los meses y la de 95 %, el{" "}
          {num(cob["95"], 1)} %. {/* notebook 12, celda 17: "volatilidad de 3 meses: 7.5 % mensual" (un decimal) */}
          Volatilidad de 3 meses al último cierre: {num(d.volatilidad_3m_mensual_pct, 1)} % mensual.
        </p>
      )}
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
  const conRaya = d.horizonte_meses === 1 && junio.x2 !== undefined;
  return (
    <PlotFigura
      alto={360}
      etiqueta={etiqueta}
      dependencias={[d, cierres]}
      crear={(ancho) => ({
        marginLeft: 40,
        // A la derecha, los rótulos directos de las bandas y del promedio real (en el teléfono no caben: los dice la nota).
        marginRight: ancho < 560 ? 16 : 112,
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
          // Rótulo con halo blanco: la línea de cierres pasa por detrás y antes lo tachaba.
          Plot.text([ultimo], {
            x: "t",
            y: "v",
            text: () => `Último cierre ${num(d.centro_centavos_lb, 2)}`,
            textAnchor: "end",
            dx: -8,
            dy: 16,
            fill: COLORES.tinta,
            ...HALO,
          }),
          ...(conRaya ? [Plot.ruleY([junio], { y: "y", x1: "x1", x2: "x2", stroke: COLORES.tinta, strokeWidth: 2.5 })] : []),
          ...(ancho < 560
            ? []
            : [
                // Las bandas se rotulan en su borde de abajo; arriba queda el sitio del promedio real.
                Plot.text([caja("80")], { x: "x2", y: "y1", text: () => "80 %", textAnchor: "start", dx: 6, fill: COLORES.mercado, ...HALO }),
                Plot.text([caja("95")], { x: "x2", y: "y1", text: () => "95 %", textAnchor: "start", dx: 6, fill: COLORES.mercado, ...HALO }),
                ...(conRaya
                  ? [
                      Plot.text([junio], {
                        x: () => hasta,
                        y: "y",
                        text: () => `Real ${num(junioParcial, 2)}`,
                        textAnchor: "start",
                        dx: 6,
                        fill: COLORES.tinta,
                        fontWeight: 600,
                        ...HALO,
                      }),
                    ]
                  : []),
              ]),
        ],
      })}
    />
  );
}
