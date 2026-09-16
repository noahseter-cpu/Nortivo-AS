import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Noah Tracker — Din hverdag, samlet",
  description:
    "Personlig oversikt over penger, mat og aktivitet. Lagret i nettleseren.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
