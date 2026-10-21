import { num } from "@/lib/formato";
import s from "./Formula.module.css";

/** El sensor virtual físico de dos variables (notebook 08, sección 4.1), con sus coeficientes del JSON. */
export function Formula({ a, b, c, mae }: { a: number; b: number; c: number; mae: number }) {
  return (
    <div className={s.formula}>
      <p className="etiqueta">Sensor virtual físico, dos variables · error típico en días no vistos: {num(mae, 2)} t/h</p>
      <p className={s.ecuacion}>
        <span className={s.lado}>Vapor (t/h)</span>
        <span className={s.igual}>=</span>
        <span className={s.termino}>{num(a, 2)}</span>
        <span className={s.signo}>+</span>
        <span className={s.termino}>{num(b, 1)} · √(ΔP·ρ)</span>
        <span className={s.signo}>+</span>
        <span className={s.termino}>{num(c, 2)} · agua de atemperación (t/h)</span>
      </p>
      <dl className={s.terminos}>
        <div>
          <dt>ΔP</dt>
          <dd>presión del domo menos presión del colector (MPa): lo que el vapor pierde por roce en los sobrecalentadores.</dd>
        </div>
        <div>
          <dt>ρ</dt>
          <dd>densidad del vapor, que sube con la presión y baja con la temperatura.</dd>
        </div>
        <div>
          <dt>{num(c, 2)}</dt>
          <dd>el agua que inyecta el atemperador se vuelve vapor: cada t/h de agua suma cerca de 1 t/h, como pide el balance de masa.</dd>
        </div>
      </dl>
    </div>
  );
}
