import type { Metadata } from "next";
import Link from "next/link";
import { Figura } from "@/components/Figura";
import { IndiceLocal } from "@/components/IndiceLocal";
import { Desplegable, Nota } from "@/components/Nota";
import { Portada } from "@/components/Portada";
import { Seccion } from "@/components/Seccion";
import { Tabla } from "@/components/Tabla";
import { archivoRepo } from "@/lib/base";
import { num } from "@/lib/formato";
import { Chat } from "./_asistente/Chat";
import { HERRAMIENTAS, LIMITES, MODELO, RESPALDO, nombreModelo } from "./_asistente/contrato";
import { DiagramaAsistente } from "./_asistente/Diagrama";
import d from "./_asistente/Diagrama.module.css";
import s from "./_asistente/asistente.module.css";

// Límites y modelos: api/asistente.py, api/main.py y api/limites.py; bitácora D81 y D82 (ver ./_asistente/contrato.ts).
const L = LIMITES;
const modelo = nombreModelo(MODELO);
const respaldo = nombreModelo(RESPALDO);
const nHerramientas = HERRAMIENTAS.length;

export const metadata: Metadata = {
  title: "Asistente",
  description: `Preguntas en lenguaje natural sobre los análisis de campo, caldera y mercado. Un modelo de Vertex AI pide las cifras a la API y responde con su fuente. Hasta ${L.porDia} preguntas por día.`,
};

const NOMBRE_SERIE = { campo: "Campo", caldera: "Caldera", mercado: "Mercado" } as const;

type Fila = Record<string, unknown>;

const LIMITES_FILAS: Fila[] = [
  {
    limite: "Preguntas por visitante",
    valor: `${L.porDia} por día`,
    porque: "Cada pregunta paga llamadas al modelo. El límite acota el costo de la demo.",
  },
  {
    limite: "Ritmo",
    valor: `${L.porMinuto} por minuto`,
    porque: "Frena el uso automático sin estorbar a una persona que pregunta.",
  },
  {
    limite: "Tope del servicio",
    valor: `${L.globalDia} por día`,
    porque: "Pone un techo al costo aunque lleguen muchos visitantes.",
  },
  {
    limite: "Largo de la pregunta",
    valor: `${num(L.maxCaracteres)} caracteres`,
    porque: "Alcanza para una pregunta concreta. El contador debajo del área de texto lo muestra.",
  },
  {
    limite: "Historial",
    valor: `${L.maxHistorial} mensajes`,
    porque: `El navegador manda los últimos, de hasta ${num(L.maxTextoHistorial)} caracteres cada uno. Así el modelo entiende una pregunta como "¿y si el precio baja?".`,
  },
  {
    limite: "Pasos por pregunta",
    valor: `${L.maxPasos} pasos`,
    porque: "Corta el bucle si el modelo no llega a una respuesta.",
  },
  {
    limite: "Largo de la respuesta",
    valor: `${num(L.maxTokensRespuesta)} tokens`,
    porque: "Mantiene las respuestas breves y acota el costo. Un token es un pedazo de palabra.",
  },
  {
    limite: "Conversaciones",
    valor: "No se guardan",
    porque: "Viven en la pestaña del navegador. Al recargar la página se pierden.",
  },
];

const PASOS: { titulo: string; texto: React.ReactNode }[] = [
  {
    titulo: "El navegador manda la pregunta.",
    texto: (
      <>
        Llama a <code>POST /asistente</code> con la pregunta y los últimos {L.maxHistorial} mensajes. La página habla
        directo con la API, sin otro servidor en medio.
      </>
    ),
  },
  {
    titulo: "La API valida la pregunta y cuenta la cuota.",
    texto: (
      <>
        Revisa el largo (de 1 a {num(L.maxCaracteres)} caracteres) y el historial. Después cuenta las preguntas por IP (
        {L.porDia} por día, {L.porMinuto} por minuto y {L.globalDia} al día en total). Si algo no pasa, responde 422 o 429
        y no llama al modelo.
      </>
    ),
  },
  {
    titulo: "La API llama a Vertex AI.",
    texto: (
      <>
        Manda a {modelo} las instrucciones fijas, la lista de {nHerramientas} herramientas y la conversación. Si Vertex
        AI dice que el modelo está saturado, usa {respaldo} por {L.minutosRespaldo} minutos.
      </>
    ),
  },
  {
    titulo: "El modelo pide una herramienta.",
    texto: (
      <>
        No ve los datos: responde con el nombre de una herramienta y sus argumentos. Por ejemplo, el ciclo de renovación
        de HOCP14-885 con el azúcar a US$0.15/lb.
      </>
    ),
  },
  {
    titulo: "La API la ejecuta.",
    texto: (
      <>
        Usa la misma función que su endpoint, que lee los JSON que dejaron los notebooks. La de hallazgos lee el resumen
        de cada serie en el README.
      </>
    ),
  },
  {
    titulo: "La API devuelve el resultado al modelo.",
    texto: <>Si le falta un dato, el modelo pide otra herramienta. Los pasos 4 a 6 se repiten, con un máximo de {L.maxPasos} pasos.</>,
  },
  {
    titulo: "El modelo redacta la respuesta.",
    texto: <>Usa solo lo que devolvieron las herramientas y cita el notebook de origen.</>,
  },
  {
    titulo: "La API responde al navegador.",
    texto: (
      <>
        Manda la respuesta en Markdown, las herramientas que consultó, el modelo que respondió y las preguntas que le
        quedan hoy. No guarda ni registra la pregunta.
      </>
    ),
  },
];

// Forma de la petición y la respuesta (contrato de api/asistente.py). Los valores son de ejemplo.
const EJ_PETICION = `POST /asistente
{
  "pregunta": "¿Qué pasa con el margen de HOCP14-885 si el azúcar baja a US$0.15/lb?",
  "historial": [
    {"rol": "usuario", "texto": "¿Qué variedades conviene ampliar?"},
    {"rol": "asistente", "texto": "…"}
  ]
}`;
const EJ_RESPUESTA = `{
  "respuesta": "Texto en Markdown, con tablas si hacen falta",
  "herramientas": [
    {"nombre": "ciclo_renovacion", "etiqueta": "Ciclo de renovación",
     "argumentos": {…}}
  ],
  "restantes_hoy": 28,
  "modelo": "${MODELO}",
  "pasos": 2
}`;

const CODIGOS: Fila[] = [
  { codigo: "200", cuando: "Respuesta lista." },
  { codigo: "422", cuando: `Pregunta vacía o de más de ${num(L.maxCaracteres)} caracteres.` },
  { codigo: "429", cuando: `Cuota agotada: ${L.porDia} por día, ${L.porMinuto} por minuto o el tope de ${L.globalDia} del servicio.` },
  { codigo: "502", cuando: "El modelo falló o tardó más de 45 s en una llamada. Si estaba saturado, falló también el de respaldo. Esa pregunta no se descuenta." },
  { codigo: "503", cuando: "El asistente no está disponible en ese entorno (por ejemplo, la API en Docker sin acceso a Vertex AI)." },
];

function Codigo({ rotulo, texto }: { rotulo: string; texto: string }) {
  return (
    <div className={s.codigo}>
      <p className={s.rotulo}>{rotulo}</p>
      <pre>
        <code>{texto}</code>
      </pre>
    </div>
  );
}

export default function PaginaAsistente() {
  return (
    <>
      <Portada
        etiqueta="Asistente · Vertex AI"
        titulo="El asistente redacta; las cifras salen de los notebooks"
        entrada={
          <>
            Pregunte en lenguaje natural sobre el campo, la caldera o el mercado. Un modelo de lenguaje decide qué
            consultas de la API hacen falta, la API las ejecuta con los JSON de los notebooks y el modelo responde con esas
            cifras y su fuente.
          </>
        }
        meta={[
          { clave: "Modelo", valor: `${modelo} en Vertex AI, con ${respaldo} de respaldo` },
          { clave: "Límite", valor: `${L.porDia} preguntas por día por visitante` },
          { clave: "Consulta", valor: `${nHerramientas} herramientas de la API, Series I a III` },
          { clave: "Guarda", valor: "Nada: la conversación vive en su navegador" },
        ]}
      />

      <IndiceLocal
        titulo="Asistente"
        items={[
          { id: "preguntar", etiqueta: "Preguntar" },
          { id: "como-funciona", etiqueta: "Cómo funciona" },
          { id: "reglas", etiqueta: "Reglas y límites" },
        ]}
      />

      {/* 01 · El chat */}
      <Seccion
        id="preguntar"
        numero="01"
        etiqueta="Preguntar"
        titulo="Cada respuesta dice qué herramientas consultó"
        entrada={
          <>
            Escriba una pregunta o elija una sugerida. Debajo de cada respuesta verá qué consultas hizo el asistente. Las
            cifras se pueden verificar en los casos de <Link href="/campo">campo</Link>,{" "}
            <Link href="/caldera">caldera</Link> y <Link href="/mercado">mercado</Link>.
          </>
        }
      >
        <Chat />
        <Nota tipo="dato" titulo="Para obtener mejores respuestas">
          <p>
            Nombre la variedad, la finca, el corte o el horizonte que le interesa. Si pregunta por algo que no está en los
            análisis, el asistente se lo dirá en lugar de estimarlo.
          </p>
        </Nota>
      </Seccion>

      {/* 02 · Cómo funciona */}
      <Seccion
        id="como-funciona"
        numero="02"
        etiqueta="Cómo funciona"
        titulo="El modelo no lee los datos: pide herramientas y la API las ejecuta"
        entrada="Las herramientas son las mismas funciones de los endpoints de la API, que leen los JSON que dejan los notebooks. El modelo solo ve lo que esas funciones devuelven y redacta con eso."
      >
        <Figura
          numero={1}
          ancho="total"
          titulo="El modelo pide las cifras a la API en lugar de escribirlas de memoria"
          nota="Los números siguen una pregunta, del 1 al 8. Las líneas punteadas encierran cada servicio. Las flechas discontinuas son los rechazos: 422 si la pregunta no pasa la validación y 429 si se acabó la cuota. En los dos casos la API no llama al modelo."
          fuente="api/asistente.py · api/limites.py"
        >
          <DiagramaAsistente herramientas={nHerramientas} />
        </Figura>

        <ol className={d.pasos} role="list" aria-label="Pasos del diagrama">
          {PASOS.map((p) => (
            <li key={p.titulo}>
              <p>
                <strong>{p.titulo}</strong> {p.texto}
              </p>
            </li>
          ))}
        </ol>

        <div className={s.medio}>
          <Tabla
            titulo={`Las ${nHerramientas} herramientas que puede pedir el modelo`}
            columnas={[
              { clave: "etiqueta", titulo: "Herramienta", ancho: "14rem" },
              { clave: "nombre", titulo: "En el código", valor: (f) => <code className={s.nombre}>{f.nombre as string}</code> },
              {
                clave: "serie",
                titulo: "Serie",
                valor: (f) => {
                  const serie = f.serie as keyof typeof NOMBRE_SERIE | null;
                  return (
                    <span className={s.serie} data-serie={serie ?? undefined}>
                      {serie ? NOMBRE_SERIE[serie] : "Todas"}
                    </span>
                  );
                },
              },
              { clave: "devuelve", titulo: "Qué devuelve" },
              { clave: "origen", titulo: "Sale de" },
            ]}
            filas={HERRAMIENTAS}
            nota="Debajo de cada respuesta, el chat muestra qué herramientas usó y con qué argumentos."
          />
        </div>

        <Desplegable titulo="Qué recibe y qué devuelve la API">
          <div className={s.par}>
            <Codigo rotulo="Petición" texto={EJ_PETICION} />
            <Codigo rotulo="Respuesta 200 (valores de ejemplo)" texto={EJ_RESPUESTA} />
          </div>
          <p>
            <code>GET /asistente/estado</code> dice si el asistente está disponible y cuántas preguntas le quedan hoy al
            visitante. No gasta la cuota: el chat lo consulta al abrir la página.
          </p>
          <Tabla
            compacta
            columnas={[
              { clave: "codigo", titulo: "Código", ancho: "6rem", valor: (f) => <span className="dato">{f.codigo as string}</span> },
              { clave: "cuando", titulo: "Cuándo" },
            ]}
            filas={CODIGOS}
            nota="Los errores traen un mensaje en español en el campo detail. El chat lo muestra tal cual."
          />
        </Desplegable>

        <Desplegable titulo="Por qué lo hice así">
          <dl className={s.decisiones}>
            <div>
              <dt>Herramientas, no datos en el texto</dt>
              <dd>
                Elegí que el modelo pida cada cifra a una función de la API. Cada número sale del mismo código que las
                pruebas de la API comparan con los notebooks, y el modelo no copia cifras de tablas largas.
              </dd>
            </div>
            <div>
              <dt>Límite por IP</dt>
              <dd>
                La demo no pide cuenta ni llave, así que el límite va por IP. El tope del servicio acota el costo aunque
                lleguen muchos visitantes.
              </dd>
            </div>
            <div>
              <dt>Sin memoria en el servidor</dt>
              <dd>
                El navegador manda los últimos mensajes con cada pregunta. La API no guarda ni registra las preguntas:
                solo cuenta cuántas hace cada IP, en memoria, y el conteo se borra cada día.
              </dd>
            </div>
            <div>
              <dt>Un modelo rápido y uno de respaldo</dt>
              <dd>
                Probé un modelo más nuevo, pero Vertex AI lo rechazaba por falta de capacidad y una pregunta tardaba
                minutos. Elegí {modelo}, con un solo intento por llamada y {respaldo} cuando el principal está saturado
                (bitácora D82).
              </dd>
            </div>
            <div>
              <dt>Sin llaves</dt>
              <dd>Cloud Run entra a Vertex AI con su cuenta de servicio. No hay llaves en el código ni en el sitio.</dd>
            </div>
            <div>
              <dt>El texto de los datos no da órdenes</dt>
              <dd>
                Las instrucciones le piden al modelo tratar lo que devuelven las herramientas como datos. Es una defensa
                contra órdenes escondidas en un archivo.
              </dd>
            </div>
          </dl>
        </Desplegable>
      </Seccion>

      {/* 03 · Reglas y límites */}
      <Seccion
        id="reglas"
        numero="03"
        etiqueta="Reglas y límites"
        titulo={`${L.porDia} preguntas por día por visitante y ninguna conversación guardada`}
        entrada="Los límites acotan el costo de Vertex AI y frenan el uso automático. Las reglas están en las instrucciones fijas del modelo."
      >
        <div className={s.medio}>
          <Tabla
            titulo="Límites"
            columnas={[
              { clave: "limite", titulo: "Límite", ancho: "13rem" },
              { clave: "valor", titulo: "Valor", ancho: "9rem", valor: (f) => <span className="dato">{f.valor as string}</span> },
              { clave: "porque", titulo: "Por qué" },
            ]}
            filas={LIMITES_FILAS}
            nota={
              <>
                {/* fuente: api/limites.py, docstring del módulo */}
                Los contadores viven en la memoria de la API y se reinician a la medianoche, hora de Guatemala. Con dos
                instancias de Cloud Run, el tope del servicio puede llegar al doble.
              </>
            }
          />
        </div>

        <div className={s.bloque}>
          <h3 className={s.subtitulo}>Reglas del asistente</h3>
          <ul className={s.reglas}>
            <li>
              <strong>No inventa cifras.</strong> Toda cifra sale de una herramienta.
            </li>
            <li>
              <strong>Si un dato no está, lo dice</strong> en lugar de estimarlo.
            </li>
            <li>
              <strong>Cita el notebook</strong> de donde sale cada cifra.
            </li>
            <li>
              <strong>Solo habla de los tres análisis.</strong> No responde otros temas.
            </li>
            <li>
              <strong>Trata el texto de los datos como datos</strong>, no como órdenes.
            </li>
            <li>
              <strong>No nombra ingenios.</strong>
            </li>
            <li>
              <strong>Recuerda de dónde son los datos:</strong> son públicos y de otros lugares (Louisiana, una caldera a
              carbón, el mercado mundial). Se traslada el método, no las cifras.
            </li>
          </ul>
        </div>

        <Nota tipo="limite" titulo="Es una demo">
          <p>
            La redacción puede equivocarse, pero las cifras salen de las herramientas. Antes de usar una cifra,
            verifíquela en el caso de <Link href="/campo">campo</Link>, <Link href="/caldera">caldera</Link> o{" "}
            <Link href="/mercado">mercado</Link> y en su notebook.
          </p>
        </Nota>
      </Seccion>

      <div className={`contenedor ${s.cierre}`}>
        <Nota tipo="metodo" titulo="Dónde seguir">
          <ul className={s.enlaces}>
            <li>
              <Link href="/api">La API</Link>: las consultas que usan las herramientas del asistente, con sus pruebas.
            </li>
            <li>
              <Link href="/herramientas">Herramientas</Link>: las mismas consultas, con controles en lugar de preguntas.
            </li>
            <li>
              <a href={archivoRepo("api/asistente.py")}>api/asistente.py</a>: instrucciones, herramientas y bucle del
              asistente.
            </li>
            <li>
              <a href={archivoRepo("api/limites.py")}>api/limites.py</a>: el límite de preguntas por IP.
            </li>
          </ul>
        </Nota>
      </div>
    </>
  );
}
