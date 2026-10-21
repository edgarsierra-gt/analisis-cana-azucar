import { Encabezado } from "@/components/Encabezado";
import { Movimiento } from "@/components/Movimiento";
import { Pie } from "@/components/Pie";

export default function LayoutSitio({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#contenido" className="solo-lectores">Ir al contenido</a>
      <Encabezado />
      <main id="contenido">{children}</main>
      <Pie />
      <Movimiento />
    </>
  );
}
