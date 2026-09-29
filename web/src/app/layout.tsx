import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";
import { Backdrop } from "@/components/Backdrop";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

const instrument = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin-400-normal.woff2", style: "normal", weight: "400" },
    { path: "./fonts/instrument-serif-latin-400-italic.woff2", style: "italic", weight: "400" },
  ],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Estudio de Licha · Área de alumnos", template: "%s · Estudio de Licha" },
  description: "Tu formación para escalar tu e-commerce con anuncios que venden.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#050505",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable} ${instrument.variable} h-full`}>
      <body className="relative min-h-full flex flex-col">
        <Backdrop />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
