import Link from "next/link";
import { Cifra } from "@/components/Cifra";
import type { NivelCerteza } from "@/components/Certeza";
import { Figura } from "@/components/Figura";
import { Desplegable } from "@/components/Nota";
import { Portada } from "@/components/Portada";
import { Seccion } from "@/components/Seccion";
import { Tabla } from "@/components/Tabla";
import limpieza from "@/datos/serie1_limpieza.json";
import recomendacion from "@/datos/serie1_recomendacion.json";
import resumenCampoP2 from "@/datos/serie1_resumen_p2.json";
import resumenCampoP3 from "@/datos/serie1_resumen_p3.json";
import resumenCampoQ1 from "@/datos/serie1_resumen_q1.json";
import prediccionesVapor from "@/datos/serie2_predicciones_p3.json";
import resumenCalderaP1 from "@/datos/serie2_resumen_p1.json";
import resumenCalderaP3 from "@/datos/serie2_resumen_p3.json";
import pronosticoPrecio from "@/datos/serie3_pronostico.json";
import resumenMercadoP2 from "@/datos/serie3_resumen_p2.json";
import resumenMercadoP3 from "@/datos/serie3_resumen_p3.json";
import pronosticosH1 from "@/datos/serie3_pronosticos_h1.json";
import { archivoRepo, REPO } from "@/lib/base";
import { conSigno, num, usd } from "@/lib/formato";
// Las figuras de los capítulos son las mismas de cada caso: portada y caso muestran lo mismo.
import { GraficoGanancia } from "./campo/_componentes/GraficosVariedades";
import { GraficoMedidoEstimado } from "./caldera/_componentes/Graficos";
import { GraficoBanda, type BandaMes } from "./mercado/_componentes/GraficoBanda";
import { ApiEnVivo } from "./_inicio/ApiEnVivo";
import { Capitulo } from "./_inicio/Capitulo";
import { GraficoValidacion, type FilaValidacion } from "./_inicio/GraficoValidacion";
import { Recomendaciones } from "./_inicio/Recomendaciones";
import s from "./_inicio/inicio.module.css";

// Cifras que no están en ningún JSON de src/datos: se escriben a mano con su fuente.
// fuente: README.md, lista de notebooks 01 a 13
const NOTEBOOKS = 13;
// fuente: docs/api.md, tabla "Consultas", y /openapi.json de la API (14 rutas, incluidas /salud y las 2 del asistente)
const CONSULTAS_API = 14;
// fuente: bitacora.md, "Resumen" > "Uso de IA en números"
const BITACORA = { decisiones: 85, hipotesis: 24, erroresIa: 34 };
// fuente: outputs/tests/pytest_docker.txt ("120 passed")
const PRUEBAS_DOCKER = 120;
// fuente: README.md, "Lenguaje natural: asistente con Gemini en Vertex AI" (9 herramientas; 6 usan las funciones de la API)
const HERRAMIENTAS_ASISTENTE = { total: 9, deLaApi: 6 };
// Filas de la figura de ganancia en la portada (la página de campo muestra las 23)
const FILAS_GANANCIA = 10;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const redondear = (x: number, decimales: number) => Math.round(x * 10 ** decimales) / 10 ** decimales;
/** Porcentaje con espacio duro entre número y signo: el % nunca queda solo al inicio de un renglón. */
const pctJunto = (x: number, decimales = 0) => `${num(x, decimales)} %`;
const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

export default function Inicio() {
  // ── Serie I · Campo (notebook 02) ──
  const porRango = [...recomendacion].sort((a, b) => a.rank - b.rank);
  const [v1, v2, v3] = porRango;
  const top3 = [v1, v2, v3];
  const ganaMinimo = Math.min(...top3.map((v) => v.P_gana_a_testigos));
  const socaMaxValidacion = Math.max(v2.ultimo_corte_medido, v3.ultimo_corte_medido);
  const replicas = resumenCampoQ1.bootstrap.replicas;
  const referencia = resumenCampoQ1.referencia;
  const filasGanancia = porRango.slice(0, FILAS_GANANCIA).map((r) => ({
    variedad: r.CLONE,
    punto: r.ganancia_vs_testigos,
    p05: r.ganancia_p05,
    p95: r.ganancia_p95,
    top3: r.rank <= 3,
    testigo: r.testigo,
  }));

  // ── Serie II · Caldera (notebook 08) ──
  const metricasVapor = resumenCalderaP3.metricas;
  const ridge = metricasVapor["Ridge completo"];
  const hidraulico = metricasVapor["Hidráulico √(ΔP·ρ)"];
  const boosting = metricasVapor["Gradient boosting"];
  const coberturaBanda = resumenCalderaP3.banda["Ridge completo"]["cobertura (meta 90 %)"];
  const validacion: FilaValidacion[] = Object.entries(resumenCalderaP3.al_azar)
    .map(([modelo, v]) => ({
      modelo,
      azar: v["MAE al azar"],
      adelante: v["MAE hacia adelante"],
      optimismo: v["optimismo (%)"],
    }))
    .sort((a, b) => b.optimismo - a.optimismo);
  const optimismoMin = Math.min(...validacion.map((f) => f.optimismo));
  const optimismoMax = Math.max(...validacion.map((f) => f.optimismo));
  const masEnganado = validacion[0];
  // Mismo día que la página de la caldera: el tercer día con predicción fuera de muestra
  const diasConPrediccion = [
    ...new Set(prediccionesVapor.filter((r) => r["Ridge completo"] !== null).map((r) => r.date.slice(0, 10))),
  ].sort();
  const diaVapor = diasConPrediccion[2];
  const puntosDia = prediccionesVapor
    .filter((r) => r.date.startsWith(diaVapor) && r["Ridge completo"] !== null)
    .map((r) => ({
      h: Number(r.date.slice(11, 13)) + Number(r.date.slice(14, 16)) / 60,
      med: redondear(r.medido, 3),
      est: redondear(r["Ridge completo"] as number, 3),
    }));
  const maeDia = puntosDia.reduce((a, p) => a + Math.abs(p.est - p.med), 0) / puntosDia.length;

  // ── Serie III · Mercado (notebooks 11 y 12) ──
  const [mesH1, banda] = Object.entries(resumenMercadoP3.vigente)[0];
  const realParcial = resumenMercadoP3.junio_real_parcial;
  const dentro = realParcial >= banda.p10 && realParcial <= banda.p90;
  const diaCorte = Number(resumenMercadoP2.auditoria.hasta.slice(8, 10));
  const errorUltimoCierre = resumenMercadoP3.metricas["1"]["Ingenuo: último cierre"]["MAPE (%)"];
  const arimaPeor = -resumenMercadoP3.metricas["1"]["ARIMA(1,1,0) sobre promedios"]["mejora vs último cierre (%)"];
  const mesesFueraDeMuestra = pronosticosH1.length;
  const [girosPaseoMin, girosPaseoMax] = resumenMercadoP2.fases_paseo.slice(1);
  // Primer origen del pronóstico rodante (notebook 12): "2008-12-31" → "diciembre de 2008"
  const [anioOrigen, mesOrigen] = pronosticosH1[0].origen.split("-").map(Number);
  const primerOrigen = `${MESES[mesOrigen - 1]} de ${anioOrigen}`;
  // Bandas vigentes ("junio 2024", "agosto 2024") a mitad de su mes, como en la página del mercado
  const mitadDeMes = (mes: string) => {
    const [nombre, anio] = mes.split(" ");
    return `${anio}-${String(MESES.indexOf(nombre) + 1).padStart(2, "0")}-15`;
  };
  const bandasVigentes: BandaMes[] = Object.entries(resumenMercadoP3.vigente).map(([mes, b]) => ({
    mes, fecha: mitadDeMes(mes), centro: b.centro, p2_5: b["p2.5"], p10: b.p10, p90: b.p90, p97_5: b["p97.5"],
  }));
  const realesRecientes = pronosticosH1.slice(-24).map((f) => ({ fecha: `${f.objetivo.slice(0, 8)}15`, valor: f.real }));
  const fechaOrigen = pronosticoPrecio.fecha_origen.split("-").reverse().join("/");
  const mesParcial = mesH1.split(" ")[0];

  // ── Ejemplos del método ──
  const filasOriginales = limpieza.find((f) => f.Regla === "filas_originales")?.Filas ?? 0;
  const filasComa = limpieza.find((f) => f.Regla.includes("coma decimal"))?.Filas ?? 0;
  const ridgeCampo = resumenCampoP2.metricas_e1.Ridge;
  const bosqueCampo = resumenCampoP2.metricas_e1["Random Forest"];

  // ── Lo que corre en producción (README: "Por qué elegí estas herramientas" y "Lenguaje natural") ──
  type Pieza = { pieza: React.ReactNode; hace: React.ReactNode; porque: React.ReactNode };
  const piezas: Pieza[] = [
    {
      pieza: <Link href="/api">API</Link>,
      hace: (
        <>
          {CONSULTAS_API} consultas con los modelos de las tres series, en FastAPI y pydantic: la validación de entradas y
          la documentación OpenAPI salen del mismo código.
        </>
      ),
      porque: (
        <>
          Corre en Cloud Run con el mismo Dockerfile que en local. Escala a cero cuando nadie la usa y tiene un tope de 2
          instancias para acotar el costo.
        </>
      ),
    },
    {
      pieza: <Link href="/herramientas">Herramientas</Link>,
      hace: (
        <>
          Calculadoras de campo, caldera y mercado que llaman a la misma API: se cambia un supuesto y se ve qué responde
          el modelo.
        </>
      ),
      porque: <>Una gerencia no abre notebooks. Así prueba sus propios supuestos desde el navegador.</>,
    },
    {
      pieza: <Link href="/asistente">Asistente</Link>,
      hace: (
        <>
          Responde en español sobre las tres series. Gemini, en Vertex AI, pide las cifras a la API y redacta con lo que
          recibe, citando la fuente.
        </>
      ),
      porque: (
        <>
          Lo preferí a un bot de Telegram con n8n: se abre sin instalar nada, es una consulta más de la API, con sus
          pruebas, y entra a Vertex AI sin llaves en el repositorio.
        </>
      ),
    },
    {
      pieza: <Link href="/presentacion">Presentación</Link>,
      hace: (
        <>
          Las tres decisiones en diapositivas, con la evaluación gerencial de cada serie. Se proyecta o se imprime en
          PDF.
        </>
      ),
      porque: <>Lee los mismos archivos que el sitio, y la demostración de la API queda a un clic.</>,
    },
    {
      pieza: <a href={`${REPO}/tree/main/web`}>Este sitio</a>,
      hace: <>Next.js en Vercel, publicado en edgarsierra.com. Cada página lee los JSON que exportan los notebooks.</>,
      porque: (
        <>
          Se abre en cualquier dispositivo. Las páginas son estáticas, sin costo de servidor, y se despliegan solas con
          cada cambio en el repositorio.
        </>
      ),
    },
  ];

  return (
    <>
      <Portada
        titulo="Qué recomiendo al ingenio y por qué"
        entrada={
          <p>
            Qué variedades sembrar, cómo vigilar la caldera y qué precio presupuestar. Analicé cada decisión con datos
            públicos y puse los modelos en producción.
          </p>
        }
        acciones={
          <>
            <Link href="/presentacion" className="boton">
              Ver la presentación
            </Link>
            <Link href="/herramientas">Probar los modelos</Link>
          </>
        }
        meta={[
          { clave: "Autor", valor: "Edgar Sierra" },
          { clave: "Datos", valor: "Públicos: ensayos de Louisiana, una caldera en China y el mercado mundial" },
          { clave: "Análisis", valor: `3 series y ${NOTEBOOKS} notebooks` },
          { clave: "En producción", valor: `API con ${CONSULTAS_API} consultas en Cloud Run` },
        ]}
        pieza={
          <Recomendaciones
            items={[
              {
                serie: "campo",
                nombre: "Campo",
                accion: `Ampliar ${v1.CLONE} y renovar cada ${v1.ciclo_optimo} cortes`,
                nivel: v1.nivel_certeza_top3 as NivelCerteza,
                matiz: `${v3.CLONE}: ${v3.nivel_certeza_top3}`,
              },
              {
                serie: "caldera",
                nombre: "Caldera",
                accion: "Poner en línea el sensor virtual de vapor",
                nivel: "alta", // fuente: notebook 08, "Evaluación gerencial" > "Nivel de certeza"
                matiz: "La banda de error: media",
              },
              {
                serie: "mercado",
                nombre: "Mercado",
                accion: "Presupuestar con el precio de hoy y una banda",
                nivel: "alta", // fuente: notebook 12, "Evaluación gerencial" > "Nivel de certeza"
                matiz: "A 3 meses: media",
              },
            ]}
          />
        }
      />

      {/* Los tres capítulos. El id "decisiones" lo usa la presentación ("/#decisiones"). */}
      <div id="decisiones">
        {/* ── Campo ─────────────────────────────────────────────────────────── */}
        <div className={s.banda}>
          <Seccion
            id="campo"
            serie="campo"
            titulo="Tres variedades dejan el mejor margen"
            entrada={
              <p>
                Recomiendo ampliar {v1.CLONE} y llevar {v2.CLONE} y {v3.CLONE} a escala de validación: solo tienen datos
                hasta la soca {socaMaxValidacion}.
              </p>
            }
            cifras={
              <div className={s.cifras}>
                <Cifra
                  valor={conSigno(v1.ganancia_vs_testigos, 0)}
                  unidad="US$/acre/año"
                  etiqueta={`${v1.CLONE} contra el testigo promedio`}
                  detalle={`Intervalo de 90 %: de ${num(v1.ganancia_p05, 0)} a ${num(v1.ganancia_p95, 0)} · notebook 02`}
                />
                <Cifra
                  valor={num(v1.ciclo_optimo)}
                  unidad="cortes"
                  etiqueta="Ciclo de renovación con mejor margen anual"
                  detalle={`Plantía y ${v1.ciclo_optimo - 1} socas. El testigo promedio, con ${referencia.ciclo} cortes, deja ${usd(referencia.margen, 1)}/acre/año.`}
                />
              </div>
            }
          >
            <Capitulo
              figura={
                <Figura
                  numero={1}
                  ancho="total"
                  titulo={`Las tres primeras le ganan al testigo entre ${usd(v3.ganancia_vs_testigos, 0)} y ${usd(v1.ganancia_vs_testigos, 0)} por acre al año`}
                  nota={
                    <>
                      Cada punto es la ganancia de la variedad contra el testigo promedio (las variedades comerciales de
                      referencia), con su mejor ciclo; la línea es el intervalo de 90 %. En verde, las tres que recomiendo;
                      los puntos huecos son testigos. Muestro las {FILAS_GANANCIA} primeras de {recomendacion.length}.
                    </>
                  }
                  fuente="notebook 02 · outputs/tables/serie1_recomendacion.csv"
                >
                  <GraficoGanancia filas={filasGanancia} />
                </Figura>
              }
              contexto={
                <p>
                  Sirve para decidir qué variedades ampliar y cada cuántos cortes renovar un lote. Para el ingenio es un
                  protocolo, no una lista de compra.
                </p>
              }
              certeza={{
                nivel: v1.nivel_certeza_top3 as NivelCerteza,
                motivo: (
                  <>
                    Las tres ganan al testigo en el {pctJunto(ganaMinimo * 100, 0)} de {num(replicas)} remuestreos de los
                    ensayos. {v3.CLONE} queda entre las tres primeras en el {pctJunto(v3.P_top3 * 100, 0)}: certeza{" "}
                    {v3.nivel_certeza_top3} para ella.
                  </>
                ),
              }}
              caso={{ href: "/campo", texto: "Ver el caso de campo" }}
              herramienta={{ href: "/herramientas#ciclo", texto: "Calcular el ciclo con otro precio" }}
              consulta="POST /campo/ciclo"
            />
          </Seccion>
        </div>

        {/* ── Caldera ───────────────────────────────────────────────────────── */}
        <div className={s.banda}>
          <Seccion
            id="caldera"
            serie="caldera"
            titulo="La caída de presión ya mide el vapor"
            entrada={
              <p>
                Recomiendo poner en línea el sensor virtual y usar la diferencia entre lo medido y lo estimado como alarma
                de que el medidor se desvía.
              </p>
            }
            cifras={
              <div className={s.cifras}>
                <Cifra
                  valor={num(ridge["MAPE_%"], 2)}
                  unidad="%"
                  etiqueta="Error del sensor virtual: el vapor estimado con los demás sensores"
                  detalle={`${num(ridge.MAE_t_h, 2)} t/h en promedio, medido en días que el modelo no vio · notebook 08`}
                />
                <Cifra
                  valor={num(hidraulico["MAPE_%"], 1)}
                  unidad="%"
                  etiqueta="Error con una sola variable: la caída de presión"
                  detalle="Es la física de un medidor de flujo: el vapor crece con √(ΔP·ρ)."
                />
              </div>
            }
          >
            <Capitulo
              figura={
                <Figura
                  numero={2}
                  ancho="total"
                  titulo={`Medido contra estimado el ${fechaCorta(diaVapor)}, un día que el modelo no vio`}
                  nota={`Minuto a minuto. Ese día el error medio fue ${num(maeDia, 2)} t/h. El modelo se entrenó solo con los días anteriores.`}
                  fuente="notebook 08, secciones 3 y 5 · outputs/tables/serie2_predicciones_p3.csv"
                >
                  <GraficoMedidoEstimado puntos={puntosDia} dia={fechaCorta(diaVapor)} />
                </Figura>
              }
              contexto={
                <p>
                  Sirve para vigilar la caldera y estimar el vapor cuando el medidor falla. La caída de presión entre el
                  domo y el colector ya funciona como un segundo medidor. En las calderas de bagazo, el primer paso es
                  confirmar que existen las dos presiones.
                </p>
              }
              certeza={{
                nivel: "alta", // fuente: notebook 08, "Evaluación gerencial" > "Nivel de certeza"
                motivo: (
                  <>
                    Gana en días que el modelo no vio y tiene la forma física correcta. La banda de error cubrió el{" "}
                    {pctJunto(coberturaBanda, 0)} con meta de 90 %: certeza media en la banda.
                  </>
                ),
              }}
              caso={{ href: "/caldera", texto: "Ver el caso de la caldera" }}
              herramienta={{ href: "/herramientas#caldera", texto: "Probar el sensor virtual con fallas simuladas" }}
              consulta="POST /caldera/vapor-virtual"
            />
          </Seccion>
        </div>

        {/* ── Mercado ───────────────────────────────────────────────────────── */}
        <div className={s.banda}>
          <Seccion
            id="mercado"
            serie="mercado"
            titulo={<><span className={s.junto}>El precio no se adivina,</span> pero se acota</>}
            entrada={
              <p>
                Recomiendo presupuestar con el precio de hoy como centro y una banda según la volatilidad, y fijar más
                volumen cuando la banda se ensancha.
              </p>
            }
            cifras={
              <div className={s.cifras} data-apilar="">
                <Cifra
                  valor={`${num(banda.p10, 2)} a ${num(banda.p90, 2)}`}
                  unidad="¢/lb"
                  etiqueta={`Banda de 80 % para el promedio de ${mesH1.replace(" ", " de ")}`}
                  detalle={`Centro: el precio de hoy (último cierre), ${num(banda.centro, 2)} ¢/lb. El promedio real hasta el día ${diaCorte}, ${num(realParcial, 2)} ¢/lb, quedó ${dentro ? "dentro" : "fuera"}.`}
                />
                <Cifra
                  valor={num(errorUltimoCierre, 1)}
                  unidad="%"
                  etiqueta="Error típico de usar el precio de hoy como pronóstico a 1 mes"
                  detalle={`Medido en ${mesesFueraDeMuestra} meses que el modelo no vio. Ningún modelo que probé lo mejora · notebook 12`}
                />
              </div>
            }
          >
            <Capitulo
              figura={
                <Figura
                  numero={3}
                  ancho="total"
                  titulo="El centro es el precio de hoy; la banda dice cuánto puede moverse"
                  nota={
                    <>
                      Línea gris: promedio mensual real. Desde el último cierre ({num(pronosticoPrecio.ultimo_cierre, 2)}{" "}
                      ¢/lb, {fechaOrigen}): raya gruesa, banda de 80&nbsp;%; raya fina, banda de 95&nbsp;%. El círculo vacío
                      es el promedio real de {mesParcial} hasta el día {diaCorte} ({num(realParcial, 2)} ¢/lb): quedó{" "}
                      {dentro ? "dentro" : "fuera"} de la banda de 80&nbsp;%.
                    </>
                  }
                  fuente="notebook 12 · outputs/models/serie3_pronostico.json y outputs/tables/serie3_resumen_p3.json"
                >
                  <GraficoBanda
                    reales={realesRecientes}
                    bandas={bandasVigentes}
                    origen={{ fecha: pronosticoPrecio.fecha_origen, valor: pronosticoPrecio.ultimo_cierre }}
                    realParcial={{ fecha: bandasVigentes[0].fecha, valor: realParcial }}
                    etiqueta={`Promedios mensuales del azúcar No. 11 hasta ${MESES[Number(pronosticoPrecio.fecha_origen.slice(5, 7)) - 1]} de ${pronosticoPrecio.fecha_origen.slice(0, 4)} y banda del pronóstico: ${bandasVigentes.map((b) => `${b.mes} de ${num(b.p10, 2)} a ${num(b.p90, 2)} ¢/lb`).join(" y ")} con 80 % de probabilidad.`}
                  />
                </Figura>
              }
              contexto={
                <p>
                  Sirve para decidir qué precio del azúcar presupuestar y cuánto volumen fijar. Ningún modelo que probé le
                  gana al precio de hoy: lo que sí se estima bien es el rango.
                </p>
              }
              certeza={{
                nivel: "alta", // fuente: notebook 12, "Evaluación gerencial" > "Nivel de certeza"
                motivo: (
                  <>
                    Pruebas formales en {mesesFueraDeMuestra} meses que el modelo no vio, y la banda a 1 mes cubre cerca de
                    lo que promete. A 3 meses, la banda tiene certeza media.
                  </>
                ),
              }}
              caso={{ href: "/mercado", texto: "Ver el caso del mercado" }}
              herramienta={{ href: "/herramientas#mercado", texto: "Calcular el rango y el ingreso sin fijar" }}
              consulta="GET /mercado/pronostico"
            />
          </Seccion>
        </div>
      </div>

      {/* ── Método ────────────────────────────────────────────────────────── */}
      <Seccion
        id="metodo"
        titulo={<><span className={s.junto}>Se traslada el método,</span> no las cifras</>}
        entrada={
          <p>
            Los datos son públicos y de otros lugares. Las variedades y los valores no se trasladan al ingenio; estas
            cuatro reglas sí.
          </p>
        }
        cifras={
          <div className={s.fuentes}>
            {/* fuente: README.md, "Cómo ejecutar" y resúmenes de las Series I a III */}
            <h3>Los datos públicos que usé</h3>
            <dl>
              <div data-serie="campo">
                <dt>Campo</dt>
                <dd>Ensayos de caña de Louisiana, 2010-2021</dd>
              </div>
              <div data-serie="caldera">
                <dt>Caldera</dt>
                <dd>Una caldera de lecho fluidizado a carbón en China, 5 días de operación</dd>
              </div>
              <div data-serie="mercado">
                <dt>Mercado</dt>
                <dd>FAOSTAT y el contrato de futuros de azúcar No.&nbsp;11</dd>
              </div>
            </dl>
          </div>
        }
      >
        {/* Cada regla es una fila: la regla y su frase a la izquierda; a la derecha, la prueba (los ejemplos de las
            tres series o, en "Validar como se usaría", la Figura 4, y entonces los ejemplos van bajo la frase). */}
        <ul className={s.reglas}>
          <li className={s.regla}>
            <div className={s.reglaTexto}>
              <h3>Auditar los datos antes de modelar</h3>
              <p>Cada serie traía una trampa en el archivo. Si no la encontraba antes, el modelo la aprendía.</p>
            </div>
            <div className={s.reglaPrueba}>
              <ul className={s.casos} aria-label="Ejemplos en campo, caldera y mercado">
                <li data-serie="campo">
                  <span className={s.marca}>Campo</span>
                  <span>
                    El {num((filasComa / filasOriginales) * 100, 1)} % de las filas traía coma decimal, y el azúcar
                    venía en libras por acre, no en toneladas.
                  </span>
                </li>
                <li data-serie="caldera">
                  <span className={s.marca}>Caldera</span>
                  <span>
                    El segundo archivo inventaba {resumenCalderaP1.celdas_distintas_autoreg} valores al rellenar huecos
                    con un modelo. Trabajé con el original.
                  </span>
                </li>
                <li data-serie="mercado">
                  <span className={s.marca}>Mercado</span>
                  <span>
                    La serie del precio pegaba contratos distintos: {resumenMercadoP2.dias_cambio} saltos que no son
                    mercado. Los corregí.
                  </span>
                </li>
              </ul>
              <p className={s.refs}>
                <a href={archivoRepo("bitacora.md")}>Detalle en la bitácora de decisiones: D1, D2, D42 y D58</a>
              </p>
            </div>
          </li>

          <li className={s.regla}>
            <div className={s.reglaTexto}>
              <h3>Probar contra el azar antes de hablar de grupos o ciclos</h3>
              <p>
                Un algoritmo de grupos siempre devuelve grupos. Por eso comparo contra datos simulados sin grupos. En
                ninguna serie aparecieron grupos naturales: uso los grupos como tipologías útiles, no como hechos.
              </p>
            </div>
            <div className={s.reglaPrueba}>
              <ul className={s.casos} aria-label="Ejemplos en campo, caldera y mercado">
                <li data-serie="campo">
                  <span className={s.marca}>Campo</span>
                  <span>
                    Las variedades forman un continuo entre tonelaje y calidad. Uso {resumenCampoP3.k} perfiles porque se
                    reproducen al remuestrear.
                  </span>
                </li>
                <li data-serie="caldera">
                  <span className={s.marca}>Caldera</span>
                  <span>No hay modos de operación separados: la carga manda.</span>
                </li>
                <li data-serie="mercado">
                  <span className={s.marca}>Mercado</span>
                  <span>
                    {/* fuente del umbral de 20 % y del rango 5-95 %: notebook 11, sección de ciclos */}
                    El precio dio {resumenMercadoP2.fases_20} giros de 20 % (se aleja 20 % de su último pico o valle). Un
                    precio que se mueve al azar, con la misma volatilidad, da entre {girosPaseoMin} y {girosPaseoMax}: los
                    ciclos no se distinguen del azar.
                  </span>
                </li>
              </ul>
              <p className={s.refs}>
                <a href={archivoRepo("bitacora.md")}>Detalle en la bitácora de decisiones: D31, D47, D56 y D59</a>
              </p>
            </div>
          </li>

          <li className={s.regla}>
            <div className={s.reglaTexto}>
              <h3>Validar como se usaría</h3>
              <p>
                Siempre hacia adelante en el tiempo: el modelo solo ve lo que se sabía en la fecha de la decisión. Validar
                al azar habría prometido entre {num(optimismoMin, 0)} % y {num(optimismoMax, 0)} % menos error que el
                real.
              </p>
              <ul className={s.casos} aria-label="Ejemplos en campo, caldera y mercado">
                <li data-serie="campo">
                  <span className={s.marca}>Campo</span>
                  <span>Por zafra: entreno con los años anteriores y predigo el siguiente.</span>
                </li>
                <li data-serie="caldera">
                  <span className={s.marca}>Caldera</span>
                  <span>Por día: entreno con días pasados y predigo uno que el modelo no vio.</span>
                </li>
                <li data-serie="mercado">
                  <span className={s.marca}>Mercado</span>
                  <span>Mes a mes desde {primerOrigen}: cada pronóstico usa solo los precios que ya se conocían.</span>
                </li>
              </ul>
              <p className={s.refs}>
                <a href={archivoRepo("bitacora.md")}>Detalle en la bitácora de decisiones: D22, D48, D61 y H16</a>
              </p>
            </div>
            <div className={s.reglaPrueba} data-serie="caldera">
              <Figura
                numero={4}
                ancho="total"
                titulo={`Validar al azar promete hasta ${num(optimismoMax, 0)} % menos error que el real`}
                nota={
                  <>
                    Error medio de tres modelos del sensor virtual de vapor según cómo se validan. Anillo: minutos
                    mezclados al azar. Punto: entrenar con días pasados y predecir un día que el modelo no vio, como se
                    usaría. El porcentaje junto al anillo dice cuánto menos error promete la validación al azar. El{" "}
                    {masEnganado.modelo.toLowerCase()} es el más engañado.
                  </>
                }
                fuente="notebook 08 · outputs/tables/serie2_resumen_p3.json"
              >
                <GraficoValidacion filas={validacion} />
              </Figura>
            </div>
          </li>

          <li className={s.regla}>
            <div className={s.reglaTexto}>
              <h3>Simple antes que complejo</h3>
              <p>
                Si un modelo complejo no gana con significancia, me quedo con el simple, porque se explica. En las tres
                series el lineal o el ingenuo empató o ganó.
              </p>
            </div>
            <div className={s.reglaPrueba}>
              <ul className={s.casos} aria-label="Ejemplos en campo, caldera y mercado">
                <li data-serie="campo">
                  <span className={s.marca}>Campo</span>
                  <span>
                    {/* fuente de la significancia y los 3 coeficientes: bitácora D26 */}
                    El modelo lineal (Ridge) erra {num(ridgeCampo.MAE, 0)} lb/acre y uno de árboles (random forest),{" "}
                    {num(bosqueCampo.MAE, 0)}. La diferencia no es significativa, y el lineal se explica con 3
                    coeficientes.
                  </span>
                </li>
                <li data-serie="caldera">
                  <span className={s.marca}>Caldera</span>
                  <span>
                    El lineal erra {num(ridge.MAE_t_h, 2)} t/h y el de árboles (gradient boosting),{" "}
                    {num(boosting.MAE_t_h, 2)} t/h: gana el lineal.
                  </span>
                </li>
                <li data-serie="mercado">
                  <span className={s.marca}>Mercado</span>
                  <span>
                    Un modelo de series de tiempo (ARIMA) erra {num(arimaPeor, 0)} % más a 1 mes que repetir el último
                    cierre.
                  </span>
                </li>
              </ul>
              <p className={s.refs}>
                <a href={archivoRepo("bitacora.md")}>Detalle en la bitácora de decisiones: D26, H15 y H22</a>
              </p>
            </div>
          </li>
        </ul>
      </Seccion>

      {/* ── Producción ────────────────────────────────────────────────────── */}
      <Seccion
        id="produccion"
        titulo={<><span className={s.junto}>Los modelos ya corren</span> en producción</>}
        entrada={
          <p>
            Los notebooks exportan los modelos en JSON. La API los lee sin reentrenar; las herramientas y el asistente la
            consultan.
          </p>
        }
        cifras={
          <div className={s.cifras} data-columnas="3">
            <Cifra
              valor={num(CONSULTAS_API)}
              etiqueta="Consultas en la API"
              detalle="Con validación de entradas y documentación OpenAPI."
            />
            <Cifra
              valor={num(PRUEBAS_DOCKER)}
              etiqueta="Pruebas aprobadas en Docker"
              detalle="La API reproduce las cifras de los notebooks; incluye PostgreSQL 16."
            />
            <Cifra
              valor={num(HERRAMIENTAS_ASISTENTE.total)}
              etiqueta="Herramientas del asistente"
              detalle={`Gemini las pide y redacta con su respuesta; ${HERRAMIENTAS_ASISTENTE.deLaApi} son las mismas funciones de la API.`}
            />
          </div>
        }
      >
        {/* La prueba en vivo: el navegador le pregunta a la API al abrir la portada */}
        <ApiEnVivo />
        <Tabla<Pieza>
          titulo="Qué puse en producción y por qué así"
          ancho="total"
          movil="apilar"
          columnas={[
            { clave: "pieza", titulo: "Pieza", ancho: "14%" },
            { clave: "hace", titulo: "Qué hace", ancho: "43%" },
            { clave: "porque", titulo: "Por qué así", ancho: "43%" },
          ]}
          filas={piezas}
        />
        <div className={s.anchoTabla}>
          <Desplegable titulo="Seguridad, límites y costos">
            {/* fuente: README.md, Serie IV, "Seguridad y límite de uso", "Costos" y "Pruebas" */}
            <p>
              La API es pública y sin llave, así que cada IP tiene 40 consultas por minuto y 300 por día, con un tope de
              5,000 diarias. El asistente tiene una cuota aparte: 30 preguntas por IP al día, 5 por minuto y 300 en total.
              Al pasarse, responde 429 con un mensaje en español.
            </p>
            <p>
              Solo la consultan edgarsierra.com, los dominios del proyecto en Vercel y localhost (CORS). Cada campo tiene
              un rango físico o económico, y los errores de validación (422) nombran en español el campo que hay que
              corregir. No hay secretos en el repositorio: Cloud Run entra a Vertex AI con su cuenta de servicio.
            </p>
            <p>
              Cloud Run escala a cero cuando nadie la usa, el sitio es estático en el plan gratuito de Vercel y Vertex AI
              cobra por pregunta, con la cuota como tope. Corro las {PRUEBAS_DOCKER} pruebas antes de cada despliegue;
              todavía no hay integración continua.
            </p>
          </Desplegable>
        </div>
      </Seccion>

      {/* ── Verificar ─────────────────────────────────────────────────────── */}
      <Seccion
        id="verificar"
        titulo="Cada cifra se puede revisar y recalcular"
        entrada={
          <p>
            El repositorio trae el código, los notebooks ejecutados, las pruebas y la bitácora. Cada cifra sale de un
            archivo que exporta un notebook.
          </p>
        }
        cifras={
          <div className={s.cifras} data-columnas="3">
            <Cifra valor={num(BITACORA.decisiones)} etiqueta="Decisiones técnicas registradas" detalle="Cada una dice cómo la verifiqué." />
            <Cifra valor={num(BITACORA.hipotesis)} etiqueta="Hipótesis descartadas" detalle="Con el dato que las descartó." />
            <Cifra
              valor={num(BITACORA.erroresIa)}
              etiqueta="Errores de fondo de la IA corregidos"
              detalle="De método, de cálculo o afirmaciones sin respaldo."
            />
          </div>
        }
      >
        <div className={s.verificar}>
          <div>
            <h3>Dónde revisarlo</h3>
            <ul className={s.enlaces}>
              <li>
                <a href={REPO}>
                  <span className={s.enlaceTitulo}>Repositorio en GitHub</span>
                  <span className={s.enlaceRuta}>código y notebooks</span>
                </a>
              </li>
              <li>
                <a href={archivoRepo("bitacora.md")}>
                  <span className={s.enlaceTitulo}>Bitácora de decisiones</span>
                  <span className={s.enlaceRuta}>bitacora.md</span>
                </a>
              </li>
              <li>
                <a href={`${REPO}/tree/main/notebooks`}>
                  <span className={s.enlaceTitulo}>Notebooks 01 a {NOTEBOOKS}</span>
                  <span className={s.enlaceRuta}>notebooks/</span>
                </a>
              </li>
              <li>
                <a href={archivoRepo("outputs/tests/pytest_docker.txt")}>
                  <span className={s.enlaceTitulo}>Salida de las pruebas</span>
                  <span className={s.enlaceRuta}>outputs/tests/pytest_docker.txt</span>
                </a>
              </li>
              <li>
                <a href={archivoRepo("docs/api.md")}>
                  <span className={s.enlaceTitulo}>Documentación de la API</span>
                  <span className={s.enlaceRuta}>docs/api.md</span>
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3>Cómo reproducirlo</h3>
            <pre className={s.codigo}>
              <code>{"docker compose up --build\ndocker compose --profile pruebas run --rm pruebas"}</code>
            </pre>
            <p>
              La primera línea levanta la API; la segunda corre las {PRUEBAS_DOCKER} pruebas. Los notebooks se corren en
              orden desde <code>notebooks/</code>. Los datasets son públicos y no van en el repositorio: el README dice de
              dónde bajarlos.
            </p>
            <h3>Cómo usé la IA</h3>
            {/* fuente: README.md, "Uso de IA" (Claude y Claude Code; revisión de cifras por un agente separado) */}
            <p>
              Usé IA (Claude y Claude Code) como asistente para escribir código y revisar cifras. Las preguntas, los
              métodos y las decisiones son míos, y no acepté ningún resultado sin verificarlo con los datos. Al cerrar
              cada serie, un agente de IA separado, que no participó en el análisis, comparó cada cifra contra las
              salidas de los notebooks, y corregí todo lo que encontró.
            </p>
          </div>
        </div>
      </Seccion>
    </>
  );
}
