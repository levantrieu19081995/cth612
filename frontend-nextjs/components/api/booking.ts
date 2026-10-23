import { apiGet } from "@/lib/api";
import type { Flight } from "@/types/booking";

export function __getTimChuyenBay(params: {
    origin: string | null;
    destination: string | null;
    date?: string;
    month?: string;
    requiredSeats?: number;
}): Promise<Flight[]>
{
    return apiGet<Flight[]>("/api/flights", { params });
}