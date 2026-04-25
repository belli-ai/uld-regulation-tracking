import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { RecalculatorRoot } from "@/components/recalculator-root";
import { SimulateToggle } from "@/components/simulate-toggle";
import { ThemeProvider } from "@/components/theme-provider";
import { isDemoMode } from "@/lib/env";

import "./globals.css";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const demoMode = isDemoMode;

export const metadata: Metadata = {
  title: "Cool-Chain Copilot",
  description: "Hackathon scaffold — design tokens verification",
};

type Props = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistMono.variable} font-mono antialiased`}
        data-demo-mode={demoMode ? "true" : "false"}
      >
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          enableSystem={false}
        >
          <RecalculatorRoot />
          {children}
          <SimulateToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}
