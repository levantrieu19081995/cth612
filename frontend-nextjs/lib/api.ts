const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000), cache: "no-store" });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    let message = `API trả lỗi ${response.status}`;
    let code = "API_ERROR";
    if (data && typeof data === "object") {
      if ("message" in data && typeof data.message === "string") message = data.message;
      if ("code" in data && typeof data.code === "string") code = data.code;
    }
    throw new ApiError(response.status, code, message);
  }
  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> { return request<T>(path, { signal }); }
export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
