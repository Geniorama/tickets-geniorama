import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/providers/theme-provider";
import { auth } from "@/auth";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${poppins.variable} antialiased`}>
        <ThemeProvider>
          <SessionProvider session={session}>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
