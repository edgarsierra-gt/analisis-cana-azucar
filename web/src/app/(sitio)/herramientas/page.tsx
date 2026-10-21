import type { Metadata } from "next";
import Link from "next/link";
import type { NivelCerteza } from "@/components/Certeza";
import { Cifra, FilaCifras } from "@/components/Cifra";
import { IndiceLocal } from "@/components/IndiceLocal";
import { Portada } from "@/components/Portada";
import { Seccion } from "@/components/Seccion";
import certeza from "@/datos/serie1_certeza.json";
import curvas from "@/datos/serie1_curvas.json";
import resumenP2 from "@/datos/serie1_resumen_p2.json";
import resumenP4 from "@/datos/serie1_resumen_p4.json";
import resumenQ1 from "@/datos/serie1_resumen_q1.json";
import sensibilidad from "@/datos/serie1_sensibilidad_precio.json";
import muestraVapor from "@/datos/serie2_muestra_api_vapor.json";
import resumenS2P3 from "@/datos/serie2_resumen_p3.json";
import resumenS2P4 from "@/datos/serie2_resumen_p4.json";
import sensorVirtual from "@/datos/serie2_sensor_virtual.json";
import verificacion from "@/datos/serie2_verificacion.json";
import precioDiario from "@/datos/serie3_precio_diario.json";
import pronosticoMercado from "@/datos/serie3_pronostico.json";
import resumenS3P3 from "@/datos/serie3_resumen_p3.json";
import { API_URL } from "@/lib/api";
import { num, pctFraccion, usd } from "@/lib/formato";
import { AuditoriaCsv } from "./_herramientas/AuditoriaCsv";
import { CalculadoraCiclo } from "./_herramientas/CalculadoraCiclo";
import { EstadoApi } from "./_herramientas/EstadoApi";
import { PronosticoAzucar } from "./_herramientas/PronosticoAzucar";
import { PronosticoPrecio, type Cierre } from "./_herramientas/PronosticoPrecio";
import { SimuladorCaldera, type MinutoMuestra } from "./_herramientas/SimuladorCaldera";
import s from "./_herramientas/herramientas.module.css";

export const metadata: Metadata = {
  title: "Herramientas",
  description:
    "Pruebe cada recomendación con otros números: calculadoras que consultan en vivo la API del análisis. Ciclo de renovación según el precio, lotes a renovar, azúcar por acre con su banda, vapor sin el medidor, verificación de sensores y rango del precio del azúcar.",
};

// Consultas de la API que usan las herramientas de esta página.
const CONSULTAS = [
  "GET /salud", "GET /campo/variedades", "POST /campo/ciclo", "POST /campo/pronostico", "POST /campo/auditoria/csv",
  "POST /caldera/vapor-virtual", "POST /caldera/verificar", "GET /mercado/pronostico",
];

const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// ── Serie I · campo ───────────────────────────────────────────────────────────────────────────────
// Ciclo y margen del testigo promedio con los supuestos de la prueba (notebook 02).
const referencia = resumenQ1.referencia;
const precioPrueba = curvas.supuestos.precio;
const cobertura1 = resumenP2.cobertura["Escenario 1"]["cobertura banda 80 %"];
const cobertura2 = resumenP2.cobertura["Escenario 2"]["cobertura banda 80 %"];
const auditoria = resumenP4.auditoria;
const metricos = resumenP4.supuestos_metricos;
// Precio desde el que el testigo promedio conviene renovar con 3 cortes, y hasta el que conviene estirar a 5 (notebook 02).
const precioCorto = Math.min(...sensibilidad.filter((f) => f.ciclo_referencia <= 3).map((f) => f.precio));
const precioLargo = Math.max(...sensibilidad.filter((f) => f.ciclo_referencia >= 5).map((f) => f.precio));
const pasoPrecio = Math.round((sensibilidad[1].precio - sensibilidad[0].precio) * 100) / 100;
// Correlación de rangos dentro del lote del modelo final (Ridge, escenario 1), notebook 03.
const rhoOrden = resumenP2.metricas_e1.Ridge.orden_spearman;
// Certeza de quedar entre las 3 mejores, por variedad (remuestreo de ensayos del notebook 02).
const nivelesCerteza: Record<string, NivelCerteza> = Object.fromEntries(
  certeza.map((c) => [c.CLONE, c.nivel_certeza_top3 as NivelCerteza]),
);

// ── Serie II · caldera ────────────────────────────────────────────────────────────────────────────
// Solo los valores de los sensores; la predicción del notebook y √(ΔP·ρ) no se mandan a la API.
const NO_SON_SENSORES = new Set(["date", "pred_ridge", "raiz_dp_rho"]);
const minutos: MinutoMuestra[] = muestraVapor.map((fila) => ({
  hora: `${fila.date.replace(" ", "T")}Z`,
  valores: Object.fromEntries(
    Object.entries(fila).filter((e): e is [string, number] => !NO_SON_SENSORES.has(e[0]) && typeof e[1] === "number"),
  ),
}));
const ridge = resumenS2P3.metricas["Ridge completo"];
const unidadesChequeo = Object.fromEntries(Object.entries(resumenS2P4.sensibilidad).map(([k, v]) => [k, v.unidad]));
const nChequeos = Object.keys(verificacion.umbrales_z).length;
const rezagos = sensorVirtual.rezagos_min.filter((r) => r > 0);
const muestraFecha = fechaCorta(muestraVapor[0].date);
const muestraDesde = muestraVapor[0].date.slice(11, 16);
const muestraHasta = muestraVapor[muestraVapor.length - 1].date.slice(11, 16);

// ── Serie III · mercado ───────────────────────────────────────────────────────────────────────────
const origen = pronosticoMercado.fecha_origen;
const o = new Date(origen);
// Seis meses de cierres antes del último cierre de la prueba, y los que llegaron después (solo para comparar).
const desde = new Date(Date.UTC(o.getUTCFullYear(), o.getUTCMonth() - 5, 1)).toISOString().slice(0, 10);
const cierres: Cierre[] = precioDiario.filter((f) => f.fecha >= desde).map((f) => ({ fecha: f.fecha, cierre: f.cierre }));
const bandas = resumenS3P3.bandas;
const coberturas = {
  "1": { "80": bandas["1|según volatilidad"]["80 %"]["cobertura (%)"], "95": bandas["1|según volatilidad"]["95 %"]["cobertura (%)"] },
  "3": { "80": bandas["3|según volatilidad"]["80 %"]["cobertura (%)"], "95": bandas["3|según volatilidad"]["95 %"]["cobertura (%)"] },
};
// Banda de 80 % del promedio del mes siguiente, con la misma fórmula que la API (api/mercado.py):
// precio = último cierre · exp(z · volatilidad de 3 meses · √h), con h = 1.
const q1 = pronosticoMercado.cuantiles_z["1"];
const bandaMes: [number, number] = [q1.p10, q1.p90].map(
  (z) => pronosticoMercado.ultimo_cierre * Math.exp(z * pronosticoMercado.vol_3m_mensual),
) as [number, number];
const mesSiguiente = new Date(Date.UTC(o.getUTCFullYear(), o.getUTCMonth() + 1, 1));
const nombreMes = MESES[mesSiguiente.getUTCMonth()];
const mesObjetivo = `${nombreMes} de ${mesSiguiente.getUTCFullYear()}`;
// Promedio real del mes objetivo hasta el último cierre que llegó después (notebook 12).
const realParcial = resumenS3P3.junio_real_parcial;
const diaParcial = Number(cierres[cierres.length - 1].fecha.slice(8, 10));
const realDentro = realParcial >= bandaMes[0] && realParcial <= bandaMes[1];

const lista = (xs: number[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : `${xs[0]}`);

// Las cinco decisiones de la portada, cada una con la cifra del análisis que la respalda y su herramienta.
const DECISIONES = [
  {
    id: "ciclo", serie: "campo", cifra: `${referencia.ciclo} cortes`, nombre: "Cuándo renovar",
    detalle: `El testigo, con ${usd(precioPrueba, 2)}/lb. Desde ${usd(precioCorto, 2)}/lb, cada 3 cortes.`,
  },
  {
    id: "auditoria", serie: "campo", cifra: `${num(auditoria.cerrados_bien)} de ${num(auditoria.cerrados)}`,
    nombre: "Qué lotes renovar ya", detalle: `Ciclos bien clasificados en una simulación de ${num(auditoria.lotes)} lotes.`,
  },
  {
    id: "pronostico", serie: "campo", cifra: pctFraccion(cobertura1, 0), nombre: "Cuánto azúcar esperar",
    detalle: "De los casos en fincas conocidas, el azúcar real cayó en la banda de 80 %.",
  },
  {
    id: "caldera", serie: "caldera", cifra: `${num(ridge.MAE_t_h, 2)} t/h`, nombre: "Vapor sin el medidor",
    detalle: "Error típico del sensor virtual.",
  },
  {
    id: "mercado", serie: "mercado", cifra: `${num(bandaMes[0], 2)} a ${num(bandaMes[1], 2)} ¢/lb`,
    nombre: "El rango del precio", detalle: `Banda de 80 % para ${mesObjetivo}.`,
  },
];

/** "Cómo lo sé" y el límite de una herramienta, en dos columnas, con los enlaces a su análisis y a su consulta. */
function Contexto({
  comoLoSe, enlaces, limite,
}: { comoLoSe: React.ReactNode; enlaces: React.ReactNode; limite: React.ReactNode }) {
  return (
    <div className={`columnas ${s.contexto}`}>
      <div>
        <h3>Cómo lo sé</h3>
        <p>{comoLoSe}</p>
        <p className={s.enlaces}>{enlaces}</p>
      </div>
      <div>
        <h3>Límite</h3>
        <p>{limite}</p>
      </div>
    </div>
  );
}

export default function Herramientas() {
  return (
    <>
      <Portada
        titulo="Pruebe cada recomendación en vivo"
        entrada={
          <>
            Cambie el precio, la finca o el minuto de la caldera: la API responde en vivo con el mismo modelo y las cifras
            del análisis.
          </>
        }
        acciones={
          <>
            <a className="boton" href="#ciclo">
              Calcular el ciclo de renovación
            </a>
            <Link href="/api">Cómo está hecha la API</Link>
          </>
        }
        meta={[
          {
            clave: "Datos de prueba",
            // fuente: README, "Cómo ejecutar" (ensayos de Louisiana 2010-2021)
            // Espacio duro en "No. 11": el nombre del contrato no se parte entre dos renglones.
            valor: `Louisiana 2010-2021 · caldera, ${muestraFecha} · No. 11 al ${fechaCorta(origen)}`,
          },
          { clave: "Documentación", valor: <a href={`${API_URL}/docs`}>OpenAPI de la API</a> },
        ]}
        pieza={<EstadoApi />}
        piezaPanel={false}
      >
        <ul className={s.resumen} aria-label="Lo que responde cada herramienta">
          {DECISIONES.map((x) => (
            <li key={x.id} data-serie={x.serie}>
              <a href={`#${x.id}`}>
                <span className={s.resumenCifra}>{x.cifra}</span>
                <span className={s.resumenNombre}>{x.nombre}</span>
                <span className={s.resumenDetalle}>{x.detalle}</span>
              </a>
            </li>
          ))}
        </ul>
      </Portada>

      <IndiceLocal
        titulo="Herramientas"
        items={[
          { id: "ciclo", etiqueta: "Ciclo y precio" },
          { id: "auditoria", etiqueta: "Auditoría de lotes" },
          { id: "pronostico", etiqueta: "Azúcar por acre" },
          { id: "caldera", etiqueta: "Caldera" },
          { id: "mercado", etiqueta: "Precio del azúcar" },
          { id: "como-responde", etiqueta: "Cómo responde" },
        ]}
      />

      <div data-serie="campo">
        <Seccion
          id="ciclo"
          titulo="A mayor precio, conviene renovar antes"
          entrada={
            <>
              Para planificar la siembra: con su precio y sus costos, la API dice cada cuántos cortes renovar y desde qué
              precio deja de cubrir costos.
            </>
          }
          cifras={
            <FilaCifras columnas={2}>
              <Cifra
                valor={num(precioCorto, 2)}
                unidad="US$/lb"
                etiqueta="Desde este precio, el testigo renueva cada 3 cortes"
                detalle={`Con ${usd(precioPrueba, 2)}/lb renueva cada ${referencia.ciclo} y deja ${usd(referencia.margen, 1)} por acre al año.`}
              />
              <Cifra
                valor={num(precioLargo, 2)}
                unidad="US$/lb"
                etiqueta="Con este precio o menos, estira a 5 cortes"
                detalle={`Tabla de precios del notebook 02, en pasos de ${usd(pasoPrecio, 2)}/lb.`}
              />
            </FilaCifras>
          }
        >
          <CalculadoraCiclo
            certezas={nivelesCerteza}
            umbrales={{ corto: precioCorto, largo: precioLargo }}
            contexto={
              <Contexto
                comoLoSe={
                  <>
                    {/* fuente: README, "Calidad y verificación" y "Pruebas" (tests/test_api.py) */}
                    La API no reentrena: lee las curvas que dejó el notebook 02. Ese notebook comprueba que el archivo
                    reproduce el ciclo y el margen de cada variedad, con diferencia 0. Las pruebas de la API repiten el
                    margen de referencia, {usd(referencia.margen, 1)} por acre al año, y las {resumenQ1.n_elegibles}{" "}
                    variedades.
                  </>
                }
                enlaces={
                  <>
                    <Link href="/campo#variedades">El análisis, en Campo</Link> ·{" "}
                    <Link href="/api#grupo-campo">
                      La consulta <code>POST /campo/ciclo</code>
                    </Link>
                  </>
                }
                limite={
                  <>
                    Son curvas de ensayos de Louisiana con los costos de la prueba. Sirven para el método: para el ingenio,
                    las curvas saldrán de sus propios ensayos y los costos, de su contabilidad por zona.
                  </>
                }
              />
            }
            metodo={
              <>
                <p>
                  Usa las curvas por variedad del notebook 02: azúcar por acre en cada corte, relativo a los testigos
                  núcleo del mismo ensayo. Cada corte deja azúcar por precio, menos corte, alce y transporte y menos
                  mantenimiento; la plantía carga además la renovación. El margen anual de un ciclo es la suma de sus
                  cortes dividida entre sus años, contando los de barbecho. El ciclo óptimo es el de mayor margen anual.
                </p>
                <p>
                  Después del último corte medido, la ventaja de la variedad se congela: cae al ritmo de los testigos. La
                  casilla de sensibilidad la extiende. El precio de equilibrio es el menor precio con el que el mejor ciclo
                  todavía cubre todos los costos; la API lo busca por bisección.
                </p>
                <p>
                  La certeza (quedar entre las 3 mejores y el intervalo de 90 % de la ganancia) viene del remuestreo de
                  ensayos del notebook 02 con los supuestos base. No se recalcula al mover el precio.
                </p>
              </>
            }
          />
        </Seccion>

        <Seccion
          id="auditoria"
          titulo="Los registros de cosecha ya dicen qué renovar"
          entrada={
            <>
              Suba un CSV de cosechas: la API reconstruye los ciclos de cada lote, los compara con el óptimo de{" "}
              {resumenP4.optimo} cortes y dice qué renovar.
            </>
          }
          cifras={
            <FilaCifras columnas={2}>
              <Cifra
                valor={num(auditoria.cerrados_bien)}
                unidad={`de ${num(auditoria.cerrados)}`}
                etiqueta="Ciclos bien clasificados en la simulación"
                detalle={`Portafolio simulado de ${num(auditoria.lotes)} lotes, con número de corte (notebook 05).`}
              />
              <Cifra
                valor={num(auditoria.perdidas_sin_corte * 100, 0)}
                unidad="%"
                etiqueta="De las renovaciones se pierde sin el número de corte"
                detalle="No se ven las que repiten variedad."
              />
            </FilaCifras>
          }
        >
          <AuditoriaCsv
            perdidasSinCorte={auditoria.perdidas_sin_corte}
            maxCortes={metricos.max_cortes}
            contexto={
              <Contexto
                comoLoSe={
                  <>
                    {/* fuente: README, "Pruebas" (tests/test_api.py) y "Decisiones técnicas" (Base de datos) */}
                    Las pruebas de la API repiten los {num(auditoria.cerrados_bien)} de {num(auditoria.cerrados)} ciclos
                    del portafolio simulado del notebook 05. Con los registros leídos desde PostgreSQL 16, la auditoría da
                    los mismos estados que con pandas.
                  </>
                }
                enlaces={
                  <>
                    <Link href="/campo#datos-propios">El análisis, en Campo</Link> ·{" "}
                    <Link href="/api#grupo-campo">
                      La consulta <code>POST /campo/auditoria/csv</code>
                    </Link>
                  </>
                }
                limite={
                  <>
                    El archivo de ejemplo es ficticio: sus fincas dicen EJEMPLO. El óptimo de {resumenP4.optimo} cortes sale
                    de las curvas de Louisiana con los costos de la prueba; con costos por zona, cada zona tendrá su propio
                    óptimo.
                  </>
                }
              />
            }
            metodo={
              <>
                <p>
                  Reconstruye los ciclos: empieza uno nuevo cuando el corte vuelve a 0 o no avanza, o cuando cambia la
                  variedad. Sin la columna de corte usa los huecos de 2 o más zafras y no ve las renovaciones que repiten
                  variedad.
                </p>
                <p>
                  Compara cada ciclo cerrado con el óptimo de {resumenP4.optimo} cortes de los testigos núcleo, con la
                  tolerancia elegida, porque el óptimo es plano. Para cada lote en pie, mantiene la soca mientras el margen
                  esperado del próximo corte supere el margen anual de un ciclo nuevo en ese mismo lote. La caída del lote
                  se estima con sus propios cortes y se acerca a la caída típica cuando hay pocos.
                </p>
                <p>
                  Supuestos de la prueba en unidades métricas: azúcar a {usd(metricos.precio_kg, 3)}/kg, corte, alce y
                  transporte a {usd(metricos.corte_t, 2)}/t de caña, mantenimiento de {usd(metricos.mantenimiento_ha)}/ha/año
                  y renovación de {usd(metricos.renovacion_ha)}/ha.
                </p>
              </>
            }
          />
        </Seccion>

        <Seccion
          id="pronostico"
          titulo="El pronóstico de azúcar sirve con su banda"
          entrada={
            <>
              Para presupuestar la zafra: da el azúcar esperado por acre de una variedad, finca y corte. Recomiendo
              presupuestar con la banda, no con el punto.
            </>
          }
          cifras={
            <FilaCifras columnas={2}>
              <Cifra
                valor={num(resumenP2.parte_error_nivel * 100, 0)}
                unidad="%"
                etiqueta="Del error es clima y manejo del lote en el año"
                detalle="Por eso el punto solo no basta para presupuestar."
              />
              <Cifra
                valor={num(rhoOrden, 2)}
                etiqueta="Qué tan bien ordena las variedades en un lote"
                detalle="Correlación de rangos (ρ): 1 es el orden real exacto y 0, al azar. Las ordena razonablemente bien (notebook 03)."
              />
            </FilaCifras>
          }
        >
          <PronosticoAzucar
            contexto={
              <Contexto
                comoLoSe={
                  <>
                    {/* fuente: README, "Calidad y verificación" (509 predicciones, diferencia ≤ 0.7 lb/acre) */}
                    El modelo guardado reproduce las 509 predicciones de 2022 del notebook 03, con diferencias de 0.7 lb/acre
                    o menos, y las pruebas de la API las repiten. La banda de 80 % cubrió el{" "}
                    {pctFraccion(cobertura1, 0)} de los casos en fincas conocidas y el {pctFraccion(cobertura2, 0)} en
                    fincas nuevas.
                  </>
                }
                enlaces={
                  <>
                    <Link href="/campo#pronostico">El análisis, en Campo</Link> ·{" "}
                    <Link href="/api#grupo-campo">
                      La consulta <code>POST /campo/pronostico</code>
                    </Link>
                  </>
                }
                limite={
                  <>
                    Cada zafra trae su clima. El modelo orienta el orden de las variedades y el rango; el nivel de un año no
                    se puede prometer sin datos de clima y manejo por lote.
                  </>
                }
              />
            }
            metodo={
              <>
                <p>
                  Es el modelo del notebook 03, en dos piezas: el nivel de la finca y la ventaja de la variedad contra los
                  testigos. En logaritmo suma el nivel típico del corte, el efecto de la finca y la ventaja histórica de la
                  variedad; si se conoce, también la ventaja de la variedad en el mismo lote el año pasado.
                </p>
                <p>
                  Con una finca nueva no hay efecto de finca (escenario 2). La banda es la de 80 % de los errores de la
                  validación por zafra: cubrió el {pctFraccion(cobertura1, 0)} en fincas conocidas y el{" "}
                  {pctFraccion(cobertura2, 0)} en fincas nuevas. Una variedad sin historia en etapa 5 devuelve error: es el
                  escenario 3, que quedó pendiente.
                </p>
              </>
            }
          />
        </Seccion>
      </div>

      <div data-serie="caldera">
        <Seccion
          id="caldera"
          titulo={`El vapor se estima con ${num(ridge.MAE_t_h, 2)} t/h de error`}
          entrada={
            <>
              Respalda el medidor de vapor sin usarlo y separa un sensor dañado de un evento del proceso. Usa{" "}
              {minutos.length / 60} horas reales de la caldera.
            </>
          }
          cifras={
            <FilaCifras columnas={2}>
              <Cifra
                valor={num(ridge.MAE_t_h, 2)}
                unidad="t/h"
                etiqueta="Error típico del sensor virtual"
                detalle={`${num(ridge["MAPE_%"], 2)} % del vapor, en la validación hacia adelante por día (notebook 08).`}
              />
              <Cifra
                valor={nChequeos}
                unidad="chequeos"
                etiqueta="De redundancia para separar sensor y proceso"
                detalle={`Alarma tras ${verificacion.persistencia_min} minutos seguidos fuera de umbral (notebook 09).`}
              />
            </FilaCifras>
          }
        >
          <SimuladorCaldera
            minutos={minutos}
            ventana={sensorVirtual.ventana_media_min}
            errorTipico={ridge.MAE_t_h}
            unidades={unidadesChequeo}
            persistencia={verificacion.persistencia_min}
            nChequeos={nChequeos}
            contexto={
              <Contexto
                comoLoSe={
                  <>
                    {/* fuente: README, "Pruebas" (tests/test_api_caldera_mercado.py) */}
                    Las pruebas de la API comprueban el sensor virtual en 171 minutos, los {nChequeos} chequeos igual que
                    el código del notebook 09 y el diagnóstico con estas mismas fallas inyectadas. La muestra son{" "}
                    {minutos.length} promedios de 1 min del {muestraFecha}, de {muestraDesde} a {muestraHasta}.
                  </>
                }
                enlaces={
                  <>
                    <Link href="/caldera#vapor">El sensor virtual, en Caldera</Link> ·{" "}
                    <Link href="/caldera#anomalias">las anomalías</Link> ·{" "}
                    <Link href="/api#grupo-caldera">las consultas de la caldera</Link>
                  </>
                }
                limite={
                  <>
                    {/* fuente: README, Serie IV, "Lo que no está en la API" (el monitor PCA necesita 24 h de historia) */}
                    La muestra es de una caldera a carbón. En el ingenio las calderas son de bagazo: se traslada el método,
                    no los valores. Las fallas son simuladas sobre datos reales. El monitor de proceso del notebook 09 no
                    está en la API porque necesita 24 h de historia.
                  </>
                }
              />
            }
            metodo={
              <>
                <p>
                  Sensor virtual: el Ridge final del notebook 08. Usa cada variable en el minuto actual, con rezagos de{" "}
                  {lista(rezagos)} min y la media de {sensorVirtual.ventana_media_min} min. La caída de presión
                  domo-colector ya es un medidor de flujo; las demás variables afinan. Error típico de{" "}
                  {num(ridge.MAE_t_h, 2)} t/h ({num(ridge["MAPE_%"], 2)} %) en la validación hacia adelante por día.
                </p>
                <p>
                  {/* fuente: serie2_verificacion.json, "descripcion" (referencia: 2 primeros días) */}
                  Verificación: {nChequeos} chequeos de redundancia del notebook 09. Cada uno mide su residuo en unidades de
                  su escala normal (z), con centro y escala de los 2 primeros días. Hay alarma si |z| pasa su umbral{" "}
                  {verificacion.persistencia_min} minutos seguidos. Si alarman dos o más presiones de hogar y nada más, es
                  un evento del hogar. Si alarma una sola presión u otro chequeo, es ese sensor.
                </p>
              </>
            }
          />
        </Seccion>
      </div>

      <div data-serie="mercado">
        <Seccion
          id="mercado"
          titulo="Ningún modelo le ganó al último cierre"
          entrada={
            <>
              Por eso lo útil del pronóstico es el rango, para presupuestar ventas.{" "}
              {/* fuente: notebook 12, evaluación gerencial, decisión 2 */}Cuando la banda se ensancha, recomiendo fijar
              más volumen.
            </>
          }
          cifras={
            <FilaCifras columnas={2}>
              <Cifra
                valor={num(coberturas["1"]["80"], 1)}
                unidad="%"
                etiqueta="Cobertura de la banda de 80 % a 1 mes"
                detalle="De los meses, en la validación hacia adelante del notebook 12."
              />
              <Cifra
                valor={num(realParcial, 2)}
                unidad="¢/lb"
                etiqueta={`Promedio real de ${nombreMes} hasta el día ${diaParcial}`}
                detalle={`Quedó ${realDentro ? "dentro" : "fuera"} de la banda de 80 %: ${num(bandaMes[0], 2)} a ${num(bandaMes[1], 2)} ¢/lb.`}
              />
            </FilaCifras>
          }
        >
          <PronosticoPrecio
            cierres={cierres}
            coberturas={coberturas}
            junioParcial={realParcial}
            contexto={
              <Contexto
                comoLoSe={
                  <>
                    {/* fuente: README, "Pruebas" (tests/test_api_caldera_mercado.py: las bandas del notebook 12) */}
                    La API no estima nada nuevo: aplica los cuantiles de error que guardó el notebook 12 a la volatilidad de
                    los últimos 3 meses, y las pruebas comprueban que sus bandas son las del notebook. Cada 1 ¢/lb equivale
                    a US$22.05 por tonelada métrica de azúcar crudo. {/* fuente: notebook 12, celda 17 */}
                  </>
                }
                enlaces={
                  <>
                    <Link href="/mercado#pronostico">El análisis, en Mercado</Link> ·{" "}
                    <Link href="/api#grupo-mercado">
                      La consulta <code>GET /mercado/pronostico</code>
                    </Link>
                  </>
                }
                limite={
                  <>
                    Es el pronóstico con el último cierre de la prueba ({fechaCorta(origen)}), no uno de hoy. Solo precio: el
                    modelo no ve la zafra de Brasil, la política de la India, el real ni el petróleo. Para usarlo hoy hay que
                    volver a correr el notebook 12 con datos nuevos.
                  </>
                }
              />
            }
            metodo={
              <p>
                El centro es el último cierre: en la validación del notebook 12 ningún modelo probado le ganó a 1 ni a 3
                meses. La banda son los cuantiles de los errores pasados, medidos en unidades de la volatilidad de los
                últimos 3 meses y escalados con la raíz del horizonte. Por eso se ensancha cuando el mercado se agita.
              </p>
            }
          />
        </Seccion>
      </div>

      <Seccion
        id="como-responde"
        titulo="Todo cálculo sale de la API, no del sitio"
        entrada={
          <>
            Cada herramienta manda los datos y muestra la respuesta tal cual. La API no reentrena ni guarda lo que recibe:
            carga los JSON de los notebooks.
          </>
        }
        cifras={
          <FilaCifras columnas={2}>
            <Cifra
              valor={CONSULTAS.length}
              unidad="de 14 consultas" // fuente: README, "Resumen" (API con 14 consultas)
              etiqueta="Usa esta página"
              detalle="La lista completa, con ejemplos y rangos válidos, está en la página API."
            />
            <Cifra
              valor={120}
              unidad="pruebas" // fuente: README, "Pruebas" (outputs/tests/pytest_docker.txt)
              etiqueta="Aprobadas dentro de Docker"
              detalle="115 de la API y 5 del esquema SQL, con PostgreSQL 16."
            />
          </FilaCifras>
        }
      >
        <div className="columnas">
          <div>
            <h3>Las consultas de esta página</h3>
            <ul className={s.consultas}>
              {CONSULTAS.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Dónde corre</h3>
            <p>
              Este sitio consulta la API en <code>{API_URL}</code>. Usa el mismo código y los mismos JSON que los
              notebooks, así que responde con las cifras del análisis.
            </p>
            <p>
              <a href={`${API_URL}/docs`}>Documentación interactiva (OpenAPI)</a>
            </p>
          </div>
          <div>
            <h3>Cómo correrla en una computadora</h3>
            <p>
              Con Docker Desktop abierto, desde la raíz del repositorio: <code>docker compose up --build</code>. La API queda
              en <code>http://localhost:8000</code>.
            </p>
            <p>
              <Link href="/api">Cómo está hecha la API y cómo se prueba</Link>
            </p>
          </div>
        </div>
      </Seccion>
    </>
  );
}
