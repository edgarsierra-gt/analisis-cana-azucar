import s from "./Mercado.module.css";

/** Hipótesis descartadas de una pregunta, con su código de la bitácora (H#) y qué las descartó. */
export function Descartes({ items }: { items: { codigo: string; hipotesis: string; motivo: React.ReactNode }[] }) {
  return (
    <div className={s.descartes}>
      <h3>Qué descarté</h3>
      <dl>
        {items.map((h) => (
          <div key={h.codigo}>
            <dt>
              <span className={s.codigo}>{h.codigo}</span>“{h.hipotesis}”
            </dt>
            <dd>{h.motivo}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
