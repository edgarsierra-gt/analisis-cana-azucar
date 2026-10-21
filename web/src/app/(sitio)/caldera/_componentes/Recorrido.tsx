import { NOMBRE_CORTO } from "./nombres";
import s from "./Recorrido.module.css";

type Paso = { nombre: string; texto: React.ReactNode; sensores: string[] };

// El recorrido de la caldera en el orden en que el aire, los gases y el vapor la atraviesan. Cada paso dice qué hace
// esa parte en lenguaje llano y qué sensores de los datos están ahí (los 30, sin repetir).
const PASOS: Paso[] = [
  {
    nombre: "Hogar y lecho",
    texto: (
      <>
        El <strong>hogar</strong> es la cámara donde se quema el carbón. En el fondo hay un <strong>lecho</strong> de arena
        y ceniza caliente. El aire primario entra por abajo y lo mantiene en suspensión, como si hirviera. El aire
        secundario entra más arriba y termina la combustión.
      </>
    ),
    sensores: ["PT_8313A", "PT_8313B", "PT_8313C", "PT_8313D", "PT_8313E", "PT_8313F", "TE_8313B", "ZCLCCY", "YCLCCY",
      "SXLTCYZ", "SXLTCYY", "FT_8301", "FT_8302"],
  },
  {
    nombre: "Ciclones y cámaras de retorno",
    texto: <>Los gases arrastran partículas. Los ciclones las separan y las cámaras de retorno las devuelven al hogar con un poco de aire.</>,
    sensores: ["FT_8306A", "FT_8306B"],
  },
  {
    nombre: "Domo",
    texto: <>El <strong>domo</strong> es el tambor donde se separan el agua y el vapor. De ahí sale el vapor hacia los sobrecalentadores.</>,
    sensores: ["PTCA_8322A"],
  },
  {
    nombre: "Sobrecalentadores y atemperación",
    texto: (
      <>
        Tubos que calientan el vapor por encima de su punto de ebullición. Para que no pase de la temperatura de diseño,
        el atemperador le inyecta agua: eso es la <strong>atemperación</strong>. Más agua, vapor más frío.
      </>
    ),
    sensores: ["TV_8329ZC", "YJJWSLL", "TE_8332A"],
  },
  {
    nombre: "Colector",
    texto: (
      <>
        El tubo de salida que reúne el vapor y lo manda a la planta. Por el roce, aquí la presión es menor que en el domo,
        y esa diferencia crece con el flujo.
      </>
    ),
    sensores: ["PTCA_8324", "ZZQBCHLL"],
  },
  {
    nombre: "Economizador y precalentadores",
    texto: (
      <>
        Los gases, ya más fríos, calientan el agua que entra a la caldera y el aire que va al hogar. Si los tubos se
        ensucian, absorben menos calor y los gases salen más calientes.
      </>
    ),
    sensores: ["TE_8319A", "TE_8319B", "AIR_8301A", "AIR_8301B", "TE_8303", "TE_8304"],
  },
  {
    nombre: "Tiro inducido",
    texto: (
      <>
        Un ventilador saca los gases por la chimenea. Mantiene el hogar en leve <strong>depresión</strong>, un poco por
        debajo de la presión de afuera, para que los gases no escapen. Por eso las presiones de hogar son negativas.
      </>
    ),
    sensores: ["YFJ3_AI", "YFJ3_ZD1", "YFJ3_ZD2"],
  },
];

export const SENSORES_EN_RECORRIDO = PASOS.reduce((n, p) => n + p.sensores.length, 0);

/** "Presión de hogar A", "… B" … "… F" seguidos se escriben "Presión de hogar A a F": la lista se lee de un vistazo. */
function enLinea(tags: string[]): string {
  const nombres = tags.map((t) => NOMBRE_CORTO[t] ?? t);
  const salida: string[] = [];
  for (let i = 0; i < nombres.length; ) {
    const m = nombres[i].match(/^(.*) ([A-F])$/);
    let j = i + 1;
    while (m && j < nombres.length && nombres[j] === `${m[1]} ${String.fromCharCode(m[2].charCodeAt(0) + (j - i))}`) j++;
    salida.push(m && j - i >= 3 ? `${m[1]} ${m[2]} a ${nombres[j - 1].slice(-1)}` : nombres[i]);
    i = m && j - i >= 3 ? j : i + 1;
  }
  return salida.join(", ");
}

/** Recorrido de la caldera, parte por parte, con los sensores de cada una. El hogar, con 13 de los 30, va más alto. */
export function Recorrido() {
  return (
    <ol className={s.pasos}>
      {PASOS.map((p) => (
        <li key={p.nombre} className={s.paso}>
          <h3 className={s.nombre}>{p.nombre}</h3>
          <p className={s.texto}>{p.texto}</p>
          <p className={s.sensores}>
            <strong>{p.sensores.length === 1 ? "1 sensor" : `${p.sensores.length} sensores`}:</strong> {enLinea(p.sensores)}.
          </p>
        </li>
      ))}
    </ol>
  );
}
