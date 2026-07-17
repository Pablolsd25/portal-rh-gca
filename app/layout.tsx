import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Portal GCA — Grupo Castro Acero",
  description: "Sistema integral de ventas, logística y control — Grupo Castro Acero",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 text-gray-900`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
