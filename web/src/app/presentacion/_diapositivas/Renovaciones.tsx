import s from "./presentacion.module.css";

/**
 * Cuatro lotes tipo de la auditoría de renovaciones: una fila por lote, una casilla por zafra con el número de corte
 * de ese año (0 = plantía, la renovación). Las casillas pasan el ciclo óptimo (`optimo` cortes) se marcan en tinta.
 */
export function Renovaciones({
  casos, optimo,
}: {
  casos: { nombre: string; cortes: [number, number][] }[];
  optimo: number;
}) {
  const anios = casos[0]?.cortes.map(([a]) => a) ?? [];
  const tipo = (c: number) => (c === 0 ? "plantia" : c >= optimo ? "vencida" : "soca");
  return (
    <div>
      <div className={s.renovaciones} role="table" aria-label="Número de corte de cada año en cuatro lotes tipo">
        <div role="row" style={{ display: "contents" }}>
          <span role="columnheader" />
          {anios.map((a) => (
            <span key={a} role="columnheader" className={s.renovacionesAnio}>{a}</span>
          ))}
        </div>
        {casos.map((caso) => (
          <div key={caso.nombre} role="row" style={{ display: "contents" }}>
            <span role="rowheader" className={s.renovacionesCaso}>{caso.nombre}</span>
            {caso.cortes.map(([a, c]) => (
              <span
                key={a}
                role="cell"
                className={s.casilla}
                data-tipo={tipo(c)}
                aria-label={c === 0 ? `${a}: plantía` : `${a}: corte ${c}`}
              >
                {c === 0 ? "P" : c}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className={s.leyenda}>
        <span><i data-tipo="plantia" aria-hidden="true" />P: plantía, se renovó ese año</span>
        <span><i aria-hidden="true" />1 a {optimo - 1}: socas dentro del ciclo de {optimo} cortes</span>
        <span><i data-tipo="vencida" aria-hidden="true" />{optimo} o más: socas pasadas del ciclo</span>
      </p>
    </div>
  );
}
