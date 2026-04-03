import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concert Tickets — Queue Evolution",
  description: "선착순 콘서트 티켓 예매 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
