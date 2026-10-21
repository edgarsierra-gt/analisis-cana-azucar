import type { Metadata } from "next";
import { JetBrains_Mono, Newsreader, Public_Sans } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", style: ["normal", "italic"], display: "swap" });
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Caña de azúcar: campo, fábrica y mercado", template: "%s · Caña de azúcar" },
  description:
    "Tres análisis con datos públicos para un ingenio azucarero: qué variedades sembrar y cuándo renovar, cómo vigilar una caldera de cogeneración y qué esperar del precio del azúcar.",
  authors: [{ name: "Edgar Sierra" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${newsreader.variable} ${publicSans.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
