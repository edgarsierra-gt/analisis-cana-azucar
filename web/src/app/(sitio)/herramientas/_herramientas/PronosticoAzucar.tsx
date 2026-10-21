"use client";

import * as Plot from "@observablehq/plot";
import { useEffect, useId, useMemo, useState } from "react";
import { Cifra, FilaCifras } from "@/components/Cifra";
import { Figura } from "@/components/Figura";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { Desplegable } from "@/components/Nota";
import { Tabla } from "@/components/Tabla";
import { conSigno, num, pctFraccion } from "@/lib/formato";
import { nombreCorte, useConsulta, useVariedades } from "./consulta";
import { Respuesta, RespuestaJson } from "./Respuesta";
import s from "./herramientas.module.css";

type RespuestaPronostico = {
  variedad: string;
  finca: string;
  corte: number;
  escenario: 1 | 2;
  azucar_lb_acre: number;
  banda_lb_acre: [number, number];
  azucar_t_ha: number;
  banda_t_ha: [number, number];
  cobertura_real_banda: number;
  desglose_log: { base_del_corte: number; efecto_finca: number; ventaja_variedad: number; ventaja_lote_anterior: number };
  uso_lote_anterior: boolean;
  aviso: string;
};

/** Una consulta ya respondida, para comparar en la gráfica. */
type Consulta = RespuestaPronostico & { clave: string; rotulo: string };

const NUEVA = "nueva"; // finca sin historia: escenario 2 (api/servicios.py)
const CORTES = [0, 1, 2, 3, 4]; // la API acepta de 0 (plantía) a 4 (soca 4)
const MAX_CONSULTAS = 6;

const nombreFinca = (f: string) => (f === NUEVA ? "finca nueva" : f);

export function PronosticoAzucar() {
  const id = useId();
  const catalogo = useVariedades();
  const { ejecutar, ...consulta } = useConsulta<RespuestaPronostico>();

  const [variedad, setVariedad] = useState<string>();
  const [finca, setFinca] = useState<string>();
  const [corte, setCorte] = useState(0);
  const [usarLote, setUsarLote] = useState(false);
  const [ventaja, setVentaja] = useState("1.00");
  const [historial, setHistorial] = useState<Consulta[]>([]);

  const cat = catalogo.datos?.catalogo;
  const primera = catalogo.datos?.variedades[0]?.variedad;
  const v = variedad ?? (primera && cat?.variedades_pronostico.includes(primera) ? primera : cat?.variedades_pronostico[0]);
  const f = finca ?? cat?.fincas_pronostico.find((x) => x !== NUEVA);
  const conLote = usarLote && f !== NUEVA;

  const cuerpo = useMemo(() => {
    if (!v || !f) return null;
    const c: Record<string, unknown> = { variedad: v, finca: f, corte };
    const x = Number(ventaja);
    if (conLote && ventaja.trim() !== "" && Number.isFinite(x)) c.ventaja_lote_anterior = x;
    return c;
  }, [v, f, corte, conLote, ventaja]);

  useEffect(() => {
    if (!cuerpo) return;
    const t = setTimeout(
      () =>
        void ejecutar("/campo/pronostico", cuerpo, (r) => {
          const lote = r.uso_lote_anterior ? ` · lote ×${num(Number(cuerpo.ventaja_lote_anterior), 2)}` : "";
          const clave = `${r.variedad}|${r.finca}|${r.corte}|${lote}`;
          const rotulo = `${r.variedad} · ${nombreFinca(r.finca)} · ${nombreCorte(r.corte)}${lote}`;
          setHistorial((h) => [{ ...r, clave, rotulo }, ...h.filter((x) => x.clave !== clave)].slice(0, MAX_CONSULTAS));
        }),
      250,
    );
    return () => clearTimeout(t);
  }, [cuerpo, ejecutar]);

  const d = consulta.datos;
  const errorCatalogo = catalogo.error;

  return (
    <div className={s.herramienta}>
      <form className={s.controles} onSubmit={(e) => e.preventDefault()} aria-label="Datos del pronóstico">
        <p className={`etiqueta ${s.tituloPanel}`}>Lote a pronosticar</p>
        <div className="campo-form">
          <label htmlFor={`${id}-variedad`}>Variedad</label>
          <select id={`${id}-variedad`} value={v ?? ""} disabled={!cat} onChange={(e) => setVariedad(e.target.value)}>
            {!cat && <option value="">Cargando variedades…</option>}
            {cat?.variedades_pronostico.map((x) => (
              <option key={x} value={x}>
                {cat.testigos_nucleo.includes(x) ? `${x} (testigo)` : x}
              </option>
            ))}
          </select>
          {cat && <span className="ayuda">Las {cat.variedades_pronostico.length} variedades con historia en etapa 5.</span>}
        </div>
        <div className="campo-form">
          <label htmlFor={`${id}-finca`}>Finca</label>
          <select id={`${id}-finca`} value={f ?? ""} disabled={!cat} onChange={(e) => setFinca(e.target.value)}>
            {!cat && <option value="">Cargando fincas…</option>}
            {cat?.fincas_pronostico.map((x) => (
              <option key={x} value={x}>
                {x === NUEVA ? "Finca nueva (sin historia)" : x}
              </option>
            ))}
          </select>
          <span className="ayuda">Localidades de los ensayos de Louisiana, o una finca nueva.</span>
        </div>
        <div className="campo-form">
          <label htmlFor={`${id}-corte`}>Corte</label>
          <select id={`${id}-corte`} value={corte} onChange={(e) => setCorte(Number(e.target.value))}>
            {CORTES.map((k) => (
              <option key={k} value={k}>
                {k === 0 ? "Plantía (corte 0)" : `Soca ${k}`}
              </option>
            ))}
          </select>
        </div>
        <hr className={s.separador} />
        <label className={s.casilla}>
          <input
            type="checkbox"
            checked={usarLote}
            disabled={f === NUEVA}
            onChange={(e) => setUsarLote(e.target.checked)}
            aria-describedby={`${id}-lote-ayuda`}
          />
          Conozco la ventaja de la variedad en este lote el año pasado
        </label>
        <div className="campo-form">
          <label htmlFor={`${id}-ventaja`}>Ventaja del lote el año pasado</label>
          <input
            id={`${id}-ventaja`}
            type="number"
            inputMode="decimal"
            min={0.21}
            max={4.99}
            step={0.01}
            value={ventaja}
            disabled={!conLote}
            onChange={(e) => setVentaja(e.target.value)}
          />
          <span className="ayuda" id={`${id}-lote-ayuda`}>
            {f === NUEVA
              ? "Con una finca nueva no se usa: no hay lote del año pasado."
              : "Azúcar de la variedad ÷ azúcar de los testigos en el mismo lote. 1.05 = 5 % arriba. La API acepta valores mayores que 0.2 y menores que 5."}
          </span>
        </div>
      </form>

      <div className={s.salida}>
        <Respuesta
          fase={errorCatalogo ? "error" : catalogo.cargando ? "cargando" : consulta.fase}
          ruta={errorCatalogo || catalogo.cargando ? "GET /campo/variedades" : consulta.ruta}
          ms={consulta.ms}
          error={errorCatalogo ?? consulta.error}
          onReintentar={errorCatalogo ? catalogo.reintentar : () => cuerpo && void ejecutar("/campo/pronostico", cuerpo)}
          titular={
            d && (
              <>
                {d.variedad} en {d.finca === NUEVA ? "una finca nueva" : `la finca ${d.finca}`}, {nombreCorte(d.corte)}:{" "}
                {num(d.azucar_lb_acre, 1)} lb de azúcar por acre, con banda de {num(d.banda_lb_acre[0], 1)} a{" "}
                {num(d.banda_lb_acre[1], 1)}.
              </>
            )
          }
        >
          {d && <DetallePronostico d={d} historial={historial} />}
        </Respuesta>
      </div>
    </div>
  );
}

function DetallePronostico({ d, historial }: { d: RespuestaPronostico; historial: Consulta[] }) {
  const g = d.desglose_log;
  const efecto = (x: number) => `${conSigno((Math.exp(x) - 1) * 100, 1)} %`;
  // Banda en % del azúcar esperado, como la reporta el notebook 03 (−29 % / +32 %).
  const bandaPct = d.banda_lb_acre.map((b) => conSigno((b / d.azucar_lb_acre - 1) * 100, 0));
  const filas = [
    { componente: `Nivel típico de la ${nombreCorte(d.corte)}`, log: g.base_del_corte, efecto: `${num(Math.exp(g.base_del_corte), 0)} lb/acre` },
    { componente: d.escenario === 2 ? "Finca (nueva: sin efecto)" : `Finca ${d.finca}`, log: g.efecto_finca, efecto: efecto(g.efecto_finca) },
    { componente: `Ventaja histórica de ${d.variedad}`, log: g.ventaja_variedad, efecto: efecto(g.ventaja_variedad) },
    {
      componente: d.uso_lote_anterior ? "Ventaja del lote el año pasado" : "Lote el año pasado (no se usó)",
      log: g.ventaja_lote_anterior,
      efecto: efecto(g.ventaja_lote_anterior),
    },
  ];
  return (
    <>
      <div className={s.pilaCifras}>
        <FilaCifras columnas={2}>
          <Cifra
            serie="campo"
            valor={num(d.azucar_lb_acre, 1)}
            unidad="lb/acre"
            etiqueta="Azúcar esperado"
            detalle={`Banda: ${num(d.banda_lb_acre[0], 1)} a ${num(d.banda_lb_acre[1], 1)} lb/acre.`}
          />
          <Cifra
            serie="campo"
            valor={num(d.azucar_t_ha, 3)}
            unidad="t/ha"
            etiqueta="Lo mismo, en toneladas por hectárea"
            detalle={`Banda: ${num(d.banda_t_ha[0], 3)} a ${num(d.banda_t_ha[1], 3)} t/ha.`}
          />
        </FilaCifras>
        <FilaCifras columnas={2}>
          <Cifra
            serie="campo"
            valor={`${bandaPct[0]} / ${bandaPct[1]}`}
            unidad="%"
            etiqueta="Banda alrededor del esperado"
            detalle="Abajo y arriba del azúcar esperado."
          />
          <Cifra
            serie="campo"
            valor={num(d.cobertura_real_banda * 100, 0)}
            unidad="%"
            etiqueta="Cobertura real de la banda"
            detalle={`La banda nominal es de 80 %. En la validación por zafra cubrió el ${pctFraccion(d.cobertura_real_banda, 0)} de los casos (escenario ${d.escenario}).`}
          />
        </FilaCifras>
      </div>
      {d.escenario === 2 && (
        <p className={s.lineaDato}>
          Finca nueva: el modelo solo usa la ventaja de la variedad (escenario 2). Por eso la banda cubre menos.
        </p>
      )}

      <Figura
        numero={2}
        titulo={`La banda de la consulta actual va de ${bandaPct[0]} % a ${bandaPct[1]} % del azúcar esperado`}
        nota="El punto es el azúcar esperado y la línea, la banda. La consulta actual va en verde y dice «Actual»; las anteriores (hasta 6) van en gris. Cambie la variedad, la finca o el corte para comparar."
        fuente="API, POST /campo/pronostico · modelo del notebook 03 (outputs/models/serie1_modelo_p2.json)"
      >
        <GraficoBandas consultas={historial.length ? historial : [{ ...d, clave: "actual", rotulo: d.variedad }]} actual={historial[0]?.clave} />
      </Figura>

      <Desplegable titulo="Cómo se arma el número (desglose del modelo)">
        <p>
          El modelo trabaja en logaritmo: suma el nivel típico del corte, el efecto de la finca y la ventaja de la variedad
          (y la del lote, si se conoce). Cada término multiplica el azúcar esperado.
        </p>
        <Tabla
          compacta
          columnas={[
            { clave: "componente", titulo: "Componente" },
            { clave: "log", titulo: "En logaritmo", tipo: "num", valor: (x) => num(x.log, 4) },
            { clave: "efecto", titulo: "Efecto", tipo: "num" },
          ]}
          filas={filas}
        />
        <p>{d.aviso}</p>
      </Desplegable>
      <RespuestaJson datos={d} />
    </>
  );
}

function GraficoBandas({ consultas, actual }: { consultas: Consulta[]; actual?: string }) {
  const filas = consultas.map((c, i) => ({ ...c, esActual: actual ? c.clave === actual : i === 0 }));
  const tope = Math.max(...filas.map((f) => f.banda_lb_acre[1]));
  const etiqueta = `Azúcar esperado con su banda para ${filas.length} ${filas.length === 1 ? "consulta" : "consultas"}. La actual: ${num(filas[0].azucar_lb_acre, 1)} lb por acre, banda de ${num(filas[0].banda_lb_acre[0], 1)} a ${num(filas[0].banda_lb_acre[1], 1)}.`;
  const color = (f: (typeof filas)[number]) => (f.esActual ? COLORES.campo : COLORES.contexto);
  return (
    <PlotFigura
      alto={56 * filas.length + 56}
      etiqueta={etiqueta}
      dependencias={[consultas, actual]}
      crear={() => ({
        marginLeft: 12,
        marginRight: 12,
        marginTop: 28,
        x: { label: "Azúcar (lb/acre)", domain: [0, tope * 1.05], grid: true, tickFormat: (x: number) => num(x) },
        y: { domain: filas.map((f) => f.clave), axis: null, padding: 0.5 },
        marks: [
          Plot.ruleX([0], { stroke: COLORES.tinta }),
          Plot.ruleY(filas, {
            y: "clave",
            x1: (f: (typeof filas)[number]) => f.banda_lb_acre[0],
            x2: (f: (typeof filas)[number]) => f.banda_lb_acre[1],
            stroke: color,
            strokeWidth: 3,
          }),
          Plot.dot(filas, { y: "clave", x: "azucar_lb_acre", fill: color, r: 5 }),
          Plot.text(filas, {
            y: "clave",
            x: 0,
            text: (f: (typeof filas)[number]) => `${f.esActual ? "Actual: " : ""}${f.rotulo} · ${num(f.azucar_lb_acre, 1)}`,
            textAnchor: "start",
            dx: 4,
            dy: -13,
            fill: (f: (typeof filas)[number]) => (f.esActual ? COLORES.tinta : COLORES.tinta2),
          }),
        ],
      })}
    />
  );
}
