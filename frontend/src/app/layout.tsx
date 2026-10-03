import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeRegistry } from "@/theme/ThemeRegistry";
import { AuthProvider } from "@/components/auth/AuthProvider";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Talent Valley",
  description: "Alunos da região mantêm perfis profissionais atualizados. Recrutadores autorizados descobrem talentos por competências e formação.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <InitColorSchemeScript attribute="class" defaultMode="dark" />
        <ThemeRegistry>
          <AuthProvider>{children}</AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
