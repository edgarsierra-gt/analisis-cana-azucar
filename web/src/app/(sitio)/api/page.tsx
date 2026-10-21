import type { Metadata } from "next";
import Link from "next/link";
import { Cifra, FilaCifras } from "@/components/Cifra";
import { Evaluacion } from "@/components/Evaluacion";
import { Figura } from "@/components/Figura";
import { IndiceLocal } from "@/components/IndiceLocal";
import { Desplegable, Nota } from "@/components/Nota";
import { CifraPortada, Portada } from "@/components/Portada";
import { Seccion } from "@/components/Seccion";
import { Tabla } from "@/components/Tabla";
import pronostico2022Lotes from "@/datos/serie1_pronostico_2022_lotes.json";
import pronostico2022Plantia from "@/datos/serie1_pronostico_2022_plantia.json";
import resumenP4 from "@/datos/serie1_resumen_p4.json";
import resumenQ1 from "@/datos/serie1_resumen_q1.json";
import segmentos from "@/datos/serie1_segmentos.json";
import muestraModos from "@/datos/serie2_muestra_api_modos.json";
import muestraVapor from "@/datos/serie2_muestra_api_vapor.json";
import sensores from "@/datos/serie2_sensores.json";
import pronosticoPrecio from "@/datos/serie3_pronostico.json";
import { API_URL } from "@/lib/api";
import { archivoRepo } from "@/lib/base";
import { conSigno, num, pctFraccion, usd } from "@/lib/formato";
import { ANALISIS, conteos, GRUPOS, TOTAL_CONSULTAS, VERSION_API } from "./_componentes/consultas";
import { DiagramaFlujo, type ArchivosJson } from "./_componentes/DiagramaFlujo";
import { EstadoApi } from "./_componentes/EstadoApi";
import { Codigo, ListaConsultas } from "./_componentes/ListaConsultas";
import s from "./_componentes/Pagina.module.css";
// Captura real de /docs (Swagger UI de FastAPI) de la API 1.2.0 en Docker, recortada a los grupos General y Campo
import capturaDocs from "./_componentes/documentacion-interactiva.webp";

export const metadata: Metadata = {
  title: "API",
  description:
    "La API de la Serie IV: qué responde de campo, caldera y mercado, cómo funciona, qué decidí y por qué, cómo se usa y cómo se comprobó que repite las cifras de los notebooks.",
};

// ── Cifras que salen de los JSON ──────────────────────────────────────────────────────────────────────────────────
const lotes2022 = pronostico2022Lotes.length;
const variedadesPlantia = Object.keys(pronostico2022Plantia[0]).filter((k) => k !== "LOC" && k !== "testigo promedio").length;
const plantias2022 = pronostico2022Plantia.length * variedadesPlantia;
const predicciones2022 = lotes2022 + plantias2022;
const auditoria = resumenP4.auditoria;
const sinCorte = Math.round(auditoria.cerrados * (1 - auditoria.perdidas_sin_corte));
const ventanasModo = muestraModos.length;
const minutosVerificacion = muestraVapor.length;
const minutosVapor = muestraVapor.length - (conteos.ventanaVapor - 1);
const asignaciones = segmentos.length;
const margenReferencia = resumenQ1.referencia.margen;
// Preguntas distintas que responde la API, contadas desde la lista de consultas
const preguntasDe = (clave: string) =>
  new Set(GRUPOS.filter((g) => g.clave === clave).flatMap((g) => g.consultas.map((c) => c.pregunta).filter(Boolean))).size;
const preguntasCampo = preguntasDe("campo");
const preguntasCaldera = preguntasDe("caldera");
const preguntasMercado = preguntasDe("mercado");
const preguntasTotal = preguntasCampo + preguntasCaldera + preguntasMercado;
// Consultas que se ven en la captura de la documentación: los grupos General y Campo
const enCaptura = GRUPOS.filter((g) => g.clave === "general" || g.clave === "campo").reduce((n, g) => n + g.consultas.length, 0);

// Banda de 80 % del precio en % del último cierre: exp(z · vol_3m · √h) − 1, como api/mercado.py (notebook 12)
const banda80 = (h: 1 | 3) => {
  const q = pronosticoPrecio.cuantiles_z[h === 1 ? "1" : "3"];
  const pct = (z: number) => `${conSigno(100 * (Math.exp(z * pronosticoPrecio.vol_3m_mensual * Math.sqrt(h)) - 1))} %`;
  return `de ${pct(q.p10)} a ${pct(q.p90)}`;
};

// Los 8 JSON que carga la API (api/servicios.py, api/caldera.py, api/mercado.py)
const ARCHIVOS: ArchivosJson = [
  { serie: "campo", nombre: "Campo", archivos: ["serie1_curvas", "serie1_modelo_p2", "serie1_segmentos"] },
  { serie: "caldera", nombre: "Caldera", archivos: ["serie2_sensores", "serie2_modos", "serie2_sensor_virtual", "serie2_verificacion"] },
  { serie: "mercado", nombre: "Mercado", archivos: ["serie3_pronostico"] },
];

const Ruta = ({ children }: { children: string }) => <code className={s.ruta}>{children}</code>;

type Fila = Record<string, unknown>;

const USOS: Fila[] = [
  { uso: "Planificar la siembra", ejemplo: "Antes de la siembra, consultar el ranking y simular el margen con el precio del azúcar del momento.", consulta: ["GET /campo/variedades", "POST /campo/ciclo"] },
  { uso: "Presupuestar la zafra", ejemplo: "Estimar el azúcar por acre de cada variedad en cada finca, con una banda de error que dice su cobertura real.", consulta: ["POST /campo/pronostico"] },
  { uso: "Clasificar una variedad nueva", ejemplo: "Con sus 4 indicadores contra los testigos, ver a qué grupo se parece.", consulta: ["POST /campo/segmento"] },
  { uso: "Auditar renovaciones", ejemplo: "Subir el CSV de cosechas y ver qué lotes se renovaron antes o después de tiempo, y qué hacer con los lotes en pie.", consulta: ["POST /campo/auditoria/csv"] },
  { uso: "Respaldar el medidor de vapor", ejemplo: "Si el medidor falla o se sospecha de él, estimar el vapor con los demás sensores.", consulta: ["POST /caldera/vapor-virtual"] },
  { uso: "Separar sensor de proceso", ejemplo: "Mandar los últimos minutos y saber si un instrumento se separó de sus pares o si es un evento del hogar.", consulta: ["POST /caldera/verificar"] },
  { uso: "Presupuestar ventas", ejemplo: "Ver el rango de precio a 1 y 3 meses y el rango de ingreso de las toneladas sin fijar.", consulta: ["GET /mercado/pronostico"] },
  {
    uso: "Alimentar otras herramientas",
    ejemplo: <>Las <Link href="/herramientas">herramientas</Link> y el <Link href="/asistente">asistente</Link> de este sitio consultan esta misma API y no repiten cálculos. Un flujo automático puede hacer lo mismo.</>,
    consulta: [],
  },
];

// Decisiones de la Serie IV con lo que descarté: todo sale de bitacora.md, sección "Serie IV · API en producción".
// "—" donde la bitácora no registra una alternativa descartada.
const DECISIONES: Fila[] = [
  { decision: "Lee JSON, no pickles", porque: "Un JSON se abre con cualquier editor y se revisa en el repositorio.", descarte: "Pickles de scikit-learn: dependen de la versión exacta y no se pueden leer.", ref: "D63" },
  { decision: "No vuelve a entrenar", porque: "La imagen solo lleva código y JSON, así que no necesita los datasets.", descarte: "Re-entrenar al arrancar: obligaría a llevar los datasets a la imagen.", ref: "D63, D69" },
  { decision: "Consultas por pregunta", porque: "Cada respuesta trae lo necesario para decidir: el margen de cada ciclo posible, la banda del pronóstico, el segundo grupo más cercano.", descarte: "Devolver solo el número.", ref: "D64" },
  { decision: "Banda con su cobertura real", porque: `La banda del pronóstico cubrió el ${pctFraccion(conteos.coberturaE1)} en la validación. La respuesta lo dice.`, descarte: "Anunciar el 80 % nominal.", ref: "D67" },
  { decision: "La caldera no guarda estado", porque: `Quien consulta manda la ventana de minutos que hace falta: ${conteos.ventanaVapor} o más para el vapor, ${conteos.persistencia} o más para que una alarma cuente como persistente.`, descarte: "—", ref: "D72" },
  { decision: "Límite de uso por IP", porque: "Es pública y sin llave: 300 consultas por IP al día, 40 por minuto y 5,000 en total. Al pasarse responde 429 con un mensaje en español.", descarte: "Cloud Armor (pide un balanceador con costo fijo) y una base compartida como Redis (otro servicio que mantener para una demo).", ref: "D78" },
  { decision: "Errores en español", porque: "Cada 422 nombra el campo y el motivo, por ejemplo \"precio: debe ser mayor o igual a 0.05\".", descarte: "Los mensajes de pydantic, en inglés y sin nombrar el campo.", ref: "D79" },
  { decision: "Cloud Run sin instancias fijas", porque: "Con 0 instancias mínimas no cuesta si nadie la usa; con 2 como máximo, el gasto tiene tope. Es la misma imagen de Docker.", descarte: "—", ref: "D77" },
  { decision: "El asistente no calcula", porque: "Gemini pide las cifras a las mismas funciones de la API y redacta con lo que devuelven. Tiene su propia cuota: 30 preguntas por IP al día.", descarte: "Buscar en documentos con vectores (RAG): los datos son pocos y estructurados, y una herramienta devuelve la cifra exacta.", ref: "D80-D82" },
  {
    decision: "Solo lo que se consulta en el momento",
    porque: <>Elegí lo que una persona de planta o de comercialización consultaría al momento. Lo demás, y cómo lo resolvería, está en <a href="#fuera">Lo que no está</a>.</>,
    descarte: "El monitor PCA (24 h de historia, se reentrena cada hora) y el detector de sensor congelado (muestras de 5 s).",
    ref: "D71",
  },
];

// Texto de docs/api.md, "Cómo se verificó". Las tolerancias (≤ 1 lb/acre, ≤ 0.006 t/h, ≤ 0.02 ¢/lb), el rango de precio
// US$0.10-0.30/lb y la deriva de 3 t/h se escriben a mano: son de las pruebas (tests/). Las bandas de 80 % se calculan del JSON.
const VERIFICACION: Fila[] = [
  { pregunta: "I · 1", que: `Margen de referencia ${usd(margenReferencia, 1)}/acre/año. Ciclo, margen, ganancia y precio de equilibrio de las ${conteos.variedadesCiclo} variedades iguales al notebook 02. El top 3 no cambia entre US$0.10 y 0.30/lb.` },
  { pregunta: "I · 2", que: `Las ${num(predicciones2022)} predicciones de 2022 del notebook 03 (${num(lotes2022)} lotes y ${num(plantias2022)} plantías), con diferencia ≤ 1 lb/acre.` },
  { pregunta: "I · 3", que: `El 100 % de las ${asignaciones} asignaciones de grupo del notebook 04.` },
  { pregunta: "I · 4", que: `La auditoría de la API es igual a la de pandas y clasifica bien ${num(auditoria.cerrados_bien)} de ${num(auditoria.cerrados)} ciclos. El CSV da lo mismo que el JSON. Sin la columna de corte se detectan ${num(sinCorte)} de ${num(auditoria.cerrados)} renovaciones, como en el notebook 05.` },
  { pregunta: "II · 1", que: `Los ${conteos.sensores} sensores, los ${conteos.excluidos.length} que quedan fuera de los modelos y la unidad corregida de la válvula del atemperador (%, no temperatura).` },
  { pregunta: "II · 2", que: `El 100 % de las ${num(ventanasModo)} ventanas de 5 min del notebook 07.` },
  { pregunta: "II · 3", que: `${minutosVapor} minutos con ${conteos.ventanaVapor} minutos de historia: el vapor estimado es igual al Ridge final del notebook 08 (≤ 0.006 t/h, por redondeo).` },
  { pregunta: "II · 4", que: `El z de los ${conteos.chequeos} chequeos es igual al del código del notebook 09 en ${minutosVerificacion} minutos. Operación normal sin alarmas. Una presión desplazada alarma solo con ${conteos.persistencia} minutos seguidos; tres presiones a la vez son un evento del hogar; una deriva de 3 t/h del medidor la señala el chequeo de vapor.` },
  { pregunta: "III · 3", que: `Las bandas de 80 % y 95 % a 1 y 3 meses, iguales a las del notebook 12 (≤ 0.02 ¢/lb). La de 80 % va ${banda80(1)} a un mes y ${banda80(3)} a tres meses.` },
  { pregunta: "Esquema SQL", que: "La auditoría hecha en PostgreSQL 16 es igual a la de pandas. Las reglas de la base rechazan una doble captura, un rendimiento imposible, la coma decimal y un estrato inválido." },
  { pregunta: "Todas", que: "Las cifras de los ejemplos de docs/api.md salen de la API, y las entradas inválidas devuelven 422 con el campo y el motivo en español." },
  { pregunta: "Límite de uso", que: "Cuota por IP al día y por minuto, tope del servicio y reinicio a la medianoche. Al pasarse, 429 en español con permiso de CORS, así que el sitio puede mostrar el mensaje." },
  { pregunta: "Asistente", que: "Con un modelo falso, sin llamar a Vertex AI: cada herramienta da lo mismo que su consulta, el bucle se detiene en 6 pasos, el modelo de respaldo entra si el principal está saturado y la cuota responde 429." },
];

/** Primera columna de la tabla de pruebas: la pregunta de la prueba, con enlace a su análisis. */
const preguntaConEnlace = (f: Fila) => {
  const a = ANALISIS[f.pregunta as string];
  if (!a) return f.pregunta as string;
  return (
    <>
      <Link href={a.href}>{a.texto.charAt(0).toUpperCase() + a.texto.slice(1)}</Link>
      <span className={s.deSerie}>Pregunta {a.n} de {a.serie}</span>
    </>
  );
};

// Entradas que las pruebas mandan a propósito para comprobar el 422 (tests/test_api.py y tests/test_api_caldera_mercado.py)
// Los límites de cada regla son los de api/esquemas.py.
const RECHAZOS: Fila[] = [
  { consulta: "POST /campo/ciclo", entrada: "variedad \"NO-EXISTE\"", regla: `Solo las ${conteos.variedadesCiclo} variedades con evidencia suficiente` },
  { consulta: "POST /campo/ciclo", entrada: "precio −0.2", regla: "Precio de US$0.05 a 1.00/lb" },
  { consulta: "POST /campo/ciclo", entrada: "barbecho 5", regla: "De 0 a 2 años sin caña" },
  { consulta: "POST /campo/pronostico", entrada: "corte 7", regla: "Corte de 0 (plantía) a 4" },
  { consulta: "POST /campo/pronostico", entrada: "finca \"NO-EXISTE\"", regla: `Una de las ${conteos.fincas} fincas conocidas, o "nueva"` },
  { consulta: "POST /campo/pronostico", entrada: "variedad sin historia en etapa 5", regla: "Es el escenario 3, pendiente (ver Lo que no está)" },
  { consulta: "POST /campo/pronostico", entrada: "ventaja del lote 0", regla: "Mayor que 0.2 y menor que 5" },
  { consulta: "POST /campo/segmento", entrada: "3 de los 4 indicadores", regla: "Los 4 son obligatorios" },
  { consulta: "POST /campo/auditoria", entrada: "lista de cosechas vacía", regla: "Al menos un registro" },
  { consulta: "POST /campo/auditoria", entrada: "TCH −5", regla: "Mayor que 0 y hasta 400 t/ha" },
  { consulta: "POST /campo/auditoria/csv", entrada: "CSV sin variedad ni tch", regla: "Dice qué columnas faltan" },
  { consulta: "POST /caldera/vapor-virtual", entrada: "5 minutos", regla: `Al menos ${conteos.ventanaVapor} minutos` },
  { consulta: "POST /caldera/vapor-virtual", entrada: "un minuto sin o2", regla: "Todas las variables, salvo el vapor medido" },
  { consulta: "POST /caldera/vapor-virtual", entrada: "presión del domo 9800 (kPa)", regla: "De 0 a 20 MPa" },
  { consulta: "POST /caldera/verificar", entrada: "lista de minutos vacía", regla: "De 1 a 120 minutos" },
  { consulta: "POST /caldera/modo", entrada: "solo el vapor", regla: `Las ${conteos.variablesModo} variables` },
  { consulta: "GET /mercado/pronostico", entrada: "h=2 o h=6", regla: "Horizonte de 1 o 3 meses" },
  { consulta: "GET /mercado/pronostico", entrada: "toneladas −5", regla: "Mayor que 0" },
];

// Pruebas aprobadas por archivo en la última corrida dentro de Docker
const ARCHIVOS_PRUEBA: Fila[] = [
  { archivo: "tests/test_api.py", que: "Serie I: cifras de control, ejemplos de la documentación y entradas inválidas", n: 47 }, // fuente: outputs/tests/pytest_docker.txt
  { archivo: "tests/test_api_caldera_mercado.py", que: "Series II y III: modo, vapor, verificación, pronóstico y entradas inválidas", n: 15 }, // fuente: outputs/tests/pytest_docker.txt
  { archivo: "tests/test_limites.py", que: "Límite de uso (429) y errores en español (422, 400, 404 y 405)", n: 18 }, // fuente: outputs/tests/pytest_docker.txt
  { archivo: "tests/test_asistente.py", que: "Asistente con un modelo falso: herramientas, bucle, respaldo, cuota y errores", n: 35 }, // fuente: outputs/tests/pytest_docker.txt
  { archivo: "tests/test_esquema_postgres.py", que: "Esquema SQL contra PostgreSQL 16: reglas y vista de la auditoría", n: 5 }, // fuente: outputs/tests/pytest_docker.txt
];
const TOTAL_PRUEBAS = ARCHIVOS_PRUEBA.reduce((n, f) => n + (f.n as number), 0);

/** Primera columna de las pruebas por archivo: la ruta y, debajo, qué prueba (la fila Total lleva el entorno). */
const archivoConQue = (f: Fila) => (
  <>
    {f.archivo === "Total" ? "Total" : <Ruta>{f.archivo as string}</Ruta>}
    <span className={s.deSerie}>{f.que as string}</span>
  </>
);

// Extracto del registro de la última corrida (outputs/tests/pytest_docker.txt): el comando (línea 2), la versión de
// Python y pytest (línea 4, recortada), "collected" (línea 10), la primera prueba (sin su porcentaje) y la última línea
// sin los signos "=" del marco.
const REGISTRO = `# docker compose --profile pruebas run --rm pruebas
platform linux -- Python 3.12.15, pytest-9.1.1
collected ${TOTAL_PRUEBAS} items

tests/test_api.py::test_salud PASSED
…
${TOTAL_PRUEBAS} passed in 20.75s`;

const TECNOLOGIAS = [
  { clave: "Hecha con", valor: "FastAPI, pydantic y Docker" },
  { clave: "Publicada en", valor: "Cloud Run, de Google Cloud" },
  { clave: "Probada con", valor: "pytest y PostgreSQL 16" },
  { clave: "Asistente", valor: "Gemini en Vertex AI" },
];

export default function PaginaApi() {
  return (
    <>
      <Portada
        titulo="La API repite las cifras del análisis"
        entrada={
          <>
            Un servicio web: otro sistema le manda datos y recibe la respuesta del análisis. No vuelve a entrenar ni
            lee los datasets.
          </>
        }
        acciones={
          <>
            <a className="boton" href={`${API_URL}/docs`} target="_blank" rel="noreferrer">
              Abrir la documentación interactiva
            </a>
            <Link href="/herramientas">Probarla en las herramientas</Link>
          </>
        }
        piezaPanel={false}
        pieza={
          <div className={s.pieza}>
            <CifraPortada
              valor={`${TOTAL_PRUEBAS} de ${TOTAL_PRUEBAS}`}
              etiqueta="pruebas aprobadas"
              detalle="Cada una llama a la API y compara la respuesta con la cifra del notebook. Corrieron dentro de Docker, con PostgreSQL 16."
            />
            {/* De punta a punta: con qué está hecha, dónde corre y cómo se prueba (bitácora D63-D82) */}
            <dl className={s.tecnologias}>
              {TECNOLOGIAS.map((t) => (
                <div key={t.clave}>
                  <dt>{t.clave}</dt>
                  <dd>{t.valor}</dd>
                </div>
              ))}
            </dl>
          </div>
        }
      >
        <EstadoApi version={VERSION_API} />
      </Portada>

      <IndiceLocal
        titulo="API"
        items={[
          { id: "para-que", etiqueta: "Para qué sirve" },
          { id: "como-funciona", etiqueta: "Cómo funciona" },
          { id: "decisiones", etiqueta: "Decisiones" },
          { id: "consultas", etiqueta: "Consultas" },
          { id: "pruebas", etiqueta: "Pruebas" },
          { id: "correrla", etiqueta: "Docker y Cloud Run" },
          { id: "fuera", etiqueta: "Lo que no está" },
          { id: "evaluacion", etiqueta: "Evaluación" },
        ]}
      />

      {/* Qué es y para qué sirve */}
      <Seccion
        id="para-que"
        titulo="Otros sistemas usan el análisis sin repetirlo"
        entrada="Una hoja de cálculo, las herramientas de este sitio o el asistente mandan datos en JSON y reciben la respuesta del análisis."
        cifras={
          <FilaCifras columnas={2}>
            <Cifra valor={TOTAL_CONSULTAS} unidad="consultas" etiqueta="De campo, caldera, mercado y el asistente" />
            <Cifra
              valor={preguntasTotal}
              unidad="preguntas"
              etiqueta={`De la prueba: ${preguntasCampo} de campo, ${preguntasCaldera} de caldera y ${preguntasMercado} de mercado`}
              detalle="Las cuatro de campo y parte de las de caldera y mercado"
            />
          </FilaCifras>
        }
      >
        <div className={s.conLado}>
          <Tabla
            titulo="Usos previstos"
            ancho="total"
            movil="apilar"
            columnas={[
              { clave: "uso", titulo: "Uso", ancho: "13rem" },
              { clave: "ejemplo", titulo: "Ejemplo" },
              {
                clave: "consulta",
                titulo: "Consulta",
                ancho: "15rem",
                valor: (f) => {
                  const rutas = f.consulta as string[];
                  return rutas.length === 0 ? "Todas" : rutas.map((r, i) => <span key={r}>{i > 0 && <br />}<Ruta>{r}</Ruta></span>);
                },
              },
            ]}
            filas={USOS}
          />
          <div className={`${s.lado} ${s.ladoFijo}`}>
            <Nota tipo="limite" titulo="datos públicos y de otros lugares">
              <p>
                Los ensayos son de Louisiana (2010-2021){/* fuente: docs/api.md, "Límite principal" */}, la caldera quema
                carbón y el precio es el del mercado mundial. La API sirve para el método. Los valores para el ingenio
                saldrán de sus propios datos.
              </p>
            </Nota>
          </div>
        </div>
      </Seccion>

      {/* Cómo funciona */}
      <Seccion
        id="como-funciona"
        titulo="No reentrena: lee los JSON del análisis"
        entrada={
          <>
            Los notebooks hacen el análisis una vez y guardan cada modelo en un JSON. La API los carga al arrancar y
            calcula con el mismo código de <code>src/</code>.
          </>
        }
      >
        <Figura
          ancho="total"
          titulo="Los datasets se quedan en el análisis: a la API llegan el código y los JSON"
          nota="Las flechas siguen el camino de los datos. Por eso las respuestas coinciden con los notebooks. Para actualizar una respuesta se vuelve a correr su notebook con datos nuevos y se publica el JSON que deja."
          fuente="docs/api.md · Dockerfile · api/servicios.py, api/caldera.py y api/mercado.py"
        >
          <DiagramaFlujo archivos={ARCHIVOS} />
        </Figura>
      </Seccion>

      {/* Decisiones de diseño: el criterio de cada pieza */}
      <Seccion
        id="decisiones"
        titulo="Cada decisión, con lo que descarté"
        entrada="Lo que decidí para la API, por qué y qué dejé de lado. Cada fila remite a su entrada de la bitácora."
      >
        <Tabla
          titulo="Decisiones de la API"
          ancho="total"
          movil="apilar"
          columnas={[
            {
              clave: "decision",
              titulo: "Decisión",
              ancho: "15rem",
              // La entrada de la bitácora va bajo la decisión: tres columnas de texto dejan más ancho a cada una en tableta
              valor: (f) => (
                <>
                  {f.decision as string}
                  <span className={s.deSerie}>Bitácora <span className="num">{f.ref as string}</span></span>
                </>
              ),
            },
            { clave: "porque", titulo: "Por qué" },
            { clave: "descarte", titulo: "Qué descarté" },
          ]}
          filas={DECISIONES}
          nota={<>Detalle de cada decisión en la <a href={archivoRepo("bitacora.md")}>bitácora</a>, sección Serie IV.</>}
        />
      </Seccion>

      {/* Las consultas */}
      <Seccion
        id="consultas"
        titulo="Cada respuesta trae lo necesario para decidir"
        entrada="Las GET solo leen; las POST reciben JSON o un CSV y devuelven el cálculo. Ninguna guarda lo que recibe."
      >
        <ListaConsultas grupos={GRUPOS} />
        {/* La documentación interactiva, tal como se ve: la prueba de que el contrato (OpenAPI) está publicado */}
        <div className={s.conLado}>
          <Figura
            titulo="La documentación interactiva: cada consulta se abre y se prueba desde el navegador"
            nota={`La captura muestra las ${enCaptura} consultas de general y campo; debajo siguen caldera, mercado y el asistente.`}
            fuente={<>captura de <code>/docs</code> de la API {VERSION_API} (FastAPI y Swagger UI) corriendo en Docker</>}
          >
            <div className={s.captura} data-ui="">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturaDocs.src}
                width={capturaDocs.width}
                height={capturaDocs.height}
                loading="lazy"
                alt="Documentación interactiva de la API: los grupos General y Campo con sus consultas GET y POST, de /salud a /campo/auditoria/csv, cada una con su resumen y una flecha para abrirla."
              />
            </div>
          </Figura>
          <div className={`${s.lado} ${s.ladoFijo}`}>
            <p className={s.texto}>
              Cada ejemplo salió de llamar a la API con los artefactos del repositorio. La{" "}
              <a href={`${API_URL}/docs`}>documentación interactiva</a> muestra cada campo con su rango válido y su
              ejemplo, y permite probar la consulta desde el navegador (OpenAPI). La guía completa está en{" "}
              <a href={archivoRepo("docs/api.md")}>docs/api.md</a>.
            </p>
            <a className="boton boton-sec" href={`${API_URL}/docs`} target="_blank" rel="noreferrer">
              Abrir la documentación
            </a>
          </div>
        </div>
      </Seccion>

      {/* Validación y pruebas */}
      <Seccion
        id="pruebas"
        titulo={`Las ${TOTAL_PRUEBAS} pruebas pasan dentro de Docker`}
        entrada="Cada prueba llama a la API y compara la respuesta con la cifra de su notebook, caso por caso."
        cifras={
          <div className={s.tresCifras}>
            <Cifra
              valor={num(predicciones2022)}
              unidad="predicciones"
              etiqueta="De 2022, del notebook 03"
              detalle={`${num(lotes2022)} lotes y ${num(plantias2022)} plantías, con diferencia ≤ 1 lb/acre`}
            />
            <Cifra
              valor={num(auditoria.cerrados_bien)}
              unidad="ciclos"
              etiqueta={`Bien clasificados de ${num(auditoria.cerrados)}`}
              detalle="Igual en pandas, en la API y en PostgreSQL"
            />
            <Cifra
              valor={num(ventanasModo)}
              unidad="ventanas"
              etiqueta="De 5 min, con la misma zona de carga"
              detalle="El 100 % de las del notebook 07"
            />
          </div>
        }
      >
        <div className={s.conLado}>
          <Tabla
            titulo="Qué comprueban las pruebas"
            ancho="total"
            movil="apilar"
            columnas={[
              { clave: "pregunta", titulo: "Pregunta", ancho: "13rem", valor: preguntaConEnlace },
              { clave: "que", titulo: "Qué se comprueba" },
            ]}
            filas={VERIFICACION}
            nota="Las muestras de la caldera las exportan los notebooks 07 y 08, así que las pruebas no necesitan los datasets."
          />
          {/* Al lado de la tabla larga: el registro real y de qué archivos salen las 120. Fijo mientras se lee la tabla. */}
          <div className={`${s.lado} ${s.ladoFijoAlto}`}>
            <div className={s.registro} data-ui="">
              <p className={s.registroTitulo}>La última corrida, tal como quedó en el registro</p>
              <pre><code>{REGISTRO}</code></pre>
            </div>
            <Tabla
              compacta
              titulo="De dónde salen las pruebas"
              movil="apilar"
              columnas={[
                { clave: "archivo", titulo: "Archivo y qué prueba", valor: archivoConQue },
                { clave: "n", titulo: "Aprobadas", tipo: "num", ancho: "6.5rem" },
              ]}
              filas={[...ARCHIVOS_PRUEBA, { archivo: "Total", que: "Docker: python:3.12-slim y PostgreSQL 16", n: TOTAL_PRUEBAS }]}
              destacar={(f) => f.archivo === "Total"}
            />
            <p className={s.notaLado}>
              Registro completo en <a href={archivoRepo("outputs/tests/pytest_docker.txt")}>outputs/tests/pytest_docker.txt</a>.
            </p>
          </div>
        </div>

        <div className={s.bloque}>
          <h3 className={s.subtitulo}>Una entrada imposible se rechaza con un 422</h3>
          <p className={s.texto}>
            Cada campo tiene un rango físico o económico plausible. El precio va de US$0.05 a 1.00/lb, el corte de 0 a
            4, el TCH (toneladas de caña por hectárea) de 0 a 400 y la presión del domo de 0 a 20 MPa: una presión en
            kPa se rechaza.{/* fuente: api/esquemas.py */} También se rechazan una variedad o finca desconocida y un
            CSV sin las columnas necesarias. En esos casos la API no calcula nada y responde con el código 422 (entrada
            inválida). Las pruebas mandan a propósito {RECHAZOS.length} entradas así y esperan ese código; están en el
            detalle técnico, al final de esta sección.
          </p>
          {/* Respuestas tal como las devuelve la API (api/servicios.py y pydantic) a dos entradas de tests/test_api.py */}
          <div className={s.ejemplos}>
            <div data-ui="">
              <p className={s.paso}><strong>Error de contenido:</strong> dice qué corregir.</p>
              <Codigo rotulo="Petición" texto={`POST /campo/pronostico\n{"variedad": "HOCP14-885", "finca": "NO-EXISTE", "corte": 0}`} />
              <Codigo
                rotulo="Respuesta 422"
                texto={`{"detail": "Finca 'NO-EXISTE' desconocida. Use una de /campo/variedades o 'nueva' si no tiene historia."}`}
              />
            </div>
            <div data-ui="">
              <p className={s.paso}><strong>Error de rango:</strong> nombra el campo y el límite.</p>
              <Codigo rotulo="Petición" texto={`POST /campo/ciclo\n{"variedad": "HOCP14-885", "precio": -0.2}`} />
              <Codigo
                rotulo="Respuesta 422"
                texto={`{"detail": "precio: debe ser mayor o igual a 0.05",\n "errores": ["precio: debe ser mayor o igual a 0.05"]}`}
              />
            </div>
          </div>
        </div>

        <div className={s.bloque}>
          <h3 className={s.subtitulo}>Un uso excesivo se frena con un 429</h3>
          <div className={s.conLado}>
            <p className={s.texto}>
              La API es pública y no pide llave, así que cada IP tiene 40 consultas por minuto y 300 por día, y el
              servicio un tope de 5,000 diarias{/* fuente: api/limites.py */}. <code>/salud</code> y la documentación no
              gastan la cuota. Al pasarse responde 429 con un mensaje en español y la cabecera <code>Retry-After</code>;
              cada respuesta trae <code>X-Consultas-Restantes-Hoy</code>. El conteo se reinicia a la medianoche, hora de
              Guatemala. El asistente tiene una cuota aparte y más corta: 30 preguntas por IP al día.
            </p>
            <div className={s.lado}>
              <Nota tipo="limite" titulo="el conteo vive en la memoria de cada instancia">
                <p>
                  Con Cloud Run limitado a 2 instancias, el tope real puede llegar al doble. Basta para frenar abusos y
                  acotar el costo de una demo; para un uso real iría una base compartida o una llave por usuario.
                </p>
              </Nota>
            </div>
          </div>
        </div>

        {/* Cerrado, su tabla no ocupa lugar (Pagina.module.css, .plegado): sin eso el navegador la sigue midiendo,
            encimada e invisible sobre la sección siguiente. */}
        <div className={s.plegado}>
          <Desplegable titulo={`Detalle técnico: las ${RECHAZOS.length} entradas que las pruebas mandan para el 422`}>
            <Tabla
              compacta
              titulo="Entradas que las pruebas mandan para comprobar el rechazo"
              movil="apilar"
              columnas={[
                { clave: "consulta", titulo: "Consulta", ancho: "15rem", valor: (f) => <Ruta>{f.consulta as string}</Ruta> },
                { clave: "entrada", titulo: "Entrada" },
                { clave: "regla", titulo: "Regla" },
              ]}
              filas={RECHAZOS}
            />
          </Desplegable>
        </div>
      </Seccion>

      {/* Cómo correrla y dónde corre */}
      <Seccion
        id="correrla"
        titulo="Un comando la levanta y otro la prueba"
        entrada="Solo pide Docker: no necesita los datasets ni variables secretas. La misma imagen es la que corre en Cloud Run."
      >
        <div className={s.par}>
          <div>
            <p className={s.paso}><strong>Levantar la API</strong>, desde la raíz del repositorio y con Docker Desktop abierto.</p>
            <Codigo rotulo="Terminal" texto="docker compose up --build" />
            <p className={s.paso}>La documentación interactiva queda en <code>http://localhost:8000/docs</code>.</p>
          </div>
          <div>
            <p className={s.paso}><strong>Correr todas las pruebas</strong>, incluida la del esquema contra PostgreSQL 16.</p>
            <Codigo rotulo="Terminal" texto="docker compose --profile pruebas run --rm pruebas" />
            <p className={s.paso}>El perfil <code>pruebas</code> agrega un PostgreSQL 16 temporal, en memoria y sin puertos expuestos.</p>
          </div>
        </div>

        <div className="columnas">
          <div>
            <h3 className={s.tituloColumna}>Qué lleva la imagen</h3>
            <p>
              Una sola imagen (<code>python:3.12-slim</code>) corre la API y las pruebas. Pesa 777 MB
              {/* fuente: bitácora D76 y D80 */} porque suma scikit-learn, para comparar la verificación con el código
              del notebook 09, y la librería de Vertex AI del asistente.
            </p>
            <p>Lleva el código, los JSON y las tablas de control. No lleva datasets ni notebooks.</p>
          </div>
          <div>
            <h3 className={s.tituloColumna}>Cómo corre</h3>
            <p>
              Con un usuario sin privilegios. Docker revisa <code>/salud</code> cada 10 s{/* fuente: docker-compose.yml, healthcheck */}.
            </p>
            <p>
              <code>CORS_ORIGINS</code> (opcional) limita qué sitios web pueden consultarla. <code>LIMITE_IP_DIA</code>,{" "}
              <code>LIMITE_IP_MINUTO</code> y <code>LIMITE_GLOBAL_DIA</code> (opcionales) cambian el límite de uso. Sin{" "}
              <code>GOOGLE_CLOUD_PROJECT</code>, el asistente responde 503 y lo demás funciona igual.
            </p>
          </div>
          <div>
            <h3 className={s.tituloColumna}>En Cloud Run</h3>
            <p>
              Lee la variable <code>PORT</code>, así que la misma imagen sirve en Cloud Run. Corre como servicio aparte en{" "}
              <span className={s.ruta}>us-central1</span>, con 1 GB de memoria{/* fuente: bitácora D77 */}.
            </p>
            <p>
              CORS solo deja consultarla desde este sitio, localhost y sus vistas previas. Con Vertex AI se autentica con
              la cuenta de servicio, sin llaves en el repositorio{/* fuente: bitácora D77 y D80 */}.
            </p>
          </div>
        </div>

        <Desplegable titulo="Detalle técnico: correrla sin Docker">
          <Codigo rotulo="Terminal" texto={"pip install -r requirements.txt\nuvicorn api.main:app --reload\npytest"} />
          <p>
            Sin la variable <code>CAMPO_PG_DSN</code>, <code>pytest</code> omite la prueba de PostgreSQL.
          </p>
        </Desplegable>

        <div>
          <h3 className={s.tituloColumna}>Archivos en el repositorio</h3>
          <ul className={s.enlaces} aria-label="Archivos de la API en el repositorio">
            <li><a href={archivoRepo("docs/api.md")}>docs/api.md</a></li>
            <li><a href={archivoRepo("api/main.py")}>api/main.py</a></li>
            <li><a href={archivoRepo("api/esquemas.py")}>api/esquemas.py</a></li>
            <li><a href={archivoRepo("api/limites.py")}>api/limites.py</a></li>
            <li><a href={archivoRepo("api/asistente.py")}>api/asistente.py</a></li>
            <li><a href={archivoRepo("docker-compose.yml")}>docker-compose.yml</a></li>
            <li><a href={archivoRepo("tests/test_api.py")}>tests/test_api.py</a></li>
            <li><a href={archivoRepo("tests/test_api_caldera_mercado.py")}>tests/test_api_caldera_mercado.py</a></li>
            <li><a href={archivoRepo("tests/test_asistente.py")}>tests/test_asistente.py</a></li>
          </ul>
        </div>
      </Seccion>

      {/* Lo que no está en la API */}
      <Seccion
        id="fuera"
        titulo="Cuatro piezas quedan fuera, a propósito"
        entrada="Dejé fuera lo que necesita historia larga, datos más finos o un modelo que no hice. Así lo resolvería."
      >
        {/* En lista (la pieza a la izquierda, por qué y cómo lo resolvería a la derecha) y no en columnas con barra: así no
            se repite la forma de "Docker y Cloud Run" ni la de la Evaluación, que vienen antes y después */}
        <div className={s.fuera}>
          <div>
            <h3 className={s.tituloColumna}>Monitor de proceso (PCA, notebook 09)</h3>
            <p>
              Detecta fallas de proceso o de equipo. Necesita 24 h de historia y se reentrena cada hora. En producción
              iría como un servicio programado que lee el historiador de la planta.
            </p>
          </div>
          <div>
            <h3 className={s.tituloColumna}>Sensor congelado</h3>
            <p>Se detecta con las muestras de {sensores.periodo_s}&nbsp;s. La API recibe promedios de 1 min.</p>
          </div>
          <div>
            <h3 className={s.tituloColumna}>Precio con datos nuevos</h3>
            <p>
              El JSON trae el último cierre de los datos ({conteos.fechaCierre}). Para usarlo en vivo, un proceso diario
              tendría que recalcular la volatilidad y el último cierre.
            </p>
          </div>
          <div>
            <h3 className={s.tituloColumna}>Variedad sin historia en etapa 5</h3>
            <p>
              Es el escenario 3 de la pregunta 2. La API la rechaza con un 422: predecirla como un testigo promedio daría
              una cifra sin respaldo. El diseño para resolverlo está en el{" "}
              <a href={archivoRepo("README.md")}>README</a>, sección de pendientes.
            </p>
          </div>
        </div>
      </Seccion>

      {/* Evaluación gerencial: todo sale de docs/api.md, README "Serie IV" y bitácora D63-D82 */}
      <Seccion id="evaluacion" titulo="Lista, pero faltan los datos del ingenio">
        {/* La sección entera va sobre el tinte: el título y su banda se leen como un solo bloque (Pagina.module.css) */}
        <div className={s.cierre}>
          <Evaluacion
            significa={
              <>
                Cualquier sistema del ingenio puede pedir las respuestas de las tres series sin rehacer el análisis. Recibe
                las mismas cifras de los notebooks, con su banda o su certeza.
              </>
            }
            decision={
              <>
                Recomiendo que toda herramienta que muestre estas cifras las pida a la API, como ya hacen las{" "}
                <Link href="/herramientas">herramientas de este sitio</Link>. Antes de usarla para decidir, recomiendo
                volver a correr los notebooks con datos del ingenio y publicar los JSON que dejan.
              </>
            }
            impacto={
              <>
                No lo medí en dinero. La API no agrega cifras nuevas: hace consultables las de las Series I a III. El
                impacto de cada respuesta es el que estima su serie.
              </>
            }
            riesgo={
              <>
                Los datos son públicos y de otros lugares, así que hoy sirve para el método y no para los valores. El
                precio queda fijo en el último cierre de los datos ({conteos.fechaCierre}) hasta volver a correr el
                notebook 12. El límite por IP vive en la memoria de cada instancia, así que el tope real puede llegar al
                doble.
              </>
            }
            certeza={{
              nivel: "alta",
              texto: (
                <>
                  En que la API repite las cifras de los notebooks: lo comprueban {TOTAL_PRUEBAS} pruebas dentro de
                  Docker. La certeza de cada cifra es la de su serie.
                </>
              ),
            }}
          />
        </div>
      </Seccion>
    </>
  );
}
