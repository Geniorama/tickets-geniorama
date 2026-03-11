import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/providers/theme-provider";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Geniorama Tickets",
  description: "Sistema de tickets Geniorama",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${poppins.variable} antialiased`}>
        <ThemeProvider>
          {/* No pasar session al SessionProvider: evita que una sesión
              pre-renderizada en el servidor quede "pegada" en el estado
              del cliente cuando el usuario cambia de cuenta. La sesión
              real siempre se lee en el servidor via auth() en cada layout
              o page que lo necesite. */}
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
