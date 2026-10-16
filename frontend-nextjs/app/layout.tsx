import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <main>
          <nav>
            <a href="/">Tổng quan</a>
            <a href="/booking">Đặt vé</a>
            <a href="/monitor">Giám sát</a>
            <a href="/replication">Phân tán dữ liệu</a>
            <a href="/analytics">Thống kê</a>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
