// Ruta base del sitio. next/link la agrega solo; para <img>, <a> a archivos o fetch a /public hay que usar ruta().
export const BASE = "/analisis-cana-azucar";
export const ruta = (p: string) => `${BASE}${p.startsWith("/") ? p : `/${p}`}`;

// Figura exportada por un notebook (outputs/figures/<nombre>.png, copiada a public/figuras).
export const figura = (nombre: string) => ruta(`/figuras/${nombre.endsWith(".png") ? nombre : `${nombre}.png`}`);

export const REPO = "https://github.com/edgarsierra-gt/analisis-cana-azucar";
export const archivoRepo = (p: string) => `${REPO}/blob/main/${p}`;
