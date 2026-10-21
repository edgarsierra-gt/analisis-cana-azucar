// Cliente de la API de la Serie IV (FastAPI en Cloud Run). En desarrollo apunta al Docker de `docker compose up`;
// en el sitio publicado, a Cloud Run. NEXT_PUBLIC_API_URL permite cambiarla sin tocar el código.
const CLOUD_RUN = "https://analisis-cana-api-36437889250.us-central1.run.app";
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? CLOUD_RUN : "http://localhost:8000")
).replace(/\/$/, "");

export class ErrorApi extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje); }
}

/** Llama a la API y devuelve el JSON. Los errores 422 traen un mensaje en español que se muestra tal cual. */
export async function consultar<T>(ruta: string, cuerpo?: unknown, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${API_URL}${ruta}`, {
      method: cuerpo === undefined ? "GET" : "POST",
      headers: cuerpo === undefined || cuerpo instanceof FormData ? undefined : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : cuerpo instanceof FormData ? cuerpo : JSON.stringify(cuerpo),
      ...init,
    });
  } catch {
    throw new ErrorApi(0, "No hay conexión con la API. Puede estar arrancando: espere unos segundos y vuelva a intentar.");
  }
  const datos = await r.json().catch(() => null);
  if (!r.ok) {
    const d = datos?.detail;
    const texto = typeof d === "string" ? d : Array.isArray(d) ? d.map((e: { msg?: string }) => e.msg).join("; ")
      : d?.mensaje ? `${d.mensaje} ${(d.errores ?? []).join("; ")}` : `Error ${r.status}`;
    throw new ErrorApi(r.status, texto);
  }
  return datos as T;
}
