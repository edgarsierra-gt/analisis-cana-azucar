// Formato de números del sitio: punto decimal y coma de miles (igual que los notebooks y el README).
const vacio = "s. d.";
const ok = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);

export function num(x: number | null | undefined, decimales = 0): string {
  if (!ok(x)) return vacio;
  const s = Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  return x < 0 && Number(s.replace(/,/g, "")) !== 0 ? `−${s}` : s;
}

/** Con signo explícito: +272, −0.4 */
export function conSigno(x: number | null | undefined, decimales = 0): string {
  if (!ok(x)) return vacio;
  const s = num(Math.abs(x), decimales);
  return x > 0 ? `+${s}` : x < 0 ? `−${s}` : s;
}

/** x ya expresado en porcentaje (21.8 → "21.8 %") */
export const pct = (x: number | null | undefined, decimales = 0) => (ok(x) ? `${num(x, decimales)} %` : vacio);

/** x como fracción (0.218 → "21.8 %") */
export const pctFraccion = (x: number | null | undefined, decimales = 0) => (ok(x) ? pct(x * 100, decimales) : vacio);

export const usd = (x: number | null | undefined, decimales = 0) => (ok(x) ? `US$${num(x, decimales)}` : vacio);
