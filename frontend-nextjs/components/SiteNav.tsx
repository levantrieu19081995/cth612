"use client";

import { LoadingOverlay } from "@mantine/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Tổng quan" },
  { href: "/booking", label: "Đặt vé" },
  { href: "/monitor", label: "Giám sát" },
  { href: "/replication", label: "Phân tán dữ liệu" },
  { href: "/analytics", label: "Thống kê" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  return (
    <>
      <nav className="site-nav" aria-label="Điều hướng chính">
        {links.map(({ href, label }) => {
          const active = pathname === href ||
            (href !== "/" && pathname.startsWith(`${href}/`)) ||
            (href === "/booking" && pathname.startsWith("/bookings/"));

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={(event) => {
                if (
                  active ||
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return;
                }

                setIsNavigating(true);
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {isNavigating && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1400 }}>
          <LoadingOverlay visible />
        </div>
      )}
    </>
  );
}
