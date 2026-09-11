import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeRegistry } from "@/theme/ThemeRegistry";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Talent Valley",
  description: "Career Platform by Rio Pomba Valley",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
