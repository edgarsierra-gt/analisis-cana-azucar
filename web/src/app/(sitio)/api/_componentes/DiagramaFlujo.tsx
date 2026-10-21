import s from "./DiagramaFlujo.module.css";

export type ArchivosJson = { serie: "campo" | "caldera" | "mercado"; nombre: string; archivos: string[] }[];

/**
 * Flujo de la Serie IV: datasets → notebooks → JSON en outputs/models → API → quien consulta.
 * HTML y CSS (no una imagen), para que el texto se lea, se traduzca y se reacomode en un teléfono.
 * En pantalla ancha va de izquierda a derecha; en un teléfono, de arriba abajo.
 */
export function DiagramaFlujo({ archivos }: { archivos: ArchivosJson }) {
  const total = archivos.reduce((n, g) => n + g.archivos.length, 0);
  return (
    <div className={s.diagrama}>
      <p className={`${s.fase} ${s.faseAnalisis}`}>Análisis · se corre una vez, con los datasets</p>

      <div className={`${s.nodo} ${s.n1}`}>
        <p className={s.titulo}>Datasets públicos</p>
        <p>Ensayos de Louisiana, una caldera a carbón y el precio del azúcar No. 11.</p>
        <p className={s.pie}>No se versionan y no entran a la API.</p>
      </div>
      <span className={`${s.flecha} ${s.f1}`} aria-hidden="true" />

      <div className={`${s.nodo} ${s.n2}`}>
        <p className={s.titulo}>Notebooks 02 a 12</p>
        <p>Auditan los datos, prueban modelos y guardan el que eligen.</p>
        <p className={s.pie}>Usan los módulos de <code>src/</code>.</p>
      </div>
      <span className={`${s.flecha} ${s.f2}`} aria-hidden="true" />

      <p className={`${s.fase} ${s.faseServicio}`}>Imagen de Docker · código y JSON, sin datasets ni notebooks</p>

      <div className={`${s.nodo} ${s.n3}`}>
        <p className={s.titulo}>{total} archivos JSON</p>
        <p className={s.ruta}>outputs/models/</p>
        <ul className={s.archivos}>
          {archivos.map((g) => (
            <li key={g.serie} data-serie={g.serie}>
              <span className={s.serie}>{g.nombre}</span>
              {g.archivos.map((a) => <span key={a} className={s.nombres}>{a}</span>)}
            </li>
          ))}
        </ul>
        <p className={s.pie}>Sin pickles: se abren con cualquier editor.</p>
      </div>
      <span className={`${s.flecha} ${s.f3}`} aria-hidden="true" />

      <div className={`${s.nodo} ${s.n4} ${s.api}`}>
        <p className={s.titulo}>API FastAPI</p>
        <p className={s.ruta}>api/main.py</p>
        <ul className={s.puntos}>
          <li>Carga los JSON al arrancar.</li>
          <li>Calcula con el mismo código de <code>src/</code> que los notebooks.</li>
          <li>Valida cada entrada y rechaza lo imposible.</li>
          <li>No guarda lo que recibe.</li>
        </ul>
      </div>
      <span className={`${s.flecha} ${s.f4}`} aria-hidden="true" />

      <p className={`${s.fase} ${s.faseUso}`}>Consultas en JSON</p>

      <div className={`${s.nodo} ${s.n5}`}>
        <p className={s.titulo}>Quién consulta</p>
        <ul className={s.puntos}>
          <li>Las herramientas de este sitio.</li>
          <li>El asistente o una hoja de cálculo.</li>
          <li>Otros sistemas o flujos automáticos.</li>
        </ul>
      </div>
    </div>
  );
}
