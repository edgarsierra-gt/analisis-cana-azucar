import type { Metadata } from "next";
import Link from "next/link";
import { IndiceLocal } from "@/components/IndiceLocal";
import { Desplegable, Nota } from "@/components/Nota";
import { Portada } from "@/components/Portada";
import { Seccion } from "@/components/Seccion";
import resumenP2 from "@/datos/serie1_resumen_p2.json";
import resumenP4 from "@/datos/serie1_resumen_p4.json";
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
    "Calculadoras que consultan la API en vivo: ciclo de renovación según el precio, pronóstico de azúcar, auditoría de lotes, sensor virtual de vapor, verificación de sensores y rango del precio del azúcar.",
};

// Consultas de la API que usan las herramientas de esta página.
const CONSULTAS = [
  "GET /salud", "GET /campo/variedades", "POST /campo/ciclo", "POST /campo/pronostico", "POST /campo/auditoria/csv",
  "POST /caldera/vapor-virtual", "POST /caldera/verificar", "GET /mercado/pronostico",
];

const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// ── Serie I · campo ───────────────────────────────────────────────────────────────────────────────
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

const lista = (xs: number[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : `${xs[0]}`);

export default function Herramientas() {
  return (
    <>
      <Portada
        etiqueta="Herramientas · API en vivo"
        titulo="Los modelos de los notebooks, consultados en vivo"
        entrada={
          <>
            Cada herramienta manda los datos a la API y muestra la respuesta tal cual. La API no vuelve a entrenar: carga los
            JSON que dejaron los notebooks y usa el mismo código, así que responde con las cifras del análisis. No guarda lo
            que recibe.
          </>
        }
        meta={[
          { clave: "API", valor: <code>{API_URL}</code> },
          {
            clave: "Datos de prueba",
            // fuente: README, "Cómo ejecutar" (ensayos de Louisiana 2010-2021)
            valor: `Louisiana 2010-2021 · caldera, ${muestraFecha} · No. 11 al ${fechaCorta(origen)}`,
          },
          { clave: "Documentación", valor: <a href={`${API_URL}/docs`}>OpenAPI de la API</a> },
        ]}
      >
        <EstadoApi />
      </Portada>

      <IndiceLocal
        titulo="Herramientas"
        items={[
          { id: "ciclo", etiqueta: "Ciclo y precio" },
          { id: "pronostico", etiqueta: "Azúcar por acre" },
          { id: "auditoria", etiqueta: "Auditoría de lotes" },
          { id: "caldera", etiqueta: "Caldera" },
          { id: "mercado", etiqueta: "Precio del azúcar" },
        ]}
      />

      <div data-serie="campo">
        <Seccion
          id="ciclo"
          numero="01"
          etiqueta="Campo · pregunta 1"
          titulo="Con precios altos conviene renovar antes; con precios bajos, estirar el ciclo"
          entrada={
            <>
              Para planificar la siembra. Con el precio del azúcar y los costos propios, la API dice cada cuántos cortes renovar
              una variedad, cuánto deja por acre y desde qué precio deja de cubrir costos. En la tabla de precios del notebook
              02 (pasos de {usd(pasoPrecio, 2)}/lb), el testigo promedio pasa a 3 cortes desde {usd(precioCorto, 2)}/lb y a 5 con{" "}
              {usd(precioLargo, 2)}/lb o menos.
            </>
          }
        >
          <CalculadoraCiclo />
          <Desplegable titulo="Cómo lo calcula la API">
            <p>
              Usa las curvas por variedad del notebook 02: azúcar por acre en cada corte, relativo a los testigos núcleo del
              mismo ensayo. Cada corte deja azúcar por precio, menos corte, alce y transporte y menos mantenimiento; la
              plantía carga además la renovación. El margen anual de un ciclo es la suma de sus cortes dividida entre sus
              años, contando los de barbecho. El ciclo óptimo es el de mayor margen anual.
            </p>
            <p>
              Después del último corte medido, la ventaja de la variedad se congela: cae al ritmo de los testigos. La casilla
              de sensibilidad la extiende. El precio de equilibrio es el menor precio con el que el mejor ciclo todavía cubre
              todos los costos; la API lo busca por bisección.
            </p>
            <p>
              La certeza (quedar entre las 3 mejores e IC90 de la ganancia) viene del remuestreo de ensayos del notebook 02
              con los supuestos base. No se recalcula al mover el precio.
            </p>
          </Desplegable>
          <Nota tipo="limite">
            Son curvas de ensayos de Louisiana con los costos de la prueba. Sirven para el método: para el ingenio, las
            curvas saldrán de sus propios ensayos y los costos, de su contabilidad por zona.
          </Nota>
        </Seccion>

        <Seccion
          id="pronostico"
          numero="02"
          etiqueta="Campo · pregunta 2"
          titulo={`El pronóstico sirve con su banda: la de 80 % cubrió el ${pctFraccion(cobertura1, 0)} de los casos`}
          entrada={
            <>
              Para presupuestar la zafra. Da el azúcar por acre esperado de una variedad en una finca y corte, con su banda.
              El modelo ordena razonablemente bien las variedades dentro de un lote (correlación de rangos ρ ={" "}
              {num(rhoOrden, 2)} en el notebook 03), pero el{" "}
              {pctFraccion(resumenP2.parte_error_nivel, 0)} del error es clima y manejo del lote en el año. Recomiendo
              presupuestar con la banda, no con el punto.
            </>
          }
        >
          <PronosticoAzucar />
          <Desplegable titulo="Cómo lo calcula la API">
            <p>
              Es el modelo del notebook 03, en dos piezas: el nivel de la finca y la ventaja de la variedad contra los
              testigos. En logaritmo suma el nivel típico del corte, el efecto de la finca y la ventaja histórica de la
              variedad; si se conoce, también la ventaja de la variedad en el mismo lote el año pasado.
            </p>
            <p>
              Con una finca nueva no hay efecto de finca (escenario 2). La banda es la de 80 % de los errores de la validación
              por zafra: cubrió el {pctFraccion(cobertura1, 0)} en fincas conocidas y el {pctFraccion(cobertura2, 0)} en fincas
              nuevas. Una variedad sin historia en etapa 5 devuelve error: es el escenario 3, que quedó pendiente.
            </p>
          </Desplegable>
          <Nota tipo="limite">
            Cada zafra trae su clima. El modelo orienta el orden de las variedades y el rango; el nivel de un año no se puede
            prometer sin datos de clima y manejo por lote.
          </Nota>
        </Seccion>

        <Seccion
          id="auditoria"
          numero="03"
          etiqueta="Campo · pregunta 4"
          titulo={`Sin el número de corte, la auditoría pierde el ${pctFraccion(auditoria.perdidas_sin_corte, 0)} de las renovaciones`}
          entrada={
            <>
              Para revisar renovaciones con los registros que ya existen. Suba un CSV de cosechas: la API reconstruye los
              ciclos de cada lote, los compara con el óptimo de {resumenP4.optimo} cortes y dice qué hacer con cada lote en pie.
              En la simulación del notebook 05 clasificó bien {num(auditoria.cerrados_bien)} de {num(auditoria.cerrados)}{" "}
              ciclos cerrados.
            </>
          }
        >
          <AuditoriaCsv perdidasSinCorte={auditoria.perdidas_sin_corte} maxCortes={metricos.max_cortes} />
          <Desplegable titulo="Cómo lo calcula la API">
            <p>
              Reconstruye los ciclos: empieza uno nuevo cuando el corte vuelve a 0 o no avanza, o cuando cambia la variedad.
              Sin la columna de corte usa los huecos de 2 o más zafras y no ve las renovaciones que repiten variedad.
            </p>
            <p>
              Compara cada ciclo cerrado con el óptimo de {resumenP4.optimo} cortes de los testigos núcleo, con la tolerancia
              elegida, porque el óptimo es plano. Para cada lote en pie, mantiene la soca mientras el margen esperado del
              próximo corte supere el margen anual de un ciclo nuevo en ese mismo lote. La caída del lote se estima con sus
              propios cortes y se acerca a la caída típica cuando hay pocos.
            </p>
            <p>
              Supuestos de la prueba en unidades métricas: azúcar a {usd(metricos.precio_kg, 3)}/kg, corte, alce y transporte a{" "}
              {usd(metricos.corte_t, 2)}/t de caña, mantenimiento de {usd(metricos.mantenimiento_ha)}/ha/año y renovación de{" "}
              {usd(metricos.renovacion_ha)}/ha.
            </p>
          </Desplegable>
          <Nota tipo="limite">
            El archivo de ejemplo es ficticio: sus fincas dicen EJEMPLO. El óptimo de {resumenP4.optimo} cortes sale de las
            curvas de Louisiana con los costos de la prueba; con costos por zona, cada zona tendrá su propio óptimo.
          </Nota>
        </Seccion>
      </div>

      <div data-serie="caldera">
        <Seccion
          id="caldera"
          numero="04"
          etiqueta="Caldera · preguntas 3 y 4"
          titulo={`El sensor virtual estima el vapor con ${num(ridge.MAE_t_h, 2)} t/h de error sin usar el medidor`}
          entrada={
            <>
              Para respaldar el medidor de vapor y para saber si una alarma es un sensor dañado o un evento del proceso. Usa{" "}
              {minutos.length / 60} horas reales de la caldera: {minutos.length} promedios de 1 min del {muestraFecha}, de{" "}
              {muestraDesde} a {muestraHasta}.
            </>
          }
        >
          <SimuladorCaldera
            minutos={minutos}
            ventana={sensorVirtual.ventana_media_min}
            errorTipico={ridge.MAE_t_h}
            unidades={unidadesChequeo}
            persistencia={verificacion.persistencia_min}
            nChequeos={nChequeos}
          />
          <Desplegable titulo="Cómo lo calculan las consultas">
            <p>
              Sensor virtual: el Ridge final del notebook 08. Usa cada variable en el minuto actual, con rezagos de{" "}
              {lista(rezagos)} min y la media de {sensorVirtual.ventana_media_min} min. La caída de presión domo-colector ya es
              un medidor de flujo; las demás variables afinan. Error típico de {num(ridge.MAE_t_h, 2)} t/h (
              {num(ridge["MAPE_%"], 2)} %) en la validación hacia adelante por día.
            </p>
            <p>
              {/* fuente: serie2_verificacion.json, "descripcion" (referencia: 2 primeros días) */}
              Verificación: {nChequeos} chequeos de redundancia del notebook 09. Cada uno mide su residuo en unidades de su
              escala normal (z), con centro y escala de los 2 primeros días. Hay alarma si |z| pasa su umbral{" "}
              {verificacion.persistencia_min} minutos seguidos. Si alarman dos o más presiones de hogar y nada más, es un evento
              del hogar. Si alarma una sola presión u otro chequeo, es ese sensor.
            </p>
          </Desplegable>
          <Nota tipo="limite">
            {/* fuente: README, Serie IV, "Lo que no está en la API" (el monitor PCA necesita 24 h de historia) */}
            La muestra es de una caldera a carbón. En el ingenio las calderas son de bagazo: se traslada el método, no los
            valores. Las fallas son simuladas sobre datos reales. El monitor de proceso del notebook 09 no está en la API
            porque necesita 24 h de historia.
          </Nota>
        </Seccion>
      </div>

      <div data-serie="mercado">
        <Seccion
          id="mercado"
          numero="05"
          etiqueta="Mercado · pregunta 3"
          titulo="Ningún modelo le ganó al último cierre: lo útil del pronóstico es el rango"
          entrada={
            <>
              Para presupuestar ventas y decidir cuánto fijar. Da el rango del precio No. 11 para el promedio a 1 y 3 meses y
              el ingreso de las toneladas sin fijar. Es el pronóstico con el último cierre de la prueba ({fechaCorta(origen)}),
              no uno de hoy. {/* fuente: notebook 12, evaluación gerencial, decisión 2 */}Cuando la banda se ensancha,
              recomiendo fijar más volumen.
            </>
          }
        >
          <PronosticoPrecio cierres={cierres} coberturas={coberturas} junioParcial={resumenS3P3.junio_real_parcial} />
          <Desplegable titulo="Cómo lo calcula la API">
            <p>
              El centro es el último cierre: en la validación del notebook 12 ningún modelo probado le ganó a 1 ni a 3 meses.
              La banda son los cuantiles de los errores pasados, medidos en unidades de la volatilidad de los últimos 3 meses
              y escalados con la raíz del horizonte. Por eso se ensancha cuando el mercado se agita.
            </p>
            <p>
              {/* fuente: notebook 12, celda 17 */}
              Cada 1 ¢/lb equivale a US$22.05 por tonelada métrica de azúcar crudo.
            </p>
          </Desplegable>
          <Nota tipo="limite">
            Solo precio: el modelo no ve la zafra de Brasil, la política de la India, el real ni el petróleo. Para usarlo hoy
            hay que volver a correr el notebook 12 con datos nuevos.
          </Nota>
        </Seccion>
      </div>

      <div className={`contenedor ${s.cierre}`}>
        <Nota tipo="metodo" titulo="Las consultas que usa esta página">
          <p>
            Estas herramientas usan {CONSULTAS.length} consultas de la API: {CONSULTAS.map((c, i) => (
              <span key={c}>
                <code>{c}</code>
                {i < CONSULTAS.length - 2 ? ", " : i === CONSULTAS.length - 2 ? " y " : ". "}
              </span>
            ))}
            La lista completa, con ejemplos, rangos válidos y pruebas, está en
            la página <Link href="/api">API</Link> y en la <a href={`${API_URL}/docs`}>documentación interactiva</a>.
          </p>
        </Nota>
      </div>
    </>
  );
}
