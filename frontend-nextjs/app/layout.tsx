import type { ReactNode } from "react";
import Link from "next/link";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import Providers from "../components/Providers";
import SiteNav from "../components/SiteNav";
import { Metadata } from "next";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CTH612 - Flight Booking",
  description: "Trang tổng quan đặt vé máy bay CTH612",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${beVietnamPro.className} ${beVietnamPro.variable}`}>
        <Providers>
          <main className="app-shell">
            <header className="site-header">
              <Link className="site-brand" href="/" aria-label="CTH612 - Trang tổng quan">
                <span className="brand-mark" aria-hidden="true">
                  C
                </span>
                <span>
                  <strong>CTH612</strong>
                  <small>FLIGHT BOOKING</small>
                </span>
              </Link>
              <SiteNav />
              <Link className="header-cta" href="/booking">
                Đặt vé ngay <span aria-hidden="true">→</span>
              </Link>
            </header>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
