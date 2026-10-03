import type { Metadata } from "next";
import { Manrope, Source_Serif_4 } from "next/font/google";
import { LandingPage } from "@/components/landing/LandingPage";

const display = Manrope({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Talent Valley",
  description: "Onde talentos e oportunidades se encontram. Conecte sua trajetória ao ecossistema Rio Pomba Valley.",
};

export default function Home() {
  return <div className={`${display.variable} ${serif.variable}`}><LandingPage /></div>;
}
