// Utilidades de la página de mercado. Solo se usan en el servidor (page.tsx) para preparar los datos
// que reciben las gráficas: nada de tablas enteras al cliente.

/** Nombres en español de los países del panel (los mismos que usa src/mercado_faostat.py en las figuras). */
const NOMBRES: Record<string, string> = {
  Angola: "Angola", Argentina: "Argentina", Australia: "Australia", Bangladesh: "Bangladés", Belize: "Belice",
  "Bolivia (Plurinational State of)": "Bolivia", Brazil: "Brasil", Cambodia: "Camboya", Cameroon: "Camerún",
  "China, mainland": "China continental", "China, Taiwan Province of": "Taiwán", Colombia: "Colombia", Congo: "Congo",
  "Costa Rica": "Costa Rica", "Côte d'Ivoire": "Costa de Marfil", Cuba: "Cuba",
  "Democratic Republic of the Congo": "RD del Congo", "Dominican Republic": "Rep. Dominicana", Ecuador: "Ecuador",
  Egypt: "Egipto", "El Salvador": "El Salvador", Eswatini: "Eswatini", Ethiopia: "Etiopía", Fiji: "Fiyi",
  Ghana: "Ghana", Guatemala: "Guatemala", Guinea: "Guinea", Guyana: "Guyana", Haiti: "Haití", Honduras: "Honduras",
  India: "India", Indonesia: "Indonesia", "Iran (Islamic Republic of)": "Irán", Jamaica: "Jamaica", Japan: "Japón",
  Kenya: "Kenia", "Lao People's Democratic Republic": "Laos", Liberia: "Liberia", Madagascar: "Madagascar",
  Malawi: "Malaui", Mali: "Malí", Mauritius: "Mauricio", Mexico: "México", Morocco: "Marruecos",
  Mozambique: "Mozambique", Myanmar: "Myanmar", Nepal: "Nepal", Nicaragua: "Nicaragua", Niger: "Níger",
  Nigeria: "Nigeria", Pakistan: "Pakistán", Panama: "Panamá", "Papua New Guinea": "Papúa Nueva Guinea",
  Paraguay: "Paraguay", Peru: "Perú", Philippines: "Filipinas", Rwanda: "Ruanda", Senegal: "Senegal",
  Somalia: "Somalia", "South Africa": "Sudáfrica", "Sri Lanka": "Sri Lanka", Sudan: "Sudán", Thailand: "Tailandia",
  Uganda: "Uganda", "United Republic of Tanzania": "Tanzania", "United States of America": "Estados Unidos",
  Uruguay: "Uruguay", "Venezuela (Bolivarian Republic of)": "Venezuela", "Viet Nam": "Vietnam", Zambia: "Zambia",
  Zimbabwe: "Zimbabue",
};

export const es = (pais: string) => NOMBRES[pais] ?? pais;

/** Lista en español con "y" antes del último: ["A", "B", "C"] → "A, B y C". */
export function enLista(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}

export const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Cuantil con interpolación lineal, igual que pandas.Series.quantile (la regla del notebook 10). */
export function cuantil(valores: number[], q: number): number {
  const v = [...valores].sort((a, b) => a - b);
  const pos = (v.length - 1) * q;
  const i = Math.floor(pos);
  return i + 1 < v.length ? v[i] + (pos - i) * (v[i + 1] - v[i]) : v[i];
}

/** Último cierre de cada semana (de lunes a domingo). Reduce ~6,100 días a ~1,270 puntos. */
export function cierreSemanal(dias: { fecha: string; cierre: number }[]) {
  const semanas = new Map<string, { fecha: string; cierre: number }>();
  for (const d of dias) {
    const t = new Date(`${d.fecha}T00:00:00Z`);
    const lunes = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
    semanas.set(lunes, { fecha: d.fecha, cierre: d.cierre });
  }
  return [...semanas.values()];
}

/**
 * Redondeo al par, como numpy.round (lo que usa pandas .round en las tablas de los notebooks). Importa en los p de
 * permutación y bootstrap, que son conteos exactos (0.0265 = 53/2000 se muestra 0.026, no 0.027).
 */
export function redondeoPar(x: number, decimales: number): number {
  const f = 10 ** decimales;
  const y = x * f;
  const r = Math.abs(y - Math.trunc(y)) === 0.5 ? 2 * Math.round(y / 2) : Math.round(y);
  return r / f;
}

/** p con tres decimales, como en el notebook; "p < 0.001" cuando redondea a cero. */
export function textoP(p: number): string {
  return p < 0.0005 ? "p < 0.001" : `p = ${p.toFixed(3)}`; // sin cortes de renglón dentro de la expresión
}

/** Ordinal corto en español: 8 → "8.º". */
export const ordinal = (n: number) => `${n}.º`;
