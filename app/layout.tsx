import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ViewChat - 사내 AI 어시스턴트",
  description: "AI 에이전트가 함께하는 사내 오피스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider initialLocale="ko">
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
