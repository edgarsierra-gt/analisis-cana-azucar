import type { Metadata } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import "./globals.css";

// Dos familias, solo los pesos que se usan: Newsreader 500 (títulos, cifras y marca) y Public Sans 400/600 (todo lo
// demás). El código usa el monoespaciado del sistema (--fuente-codigo en globals.css): no se descarga ninguna fuente.
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", weight: ["500"], style: ["normal"], display: "swap" });
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", weight: ["400", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Caña de azúcar: campo, fábrica y mercado", template: "%s · Caña de azúcar" },
  description:
    "Tres análisis con datos públicos para un ingenio azucarero: qué variedades sembrar y cuándo renovar, cómo vigilar una caldera de cogeneración y qué esperar del precio del azúcar.",
  authors: [{ name: "Edgar Sierra" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${newsreader.variable} ${publicSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
