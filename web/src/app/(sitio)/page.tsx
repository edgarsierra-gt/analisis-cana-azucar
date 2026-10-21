import Link from "next/link";
import { Cifra, FilaCifras } from "@/components/Cifra";
import type { NivelCerteza } from "@/components/Certeza";
import { Figura } from "@/components/Figura";
import { Nota } from "@/components/Nota";
import { Portada } from "@/components/Portada";
import { Seccion } from "@/components/Seccion";
import limpieza from "@/datos/serie1_limpieza.json";
import recomendacion from "@/datos/serie1_recomendacion.json";
import resumenCampoP2 from "@/datos/serie1_resumen_p2.json";
import resumenCampoP3 from "@/datos/serie1_resumen_p3.json";
import resumenCampoQ1 from "@/datos/serie1_resumen_q1.json";
import resumenCalderaP1 from "@/datos/serie2_resumen_p1.json";
import resumenCalderaP3 from "@/datos/serie2_resumen_p3.json";
import resumenMercadoP2 from "@/datos/serie3_resumen_p2.json";
import resumenMercadoP3 from "@/datos/serie3_resumen_p3.json";
import pronosticosH1 from "@/datos/serie3_pronosticos_h1.json";
import { archivoRepo, REPO } from "@/lib/base";
import { conSigno, num, pct, usd } from "@/lib/formato";
import { BloqueSerie } from "./_inicio/BloqueSerie";
import { GraficoValidacion, type FilaValidacion } from "./_inicio/GraficoValidacion";
import s from "./_inicio/inicio.module.css";

// Cifras que no están en ningún JSON de src/datos: se escriben a mano con su fuente.
// fuente: README.md, lista de notebooks 01 a 13
const NOTEBOOKS = 13;
// fuente: docs/api.md, tabla "Consultas", y /openapi.json de la API (14 rutas, incluidas /salud y las 2 del asistente)
const CONSULTAS_API = 14;
// fuente: bitacora.md, "Resumen" > "Uso de IA en números"
const BITACORA = { decisiones: 83, hipotesis: 24, erroresIa: 34 };
// fuente: outputs/tests/pytest_docker.txt ("120 passed")
const PRUEBAS_DOCKER = 120;

export default function Inicio() {
  // ── Serie I · Campo (notebook 02) ──
  const top3 = [...recomendacion].sort((a, b) => a.rank - b.rank).slice(0, 3);
  const [v1, v2, v3] = top3;
  const ganaMinimo = Math.min(...top3.map((v) => v.P_gana_a_testigos));
  const socaMaxValidacion = Math.max(v2.ultimo_corte_medido, v3.ultimo_corte_medido);
  const replicas = resumenCampoQ1.bootstrap.replicas;
  const referencia = resumenCampoQ1.referencia;

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
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const [anioOrigen, mesOrigen] = pronosticosH1[0].origen.split("-").map(Number);
  const primerOrigen = `${MESES[mesOrigen - 1]} de ${anioOrigen}`;

  // ── Ejemplos del método ──
  const filasOriginales = limpieza.find((f) => f.Regla === "filas_originales")?.Filas ?? 0;
  const filasComa = limpieza.find((f) => f.Regla.includes("coma decimal"))?.Filas ?? 0;
  const ridgeCampo = resumenCampoP2.metricas_e1.Ridge;
  const bosqueCampo = resumenCampoP2.metricas_e1["Random Forest"];

  return (
    <>
      <Portada
        etiqueta="Prueba técnica · ciencia de datos"
        titulo="Un ingenio decide qué sembrar, cómo operar su caldera y cuándo vender"
        entrada={
          <p>
            Analicé las tres decisiones con datos públicos y un mismo método. Cada recomendación trae su cifra, su
            nivel de certeza y el notebook de donde sale.
          </p>
        }
        meta={[
          { clave: "Autor", valor: "Edgar Sierra" },
          { clave: "Análisis", valor: `3 series · ${NOTEBOOKS} notebooks` },
          { clave: "API", valor: `${CONSULTAS_API} consultas` },
          { clave: "Datos", valor: "Públicos: ensayos de Louisiana, una caldera en China y el mercado mundial" },
        ]}
      />

      <Seccion
        id="decisiones"
        numero="01"
        etiqueta="Tres series, tres decisiones"
        titulo="Tres variedades que ganan, un medidor de vapor que ya existía y un precio que se acota pero no se adivina"
      >
        <div className={s.series}>
          <BloqueSerie
            serie="campo"
            rotulo="Serie I · Campo"
            decision="Qué variedades ampliar y cada cuántos cortes renovar un lote."
            hallazgo={`Tres variedades ganan al testigo y conviene renovar cada ${v1.ciclo_optimo} cortes`}
            cifras={
              <>
                <Cifra
                  valor={conSigno(v1.ganancia_vs_testigos, 0)}
                  unidad="US$/acre/año"
                  etiqueta={`${v1.CLONE} contra el testigo promedio`}
                  detalle={`Intervalo de 90 %: de ${num(v1.ganancia_p05, 0)} a ${num(v1.ganancia_p95, 0)} · notebook 02`}
                />
                <Cifra
                  valor={num(v1.ciclo_optimo)}
                  unidad="cortes"
                  etiqueta="Ciclo de renovación con mejor margen anual"
                  detalle={`Plantía y ${v1.ciclo_optimo - 1} socas. El testigo promedio, con ${referencia.ciclo} cortes, deja ${usd(referencia.margen, 1)}/acre/año.`}
                />
              </>
            }
            recomiendo={
              <>
                Recomiendo ampliar {v1.CLONE} y llevar {v2.CLONE} y {v3.CLONE} a escala de validación: solo tienen datos
                hasta la soca {socaMaxValidacion}. Para el ingenio es un protocolo, no una lista de compra.
              </>
            }
            certeza={{
              nivel: v1.nivel_certeza_top3 as NivelCerteza,
              motivo: (
                <>
                  Las tres ganan al testigo en el {pct(ganaMinimo * 100, 0)} de {num(replicas)} remuestreos de los
                  ensayos. {v3.CLONE} queda entre las tres primeras en el {pct(v3.P_top3 * 100, 0)}: certeza{" "}
                  {v3.nivel_certeza_top3} para ella.
                </>
              ),
            }}
            enlace={{ href: "/campo", texto: "Ver el caso de campo" }}
          />

          <BloqueSerie
            serie="caldera"
            rotulo="Serie II · Caldera"
            decision="Cómo vigilar la caldera y estimar el vapor cuando el medidor falla."
            hallazgo="La caída de presión entre el domo y el colector ya funciona como un segundo medidor de vapor"
            cifras={
              <>
                <Cifra
                  valor={num(ridge["MAPE_%"], 2)}
                  unidad="%"
                  etiqueta="Error del sensor virtual: el vapor estimado con los demás sensores"
                  detalle={`${num(ridge.MAE_t_h, 2)} t/h en promedio, medido en días que el modelo no vio · notebook 08`}
                />
                <Cifra
                  valor={num(hidraulico["MAPE_%"], 1)}
                  unidad="%"
                  etiqueta="Error con una sola variable: la caída de presión"
                  detalle="Es la física de un medidor de flujo: el vapor crece con √(ΔP·ρ)."
                />
              </>
            }
            recomiendo={
              <>
                Recomiendo poner en línea el sensor virtual y usar la diferencia entre lo medido y lo estimado como
                alarma de que el medidor se desvía. En las calderas de bagazo, el primer paso es confirmar que existen
                las dos presiones.
              </>
            }
            certeza={{
              nivel: "alta", // fuente: notebook 08, "Evaluación gerencial" > "Nivel de certeza"
              motivo: (
                <>
                  Gana en días que el modelo no vio y tiene la forma física correcta. La banda de error cubrió el{" "}
                  {pct(coberturaBanda, 0)} con meta de 90 %: certeza media en la banda.
                </>
              ),
            }}
            enlace={{ href: "/caldera", texto: "Ver el caso de la caldera" }}
          />

          <BloqueSerie
            serie="mercado"
            rotulo="Serie III · Mercado"
            decision="Qué precio del azúcar presupuestar y cuánto volumen fijar."
            hallazgo="Ningún modelo que probé le gana al precio de hoy: lo que sí se estima bien es el rango"
            cifras={
              <>
                <Cifra
                  valor={`${num(banda.p10, 2)} a ${num(banda.p90, 2)}`}
                  unidad="¢/lb"
                  etiqueta={`Banda de 80 % para el promedio de ${mesH1.replace(" ", " de ")}`}
                  detalle={`Centro: el precio de hoy (último cierre), ${num(banda.centro, 2)} ¢/lb. El promedio real hasta el día ${diaCorte}, ${num(realParcial, 2)} ¢/lb, quedó ${dentro ? "dentro" : "fuera"}.`}
                />
                <Cifra
                  valor={num(errorUltimoCierre, 1)}
                  unidad="%"
                  etiqueta="Error típico de usar el precio de hoy como pronóstico a 1 mes"
                  detalle={`Medido en ${mesesFueraDeMuestra} meses que el modelo no vio. Ningún modelo que probé lo mejora · notebook 12`}
                />
              </>
            }
            recomiendo={
              <>
                Recomiendo presupuestar con el precio de hoy como centro y una banda que se ajusta a la volatilidad, y
                fijar más volumen cuando esa banda se ensancha.
              </>
            }
            certeza={{
              nivel: "alta", // fuente: notebook 12, "Evaluación gerencial" > "Nivel de certeza"
              motivo: (
                <>
                  Pruebas formales en {mesesFueraDeMuestra} meses que el modelo no vio, y la banda a 1 mes cubre cerca
                  de lo que promete. A 3 meses, la banda tiene certeza media.
                </>
              ),
            }}
            enlace={{ href: "/mercado", texto: "Ver el caso del mercado" }}
          />
        </div>

        <Nota tipo="limite" titulo="Los datos son públicos y de otros lugares">
          {/* fuente: README.md, "Cómo ejecutar" y resúmenes de las Series I a III */}
          <p>
            Ensayos de caña de Louisiana (2010-2021), una caldera de lecho fluidizado a carbón en China (5 días de
            operación) y el mercado mundial (FAOSTAT y el contrato de futuros de azúcar No. 11). Las variedades y los
            valores no se trasladan al ingenio; el método sí.
          </p>
        </Nota>
      </Seccion>

      <Seccion
        id="metodo"
        numero="02"
        etiqueta="Cómo trabajé"
        titulo="Cuatro reglas que se repiten en las tres series"
        entrada={<p>Usé el mismo método en campo, caldera y mercado. Estos son los ejemplos donde más pesó cada regla.</p>}
      >
        <ol className={s.reglas}>
          <li className={s.regla}>
            <span className={s.numeroRegla} aria-hidden="true">1</span>
            <h3 className={s.tituloRegla}>Auditar los datos antes de modelar</h3>
            <div className={s.cuerpoRegla}>
              <p>Cada serie traía una trampa en el archivo. Si no la encontraba antes, el modelo la aprendía.</p>
              <ul className={s.casos}>
                <li data-serie="campo">
                  <span className={s.marca}>Campo</span>
                  <span>
                    El {num((filasComa / filasOriginales) * 100, 1)} % de las filas traía coma decimal, y el azúcar venía
                    en libras por acre, no en toneladas.
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
                <a href={archivoRepo("bitacora.md")}>Bitácora</a>: D1, D2, D42 y D58
              </p>
            </div>
          </li>

          <li className={s.regla}>
            <span className={s.numeroRegla} aria-hidden="true">2</span>
            <h3 className={s.tituloRegla}>Probar contra el azar antes de hablar de grupos o ciclos</h3>
            <div className={s.cuerpoRegla}>
              <p>
                Un algoritmo de grupos siempre devuelve grupos. Por eso comparo contra datos simulados sin grupos. En
                ninguna serie aparecieron grupos naturales: uso los grupos como tipologías útiles, no como hechos.
              </p>
              <ul className={s.casos}>
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
                    {/* fuente del umbral de 20 % y del rango 5-95 %: notebook 11, sección de ciclos */}
                    El precio dio {resumenMercadoP2.fases_20} giros de 20 % (se aleja 20 % de su último pico o valle). Un
                    precio que se mueve al azar, con la misma volatilidad, da entre {girosPaseoMin} y {girosPaseoMax}: los
                    ciclos no se distinguen del azar.
                  </span>
                </li>
              </ul>
              <p className={s.refs}>
                <a href={archivoRepo("bitacora.md")}>Bitácora</a>: D31, D47, D56 y D59
              </p>
            </div>
          </li>

          <li className={s.regla}>
            <span className={s.numeroRegla} aria-hidden="true">3</span>
            <h3 className={s.tituloRegla}>Validar como se usaría</h3>
            <div className={s.cuerpoRegla}>
              <p>
                Siempre hacia adelante en el tiempo: el modelo solo ve lo que se sabía en la fecha de la decisión.
                Validar al azar habría prometido entre {num(optimismoMin, 0)} % y {num(optimismoMax, 0)} % menos error que
                el real.
              </p>
              <ul className={s.casos}>
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
                  <span>
                    Mes a mes desde {primerOrigen}: cada pronóstico usa solo los precios que ya se conocían.
                  </span>
                </li>
              </ul>
              <div className={s.figuraRegla} data-serie="caldera">
                <Figura
                  numero={1}
                  ancho="texto"
                  titulo={`Validar al azar promete hasta ${num(optimismoMax, 0)} % menos error que el real`}
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
              <p className={s.refs}>
                <a href={archivoRepo("bitacora.md")}>Bitácora</a>: D22, D48, D61 y H16
              </p>
            </div>
          </li>

          <li className={s.regla}>
            <span className={s.numeroRegla} aria-hidden="true">4</span>
            <h3 className={s.tituloRegla}>Simple antes que complejo</h3>
            <div className={s.cuerpoRegla}>
              <p>
                Si un modelo complejo no gana con significancia, me quedo con el simple, porque se explica. En las tres
                series el lineal o el ingenuo empató o ganó.
              </p>
              <ul className={s.casos}>
                <li data-serie="campo">
                  <span className={s.marca}>Campo</span>
                  <span>
                    {/* fuente de la significancia y los 3 coeficientes: bitácora D26 */}
                    El modelo lineal (Ridge) erra {num(ridgeCampo.MAE, 0)} lb/acre y uno de árboles (random forest),{" "}
                    {num(bosqueCampo.MAE, 0)}. La diferencia no es significativa, y el lineal se explica con 3
                    coeficientes.
                  </span>
                </li>
                <li data-serie="caldera">
                  <span className={s.marca}>Caldera</span>
                  <span>
                    El lineal erra {num(ridge.MAE_t_h, 2)} t/h y el de árboles (gradient boosting),{" "}
                    {num(boosting.MAE_t_h, 2)} t/h: gana el lineal.
                  </span>
                </li>
                <li data-serie="mercado">
                  <span className={s.marca}>Mercado</span>
                  <span>
                    Un modelo de series de tiempo (ARIMA) erra {num(arimaPeor, 0)} % más a 1 mes que repetir el último
                    cierre.
                  </span>
                </li>
              </ul>
              <p className={s.refs}>
                <a href={archivoRepo("bitacora.md")}>Bitácora</a>: D26, H15 y H22
              </p>
            </div>
          </li>
        </ol>
      </Seccion>

      <Seccion
        id="operacion"
        numero="03"
        etiqueta="Del análisis a la operación"
        titulo="Los modelos se consultan sin abrir un notebook"
      >
        <ul className={s.destinos}>
          <li>
            <Link href="/api" className={s.destino}>
              <span className="etiqueta">Serie IV</span>
              <span className={s.destinoTitulo}>
                API <span className={s.flecha} aria-hidden="true">→</span>
              </span>
              <span className={s.destinoTexto}>
                {CONSULTAS_API} consultas con los modelos de las tres series, validación de entradas y documentación
                OpenAPI. Lee los JSON de los notebooks; no vuelve a entrenar.
              </span>
            </Link>
          </li>
          <li>
            <Link href="/herramientas" className={s.destino}>
              <span className="etiqueta">Para probar</span>
              <span className={s.destinoTitulo}>
                Herramientas <span className={s.flecha} aria-hidden="true">→</span>
              </span>
              <span className={s.destinoTexto}>
                Calculadoras de campo, caldera y mercado que llaman a la misma API: se cambia un supuesto y se ve qué
                responde el modelo.
              </span>
            </Link>
          </li>
          <li>
            <Link href="/presentacion" className={s.destino}>
              <span className="etiqueta">Serie V</span>
              <span className={s.destinoTitulo}>
                Presentación <span className={s.flecha} aria-hidden="true">→</span>
              </span>
              <span className={s.destinoTexto}>
                Las tres decisiones en diapositivas, con la evaluación gerencial de cada serie. Se proyecta o se imprime
                en PDF.
              </span>
            </Link>
          </li>
        </ul>
      </Seccion>

      <Seccion
        id="verificar"
        numero="04"
        etiqueta="Cómo verificarlo"
        titulo="Cada cifra se puede revisar y volver a calcular"
        entrada={
          <p>
            El repositorio trae el código, los notebooks ejecutados, las pruebas y la bitácora de decisiones. Cada cifra
            de los análisis sale de un archivo que exporta un notebook.
          </p>
        }
      >
        <FilaCifras columnas={4}>
          <Cifra valor={num(BITACORA.decisiones)} etiqueta="Decisiones técnicas registradas" detalle="Cada una dice cómo la verifiqué." />
          <Cifra valor={num(BITACORA.hipotesis)} etiqueta="Hipótesis descartadas" detalle="Con el dato que las descartó." />
          <Cifra
            valor={num(BITACORA.erroresIa)}
            etiqueta="Errores de fondo de la IA corregidos"
            detalle="De método, de cálculo o afirmaciones sin respaldo."
          />
          <Cifra
            valor={num(PRUEBAS_DOCKER)}
            etiqueta="Pruebas aprobadas en Docker"
            detalle="La API reproduce las cifras de los notebooks; incluye PostgreSQL 16."
          />
        </FilaCifras>

        <div className={s.verificar}>
          <div>
            <p className="etiqueta">Dónde revisarlo</p>
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
            <p className="etiqueta">Cómo reproducirlo</p>
            <pre className={s.codigo}>
              <code>{"docker compose up --build\ndocker compose --profile pruebas run --rm pruebas"}</code>
            </pre>
            <p className={s.texto}>
              La primera línea levanta la API; la segunda corre las {PRUEBAS_DOCKER} pruebas. Los notebooks se corren en
              orden desde <code>notebooks/</code>. Los datasets son públicos y no van en el repositorio: el README dice
              de dónde bajarlos.
            </p>
            <p className={s.texto}>
              Usé IA como asistente para escribir código y revisar cifras. Las preguntas, los métodos y las decisiones son
              míos, y no acepté ningún resultado sin verificarlo con los datos.
            </p>
          </div>
        </div>
      </Seccion>
    </>
  );
}
