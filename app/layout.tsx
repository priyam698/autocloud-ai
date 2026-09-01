import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AutoCloud AI - Autonomous AI Support Platform",
  description: "Deploy AI Agents for Telegram and Web Chat in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen w-full bg-[#080c14] text-slate-100 flex flex-col">
        {children}

        {/* Live AutoCloud AI Web Chat Widget */}
        <Script
          src="https://autocloud-ai-p448.vercel.app/widget.js"
          data-instance-id="5a23a346-6b86-45c4-aadd-6d9788b1baa7"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}