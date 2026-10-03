import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { LandingPage } from "@/components/landing/LandingPage";

const display = Manrope({ subsets: ["latin"], variable: "--font-display", display: "swap" });

const title = "Talent Valley";
const description = "Alunos da região mantêm perfis profissionais atualizados. Recrutadores autorizados descobrem talentos por competências e formação.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { type: "website", locale: "pt_BR", siteName: title, title, description },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1114" },
  ],
};

export default function Home() {
  return <div className={display.variable}><LandingPage /></div>;
}
