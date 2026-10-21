import { LIMITES, MODELO, RESPALDO, nombreModelo } from "./contrato";
import s from "./Diagrama.module.css";

/*
 * Diagrama de bloques del asistente: navegador → Cloud Run (validación, límite, bucle, herramientas, datos) ⇄ Vertex AI.
 * SVG en línea con los colores del sitio (clases del módulo CSS, que leen las variables de globals.css). Hay dos
 * dibujos: horizontal para pantallas anchas y vertical para teléfonos; el CSS muestra uno solo.
 * El orden de los bloques es el de api/main.py: pydantic valida la pregunta (422), después cuenta la cuota (429).
 */

type P = readonly [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Línea quebrada con punta de flecha al final. La línea termina en la base de la punta. */
function Flecha({ d, tipo = "normal" }: { d: P[]; tipo?: "normal" | "rechazo" }) {
  const [ax, ay] = d[d.length - 2];
  const [bx, by] = d[d.length - 1];
  const ang = Math.atan2(by - ay, bx - ax);
  const [c, sn] = [Math.cos(ang), Math.sin(ang)];
  const base: P = [bx - 9 * c, by - 9 * sn];
  const ala1: P = [base[0] - 4.2 * sn, base[1] + 4.2 * c];
  const ala2: P = [base[0] + 4.2 * sn, base[1] - 4.2 * c];
  const puntos = [...d.slice(0, -1), base];
  const camino = puntos.map(([x, y], i) => `${i === 0 ? "M" : "L"}${r1(x)} ${r1(y)}`).join(" ");
  return (
    <g className={tipo === "rechazo" ? s.rechazo : s.flecha}>
      <path d={camino} />
      <polygon points={[[bx, by], ala1, ala2].map(([x, y]) => `${r1(x)},${r1(y)}`).join(" ")} />
    </g>
  );
}

/** Número de paso del flujo, el mismo de la lista debajo de la figura. */
function Paso({ n, x, y, r = 11 }: { n: number; x: number; y: number; r?: number }) {
  return (
    <g className={s.paso}>
      <circle cx={x} cy={y} r={r} />
      <text x={x} y={y} dy="0.36em" textAnchor="middle">
        {n}
      </text>
    </g>
  );
}

function Caja({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect className={s.caja} x={x} y={y} width={w} height={h} rx={3} />;
}

/** Almacén de datos: el cilindro de los diagramas de ingeniería. */
function Cilindro({ x, y, w, h, ry = 8 }: { x: number; y: number; w: number; h: number; ry?: number }) {
  const rx = w / 2;
  return (
    <g className={s.caja}>
      <path d={`M${x} ${y + ry} V${y + h - ry} A${rx} ${ry} 0 0 0 ${x + w} ${y + h - ry} V${y + ry}`} />
      <ellipse cx={x + rx} cy={y + ry} rx={rx} ry={ry} />
    </g>
  );
}

/** Texto de una línea. `c` es la clase: titulo, sub, texto, mono, codigo, rotulo. */
function T({
  x, y, c = "texto", ancla, children,
}: {
  x: number;
  y: number;
  c?: keyof typeof s;
  ancla?: "middle" | "end";
  children: React.ReactNode;
}) {
  return (
    <text x={x} y={y} className={s[c]} textAnchor={ancla}>
      {children}
    </text>
  );
}

const Linea = ({ x1, x2, y }: { x1: number; x2: number; y: number }) => <line className={s.separador} x1={x1} x2={x2} y1={y} y2={y} />;

/** Rótulo de zona sobre su borde punteado, con un fondo de papel que corta la línea (como la leyenda de un fieldset). */
function Leyenda({ x, y, children }: { x: number; y: number; children: string }) {
  const ancho = children.length * 7.3 + 10; // JetBrains Mono a 11 px con 0.06em de espaciado
  return (
    <g>
      <rect className={s.fondoLeyenda} x={x - 5} y={y - 10} width={ancho} height={14} />
      <text x={x} y={y} className={s.leyenda}>
        {children}
      </text>
    </g>
  );
}

export function DiagramaAsistente({ herramientas }: { herramientas: number }) {
  const modelo = nombreModelo(MODELO);
  const respaldo = nombreModelo(RESPALDO).replace("Gemini ", "");
  const L = LIMITES;
  const desc =
    `1: el navegador manda la pregunta a la API en Cloud Run (POST /asistente). ` +
    `2: la API valida la pregunta (de 1 a ${L.maxCaracteres} caracteres; si no pasa, responde 422) y cuenta la cuota por IP (${L.porDia} por día, ${L.porMinuto} por minuto, ${L.globalDia} al día en total; si se acabó, responde 429). En los dos casos no llama al modelo. ` +
    `3: la API manda a Vertex AI, modelo ${modelo}, la conversación, las instrucciones fijas y ${herramientas} herramientas. ` +
    `4: el modelo pide una herramienta. 5: la API la ejecuta: lee los JSON de los notebooks o el resumen de cada serie. 6: la API devuelve el resultado al modelo; 4 a 6 se repiten, máximo ${L.maxPasos} pasos. ` +
    `7: el modelo redacta la respuesta. 8: la API la devuelve al navegador. La API entra a Vertex AI con la cuenta de servicio de Cloud Run, sin llaves.`;

  return (
    <div className={s.diagrama}>
      {/* ── Pantalla ancha: de izquierda a derecha ─────────────────────────────────────────────── */}
      <svg className={`${s.lienzo} ${s.horizontal}`} viewBox="0 0 1120 620" role="img" aria-labelledby="diag-h-t diag-h-d">
        <title id="diag-h-t">Cómo responde el asistente, en 8 pasos</title>
        <desc id="diag-h-d">{desc}</desc>

        {/* Zonas */}
        <T x={8} y={58} c="mono">VISITANTE</T>
        <rect className={s.zona} x={300} y={36} width={408} height={572} rx={4} />
        <T x={316} y={58} c="mono">CLOUD RUN · FASTAPI (PYTHON)</T>
        <rect className={s.zona} x={870} y={36} width={242} height={404} rx={4} />
        <T x={886} y={58} c="mono">VERTEX AI · REGIÓN GLOBAL</T>

        {/* Navegador */}
        <Caja x={8} y={84} w={168} h={232} />
        <T x={24} y={112} c="titulo">Navegador</T>
        <T x={24} y={132} c="mono">PÁGINA /ASISTENTE</T>
        <Linea x1={24} x2={160} y={146} />
        <T x={24} y={170}>Guarda los turnos</T>
        <T x={24} y={189}>en la pestaña</T>
        <T x={24} y={214}>{`Manda los últimos ${L.maxHistorial}`}</T>
        <T x={24} y={233}>con cada pregunta</T>
        <T x={24} y={258}>Muestra la respuesta</T>
        <T x={24} y={277}>y lo que consultó</T>

        {/* Validación y cuota */}
        <Caja x={324} y={84} w={170} h={92} />
        <T x={340} y={108} c="sub">Validación</T>
        <T x={340} y={130}>{`Pregunta de 1 a ${L.maxCaracteres}`}</T>
        <T x={340} y={148}>caracteres</T>
        <T x={340} y={166}>{`Historial: máx. ${L.maxHistorial}`}</T>
        <Caja x={514} y={84} w={170} h={92} />
        <T x={530} y={108} c="sub">Límite por IP</T>
        <T x={530} y={130}>{`${L.porDia} preguntas por día`}</T>
        <T x={530} y={148}>{`${L.porMinuto} por minuto`}</T>
        <T x={530} y={166}>{`${L.globalDia} al día en total`}</T>
        <Flecha d={[[494, 130], [514, 130]]} />
        <Flecha d={[[599, 176], [599, 212]]} />

        {/* Bucle de llamadas */}
        <Caja x={324} y={212} w={360} h={140} />
        <T x={340} y={238} c="sub">Bucle de llamadas a funciones</T>
        <T x={340} y={262}>Manda la conversación al modelo</T>
        <T x={340} y={281}>y ejecuta cada herramienta que pide.</T>
        <T x={340} y={306}>{`Corta en ${L.maxPasos} pasos.`}</T>
        <T x={340} y={325}>No guarda la conversación.</T>

        {/* Herramientas y datos */}
        <Flecha d={[[440, 352], [440, 392]]} />
        <Flecha d={[[470, 392], [470, 352]]} />
        <T x={484} y={376} c="rotulo">ejecuta y devuelve</T>
        <Caja x={324} y={392} w={360} h={72} />
        <T x={340} y={416} c="sub">{`${herramientas} herramientas`}</T>
        <T x={340} y={436}>Las mismas funciones de los endpoints</T>
        <T x={340} y={454} c="mono">CAMPO · CALDERA · MERCADO · HALLAZGOS</T>
        <Flecha d={[[504, 464], [504, 496]]} />
        <T x={516} y={486} c="rotulo">lee</T>
        <Cilindro x={324} y={496} w={360} h={100} ry={9} />
        <T x={340} y={534} c="sub">Salidas de los notebooks</T>
        <T x={340} y={555} c="codigo">outputs/models/*.json · outputs/tables/*.json</T>
        <T x={340} y={576}>y el resumen de cada serie (README)</T>

        {/* Gemini */}
        <Caja x={894} y={84} w={202} h={268} />
        <T x={910} y={112} c="titulo">{modelo}</T>
        <T x={910} y={132} c="mono">MODELO DE LENGUAJE</T>
        <Linea x1={910} x2={1080} y={146} />
        <T x={910} y={170} c="sub">Instrucciones fijas</T>
        <T x={910} y={190}>Usa solo las herramientas</T>
        <T x={910} y={208}>Cita el notebook</T>
        <T x={910} y={226}>No nombra ingenios</T>
        <T x={910} y={244}>No cambia de tema</T>
        <Linea x1={910} x2={1080} y={258} />
        <T x={910} y={282} c="sub">{`${herramientas} herramientas`}</T>
        <T x={910} y={302}>declaradas con nombre,</T>
        <T x={910} y={320}>descripción y argumentos</T>
        <T x={894} y={380} c="rotulo">Si está saturado, la API usa</T>
        <T x={894} y={398} c="rotulo">{`${respaldo} por ${L.minutosRespaldo} minutos.`}</T>

        {/* Navegador ⇄ API. Cada control rechaza por su cuenta: la validación con 422 y la cuota con 429. */}
        <Flecha d={[[176, 118], [324, 118]]} />
        <T x={206} y={110} c="rotuloMono">POST /asistente</T>
        <Flecha d={[[324, 152], [176, 152]]} tipo="rechazo" />
        <T x={206} y={146} c="rotuloRechazo">422</T>
        <Flecha d={[[534, 176], [534, 194], [176, 194]]} tipo="rechazo" />
        <T x={206} y={188} c="rotuloRechazo">429</T>
        <Flecha d={[[324, 290], [176, 290]]} />
        <T x={292} y={283} c="rotuloMono" ancla="end">respuesta JSON</T>

        {/* API ⇄ Vertex AI */}
        <Flecha d={[[684, 240], [894, 240]]} />
        <T x={718} y={233} c="rotulo">pregunta y herramientas</T>
        <Flecha d={[[894, 270], [684, 270]]} />
        <T x={860} y={263} c="rotulo" ancla="end">pide una herramienta</T>
        <Flecha d={[[684, 300], [894, 300]]} />
        <T x={718} y={293} c="rotulo">resultado</T>
        <Flecha d={[[894, 330], [684, 330]]} />
        <T x={860} y={323} c="rotulo" ancla="end">respuesta final</T>
        <T x={720} y={372} c="monoChico">4 A 6 SE REPITEN:</T>
        <T x={720} y={388} c="monoChico">{`MÁXIMO ${L.maxPasos} PASOS`}</T>

        {/* Credenciales: la cuenta de servicio de Cloud Run, sin llaves */}
        <line className={s.credencial} x1={708} x2={870} y1={420} y2={420} />
        <T x={789} y={412} c="monoChico" ancla="middle">CUENTA DE SERVICIO</T>
        <T x={789} y={436} c="monoChico" ancla="middle">SIN LLAVES</T>

        {/* Pasos */}
        <Paso n={1} x={192} y={118} />
        <Paso n={2} x={324} y={84} />
        <Paso n={3} x={700} y={240} />
        <Paso n={4} x={878} y={270} />
        <Paso n={5} x={418} y={372} />
        <Paso n={6} x={700} y={300} />
        <Paso n={7} x={878} y={330} />
        <Paso n={8} x={308} y={290} />
      </svg>

      {/* ── Teléfono: de arriba abajo ──────────────────────────────────────────────────────────── */}
      <svg className={`${s.lienzo} ${s.vertical}`} viewBox="0 0 360 956" role="img" aria-labelledby="diag-v-t diag-v-d">
        <title id="diag-v-t">Cómo responde el asistente, en 8 pasos</title>
        <desc id="diag-v-d">{desc}</desc>

        <T x={12} y={18} c="mono">VISITANTE</T>
        <Caja x={12} y={28} w={336} h={78} />
        <T x={28} y={56} c="titulo">Navegador</T>
        <T x={124} y={56} c="mono">PÁGINA /ASISTENTE</T>
        <T x={28} y={80}>{`Guarda los turnos y manda los últimos ${L.maxHistorial}.`}</T>
        <T x={28} y={98}>Muestra la respuesta y lo que consultó.</T>

        {/* Cloud Run */}
        <rect className={s.zona} x={4} y={150} width={352} height={532} rx={4} />
        <Leyenda x={156} y={154}>CLOUD RUN · FASTAPI</Leyenda>

        <Caja x={40} y={196} w={132} h={100} />
        <T x={52} y={218} c="sub">Validación</T>
        <T x={52} y={240}>{`1 a ${L.maxCaracteres}`}</T>
        <T x={52} y={258}>caracteres</T>
        <T x={52} y={276}>{`historial: máx. ${L.maxHistorial}`}</T>
        <Caja x={188} y={196} w={132} h={100} />
        <T x={200} y={218} c="sub">Límite por IP</T>
        <T x={200} y={240}>{`${L.porDia} por día`}</T>
        <T x={200} y={258}>{`${L.porMinuto} por minuto`}</T>
        <T x={200} y={276}>{`tope: ${L.globalDia} al día`}</T>
        <Flecha d={[[172, 246], [188, 246]]} />
        <Flecha d={[[254, 296], [254, 330]]} />

        <Caja x={40} y={330} w={280} h={104} />
        <T x={56} y={354} c="sub">Bucle de llamadas a funciones</T>
        <T x={56} y={376}>Manda la conversación al modelo</T>
        <T x={56} y={395}>y ejecuta cada herramienta que pide.</T>
        <T x={56} y={414}>{`Corta en ${L.maxPasos} pasos. No guarda nada.`}</T>

        <Flecha d={[[110, 434], [110, 470]]} />
        <Flecha d={[[136, 470], [136, 434]]} />
        <T x={150} y={456} c="rotulo">ejecuta y devuelve</T>
        <Caja x={40} y={470} w={280} h={64} />
        <T x={56} y={494} c="sub">{`${herramientas} herramientas`}</T>
        <T x={56} y={516}>Las mismas funciones de los endpoints</T>
        <Flecha d={[[180, 534], [180, 566]]} />
        <T x={192} y={554} c="rotulo">lee</T>
        <Cilindro x={40} y={566} w={280} h={98} />
        <T x={56} y={602} c="sub">Salidas de los notebooks</T>
        <T x={56} y={620} c="codigo">outputs/models/*.json</T>
        <T x={56} y={636} c="codigo">outputs/tables/*.json</T>
        <T x={56} y={652} c="codigo">README.md (resúmenes)</T>

        {/* Vertex AI */}
        <rect className={s.zona} x={4} y={700} width={352} height={246} rx={4} />
        <Leyenda x={40} y={704}>VERTEX AI · REGIÓN GLOBAL</Leyenda>
        <Caja x={40} y={728} w={312} h={186} />
        <T x={56} y={756} c="titulo">{modelo}</T>
        <T x={56} y={774} c="mono">MODELO DE LENGUAJE</T>
        <T x={56} y={798}>Instrucciones fijas: usa solo las</T>
        <T x={56} y={816}>herramientas, cita el notebook, no</T>
        <T x={56} y={834}>nombra ingenios ni cambia de tema.</T>
        <T x={56} y={856}>Pide herramientas y redacta.</T>
        <T x={56} y={876}>{`Si está saturado: ${respaldo}, ${L.minutosRespaldo} min.`}</T>
        <T x={56} y={900} c="monoChico">{`4 A 6 SE REPITEN: MÁXIMO ${L.maxPasos} PASOS`}</T>
        <T x={40} y={934} c="monoChico">CUENTA DE SERVICIO DE CLOUD RUN · SIN LLAVES</T>

        {/* Navegador ⇄ API */}
        <Flecha d={[[130, 106], [130, 196]]} />
        <T x={146} y={130} c="rotuloMono">POST /asistente</T>
        <Flecha d={[[64, 196], [64, 106]]} tipo="rechazo" />
        <T x={72} y={184} c="rotuloRechazo">422</T>
        <Flecha d={[[300, 196], [300, 106]]} tipo="rechazo" />
        <T x={290} y={184} c="rotuloRechazo" ancla="end">429</T>
        <Flecha d={[[40, 410], [20, 410], [20, 106]]} />

        {/* API ⇄ Vertex AI: bajan 3 y 6, suben 4 y 7 */}
        <Flecha d={[[320, 350], [348, 350], [348, 728]]} />
        <Flecha d={[[334, 728], [334, 376], [320, 376]]} />

        <Paso n={1} x={130} y={126} />
        <Paso n={2} x={40} y={196} />
        <Paso n={3} x={348} y={470} r={9} />
        <Paso n={4} x={334} y={515} r={9} />
        <Paso n={5} x={88} y={452} />
        <Paso n={6} x={348} y={560} r={9} />
        <Paso n={7} x={334} y={605} r={9} />
        <Paso n={8} x={20} y={300} />
      </svg>
    </div>
  );
}
