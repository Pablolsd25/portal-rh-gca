import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Portal RH — Grupo Castro Acero",
  description: "Sistema de nóminas y bitácora de embarques",
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
