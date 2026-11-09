import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/providers/theme-provider";
import { ActionToaster } from "@/components/ui/action-toaster";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Geniorama Tickets",
    template: "%s — Geniorama Tickets",
  },
  description: "Sistema de tickets Geniorama",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>
          {/* No pasar session al SessionProvider: evita que una sesión
              pre-renderizada en el servidor quede "pegada" en el estado
              del cliente cuando el usuario cambia de cuenta. La sesión
              real siempre se lee en el servidor via auth() en cada layout
              o page que lo necesite. */}
          <SessionProvider>{children}</SessionProvider>
          <ActionToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
