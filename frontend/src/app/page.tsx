import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { LandingPage } from "@/components/landing/LandingPage";

const display = Manrope({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "Talent Valley — by Rio Pomba Valley",
  description: "Onde talentos e oportunidades se encontram. Conecte sua trajetória ao ecossistema Rio Pomba Valley.",
};

export default function Home() {
  return <div className={display.variable}><LandingPage /></div>;
}
