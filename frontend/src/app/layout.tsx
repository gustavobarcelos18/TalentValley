import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { ThemeRegistry } from "@/theme/ThemeRegistry";
import { AuthProvider } from "@/components/auth/AuthProvider";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { entrancePrePaintScript } from "@/components/landing/motion/entrancePrePaint";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Talent Valley",
  description: "Career Platform by Rio Pomba Valley",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <Script id="tv-motion-pre-paint" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: entrancePrePaintScript }} />
        <InitColorSchemeScript attribute="class" defaultMode="dark" />
        <ThemeRegistry>
          <AuthProvider>{children}</AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
