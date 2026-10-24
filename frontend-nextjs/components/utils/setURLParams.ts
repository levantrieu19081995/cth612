"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function useSetURLParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (params: Record<string, any>) => {
    const newParams = new URLSearchParams(searchParams.toString());

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        newParams.delete(key);
      } else {
        newParams.set(key, String(value));
      }
    });

    router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
  };
}

export function useUpdateURLParams() {
  const router = useRouter();
  const pathname = usePathname();

  return (params: Record<string, any>) => {
    const query = new URLSearchParams();

    for (const key in params) {
      if (params[key] !== "" && params[key] != null) {
        query.set(key, params[key]);
      }
    }

    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };
}

export function useQueryFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const get = (key: string, defaultValue?: any) => {
    const value = searchParams.get(key);
    if (value) return value;
    return defaultValue;
  };

  const set = (params: Record<string, any>, replace = true) => {
    const query = new URLSearchParams(searchParams.toString());

    Object.entries(params).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined) {
        query.delete(key);
      } else {
        query.set(key, String(value));
      }
    });

    const qs = query.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;

    replace ? router.replace(url, { scroll: false }) : router.push(url, { scroll: false });
  };

  const reset = (params: Record<string, any>) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        query.set(key, String(value));
      }
    });

    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };

  return {
    get,
    set,
    reset,
    searchParams
  };
}