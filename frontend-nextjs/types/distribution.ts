export interface DistributionRow {
  id: string; bookingId: string | null; label: string; status: string;
  occurredAt: string | null; rangeId: number | null; leaseholder: number | null;
  replicas: string[]; placementStatus: "METADATA" | "UNKNOWN"; partition: string | null;
}
export interface DistributionPage {
  rows: DistributionRow[]; nextCursor: string | null; hasMore: boolean;
  scanned: number; observedAt: string;
}
export interface DistributionCounts {
  tables: { table: string; rows: number | null; status: "EXACT" | "UNAVAILABLE"; observedAt: string }[];
  observedAt: string;
}
