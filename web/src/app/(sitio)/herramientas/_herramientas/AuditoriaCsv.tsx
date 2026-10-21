"use client";

import { useId, useState } from "react";
import { Cifra, FilaCifras } from "@/components/Cifra";
import { Tabla } from "@/components/Tabla";
import { ruta } from "@/lib/base";
import { num, pctFraccion } from "@/lib/formato";
import { useConsulta } from "./consulta";
import { Respuesta, RespuestaJson } from "./Respuesta";
import s from "./herramientas.module.css";

type Ciclo = {
  finca: string; lote: string; ciclo: number; variedad: string; zafra_inicio: number; zafra_fin: number;
  cortes_ciclo: number; inicio_observado: boolean; cerrado: boolean; optimo: number; estado: string;
};
type Lote = {
  finca: string; lote: string; renovaciones: number; tempranas: number; tardias: number; estado_actual: string;
  cortes_actuales: number; inicio_antes_de_datos: boolean; diagnostico: string;
};
type Decision = {
  finca: string; lote: string; variedad: string; corte_siguiente: number; tch_esperado: number | null;
  margen_siguiente: number | null; margen_ciclo_nuevo: number | null; decision: string;
};
type RespuestaAuditoria = {
  optimo_cortes: number;
  tolerancia: number;
  corte_registrado: boolean;
  resumen: { lotes: number; registros: number; ciclos: number; ciclos_cerrados: number; estados: Record<string, number> };
  ciclos: Ciclo[];
  lotes: Lote[];
  decisiones: Decision[];
};

const EJEMPLO = "/ejemplos/cosechas_ejemplo.csv";
const MAX_FILAS = 50; // filas por tabla en pantalla; la respuesta completa queda en el JSON
const TOLERANCIAS = [0, 1, 2, 3]; // la API acepta de 0 a 3 cortes de tolerancia (api/main.py)
/** Lote con alguna renovación fuera de tiempo (temprana o tardía) en el período. */
const fueraDeTiempo = (l: Lote) => l.tempranas + l.tardias > 0;
/** Lote cuyo ciclo actual ya pasó el óptimo más la tolerancia. */
const vencido = (l: Lote) => l.estado_actual.startsWith("vencido");

export function AuditoriaCsv({ perdidasSinCorte, maxCortes }: { perdidasSinCorte: number; maxCortes: number }) {
  const id = useId();
  const { ejecutar, ...consulta } = useConsulta<RespuestaAuditoria>();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [tolerancia, setTolerancia] = useState(1); // valor por defecto de la API
  const [enviado, setEnviado] = useState<File>();
  const [errorEjemplo, setErrorEjemplo] = useState<string>();

  const enviar = (f: File) => {
    const datos = new FormData();
    datos.append("archivo", f, f.name);
    setEnviado(f);
    setErrorEjemplo(undefined);
    void ejecutar(`/campo/auditoria/csv?tolerancia=${tolerancia}`, datos);
  };

  const probarEjemplo = async () => {
    try {
      const r = await fetch(ruta(EJEMPLO));
      if (!r.ok) throw new Error(String(r.status));
      enviar(new File([await r.blob()], "cosechas_ejemplo.csv", { type: "text/csv" }));
    } catch {
      setErrorEjemplo("No se pudo leer el archivo de ejemplo del sitio.");
    }
  };

  const d = consulta.datos;

  return (
    <div className={s.herramienta}>
      <form
        className={s.controles}
        aria-label="Archivo de cosechas"
        onSubmit={(e) => {
          e.preventDefault();
          if (archivo) enviar(archivo);
        }}
      >
        <p className={`etiqueta ${s.tituloPanel}`}>Registros de cosecha</p>
        <div className="campo-form">
          <span className={s.rotuloCampo} id={`${id}-rotulo`}>
            Archivo CSV
          </span>
          <div className={s.archivo}>
            <label className="boton boton-sec">
              Elegir archivo
              <input
                type="file"
                accept=".csv,text/csv"
                aria-labelledby={`${id}-rotulo`}
                aria-describedby={`${id}-columnas`}
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
            <span className={s.nombreArchivo}>{archivo ? archivo.name : "Ningún archivo elegido"}</span>
          </div>
          <span className="ayuda" id={`${id}-columnas`}>
            Una fila por lote y corte. Columnas: <code>zafra</code>, <code>finca</code>, <code>lote</code>,{" "}
            <code>variedad</code>, <code>corte</code> (0 = plantía) y <code>tch</code> (t de caña por hectárea). Opcional:{" "}
            <code>rendimiento</code> (kg de azúcar por t).
          </span>
        </div>
        <div className="campo-form">
          <label htmlFor={`${id}-tolerancia`}>Tolerancia contra el óptimo</label>
          <select id={`${id}-tolerancia`} value={tolerancia} onChange={(e) => setTolerancia(Number(e.target.value))}>
            {TOLERANCIAS.map((t) => (
              <option key={t} value={t}>
                {t === 0 ? "Ninguna: solo el óptimo es a tiempo" : `± ${t} ${t === 1 ? "corte" : "cortes"}`}
              </option>
            ))}
          </select>
          <span className="ayuda">Cuántos cortes de diferencia con el óptimo cuentan como renovación a tiempo.</span>
        </div>
        <div className={s.acciones}>
          <button type="submit" className="boton" disabled={!archivo}>
            Auditar el archivo
          </button>
          <button type="button" className="boton boton-sec" onClick={() => void probarEjemplo()}>
            Probar con el ejemplo
          </button>
        </div>
        <p className={s.descarga}>
          <a href={ruta(EJEMPLO)} download>
            Descargar el CSV de ejemplo
          </a>{" "}
          {/* fuente: public/ejemplos/cosechas_ejemplo.csv (5 lotes, 36 filas) */}
          <span className="apagado">(5 lotes ficticios, para ver el formato)</span>
        </p>
      </form>

      <div className={s.salida}>
        <Respuesta
          fase={errorEjemplo ? "error" : consulta.fase}
          ruta={consulta.ruta && enviado ? `${consulta.ruta} · ${enviado.name}` : consulta.ruta}
          ms={consulta.ms}
          error={errorEjemplo ?? consulta.error}
          vacio="Suba un archivo o pruebe con el ejemplo."
          onReintentar={errorEjemplo ? () => void probarEjemplo() : enviado ? () => enviar(enviado) : undefined}
          titular={d && <TitularAuditoria d={d} />}
        >
          {d && <DetalleAuditoria d={d} perdidasSinCorte={perdidasSinCorte} maxCortes={maxCortes} />}
        </Respuesta>
      </div>
    </div>
  );
}

function TitularAuditoria({ d }: { d: RespuestaAuditoria }) {
  const fuera = d.lotes.filter(fueraDeTiempo).length;
  const vencidos = d.lotes.filter(vencido).length;
  const renovar = d.decisiones.filter((x) => x.decision === "renovar").length;
  const otro = d.decisiones.length - renovar;
  const lotes = (n: number) => `${num(n)} ${n === 1 ? "lote" : "lotes"}`;
  const textoFuera = fuera === 0 ? "ninguno renovó fuera de tiempo" : `${num(fuera)} ${fuera === 1 ? "renovó" : "renovaron"} fuera de tiempo`;
  const textoVencidos = vencidos === 0 ? "" : ` y ${num(vencidos)} ${vencidos === 1 ? "tiene" : "tienen"} el ciclo actual vencido`;
  return (
    <>
      {lotes(d.resumen.lotes)} revisados: {textoFuera}
      {textoVencidos}. De los {lotes(d.decisiones.length)} en pie, conviene renovar {num(renovar)} y dar otro corte a{" "}
      {num(otro)}.
    </>
  );
}

function DetalleAuditoria({ d, perdidasSinCorte, maxCortes }: { d: RespuestaAuditoria; perdidasSinCorte: number; maxCortes: number }) {
  const r = d.resumen;
  const renovar = d.decisiones.filter((x) => x.decision === "renovar").length;
  const estados = Object.entries(r.estados).map(([estado, ciclos]) => ({ estado, ciclos }));
  const recorte = (n: number) => (n > MAX_FILAS ? ` Se muestran ${MAX_FILAS} de ${num(n)}; el resto está en el JSON.` : "");
  const signo = (n: number) => `± ${n}`;
  const sinProyeccion = d.decisiones.some((x) => x.tch_esperado === null);
  const zafras = (c: Ciclo) => (c.zafra_inicio === c.zafra_fin ? `${c.zafra_inicio}` : `${c.zafra_inicio}-${c.zafra_fin}`);
  const dinero = (x: number | null) => (x === null ? "—" : num(x, 2));

  return (
    <>
      <div className={s.pilaCifras}>
        <FilaCifras columnas={2}>
          <Cifra serie="campo" valor={num(r.lotes)} unidad="lotes" etiqueta="Revisados" detalle={`${num(r.registros)} registros de cosecha.`} />
          <Cifra serie="campo" valor={num(r.ciclos)} unidad="ciclos" etiqueta="Reconstruidos" detalle={`${num(r.ciclos_cerrados)} cerrados con una renovación.`} />
        </FilaCifras>
        <FilaCifras columnas={2}>
          <Cifra
            serie="campo"
            valor={d.optimo_cortes}
            unidad="cortes"
            etiqueta="Óptimo usado"
            detalle={`Tolerancia ${signo(d.tolerancia)}. Ciclo de los testigos con los costos de la prueba.`}
          />
          <Cifra serie="campo" valor={num(renovar)} unidad={renovar === 1 ? "lote" : "lotes"} etiqueta="Para renovar" detalle={`De ${num(d.decisiones.length)} lotes en pie.`} />
        </FilaCifras>
      </div>

      {!d.corte_registrado && (
        <p className={s.lineaDato}>
          <strong>El archivo no trae la columna corte.</strong> Sin ella, la auditoría no ve las renovaciones que repiten
          variedad: en la simulación del notebook 05 se perdió el {pctFraccion(perdidasSinCorte, 0)} de las renovaciones.
        </p>
      )}

      <div className={s.celdasEnteras}>
        <Tabla
          titulo="Decisión para cada lote en pie"
          compacta
          columnas={[
            { clave: "finca", titulo: "Finca" },
            { clave: "lote", titulo: "Lote" },
            { clave: "variedad", titulo: "Variedad" },
            { clave: "decision", titulo: "Decisión", valor: (x) => <strong>{x.decision}</strong> },
            { clave: "corte_siguiente", titulo: "Próximo corte", tipo: "num" },
            { clave: "tch_esperado", titulo: "TCH esperado", tipo: "num", valor: (x) => (x.tch_esperado === null ? "—" : num(x.tch_esperado, 2)) },
            { clave: "margen_siguiente", titulo: "Margen del próximo corte", tipo: "num", valor: (x) => dinero(x.margen_siguiente) },
            { clave: "margen_ciclo_nuevo", titulo: "Margen de un ciclo nuevo", tipo: "num", valor: (x) => dinero(x.margen_ciclo_nuevo) },
          ]}
          filas={d.decisiones.slice(0, MAX_FILAS)}
          destacar={(x) => x.decision === "renovar"}
          nota={`TCH en t de caña por hectárea; márgenes en US$ por hectárea al año. Se mantiene la soca mientras el margen esperado del próximo corte supere el margen anual promedio de un ciclo nuevo en ese mismo lote.${sinProyeccion ? ` Desde el corte ${maxCortes} no se proyecta: se recomienda renovar.` : ""}${recorte(d.decisiones.length)}`}
        />
      </div>

      <div className={s.celdasEnteras}>
        <Tabla
          titulo="Diagnóstico por lote"
          compacta
          columnas={[
            { clave: "finca", titulo: "Finca" },
            { clave: "lote", titulo: "Lote" },
            { clave: "diagnostico", titulo: "Diagnóstico", valor: (x) => <strong>{x.diagnostico}</strong> },
            { clave: "renovaciones", titulo: "Renovaciones", tipo: "num" },
            { clave: "tempranas", titulo: "Tempranas", tipo: "num" },
            { clave: "tardias", titulo: "Tardías", tipo: "num" },
            { clave: "estado_actual", titulo: "Ciclo actual" },
            { clave: "cortes_actuales", titulo: "Cortes del ciclo actual", tipo: "num" },
          ]}
          filas={d.lotes.slice(0, MAX_FILAS)}
          destacar={(x) => fueraDeTiempo(x) || vencido(x)}
          nota={`Resaltados: lotes que renuevan antes o después de tiempo, o con el ciclo actual vencido.${recorte(d.lotes.length)}`}
        />
      </div>

      <div className={s.celdasEnteras}>
        <Tabla
          titulo="Ciclos reconstruidos"
          compacta
          columnas={[
            { clave: "finca", titulo: "Finca" },
            { clave: "lote", titulo: "Lote" },
            { clave: "ciclo", titulo: "Ciclo", tipo: "num" },
            { clave: "variedad", titulo: "Variedad" },
            { clave: "estado", titulo: "Estado" },
            { clave: "zafras", titulo: "Zafras", valor: zafras },
            { clave: "cortes_ciclo", titulo: "Cortes", tipo: "num", valor: (x) => `${!x.inicio_observado && !d.corte_registrado ? "≥ " : ""}${x.cortes_ciclo}` },
            { clave: "cerrado", titulo: "Cerrado", valor: (x) => (x.cerrado ? "sí" : "no, en pie") },
          ]}
          filas={d.ciclos.slice(0, MAX_FILAS)}
          destacar={(x) => x.estado === "renovación temprana" || x.estado === "renovación tardía" || x.estado.startsWith("vencido")}
          nota={`Un ciclo nuevo empieza cuando el corte vuelve a 0 o no avanza, o cuando cambia la variedad.${d.corte_registrado ? "" : " Sin columna de corte, también con un hueco de 2 o más zafras; ≥ indica un ciclo que empezó antes de los datos."}${recorte(d.ciclos.length)}`}
        />
      </div>

      <div className={s.celdasEnteras}>
        <Tabla
          titulo="Estado de los ciclos"
          compacta
          columnas={[
            { clave: "estado", titulo: "Estado" },
            { clave: "ciclos", titulo: "Ciclos", tipo: "num", valor: (x) => num(x.ciclos) },
          ]}
          filas={estados}
        />
      </div>
      <RespuestaJson datos={d} />
    </>
  );
}
