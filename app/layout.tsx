import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Arc by Nortivo",
  description:
    "Arc by Nortivo — money, food and activity. Penger, mat og aktivitet.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
