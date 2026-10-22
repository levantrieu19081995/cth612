"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Tổng quan" },
  { href: "/booking", label: "Đặt vé" },
  { href: "/monitor", label: "Giám sát" },
  { href: "/replication", label: "Phân tán dữ liệu" },
  { href: "/analytics", label: "Thống kê" },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="site-nav" aria-label="Điều hướng chính">
      {links.map(({ href, label }) => {
        const active = pathname === href ||
          (href !== "/" && pathname.startsWith(`${href}/`)) ||
          (href === "/booking" && pathname.startsWith("/bookings/"));

        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
