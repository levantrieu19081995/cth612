import axios, { type AxiosError, type AxiosRequestConfig } from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  timeout: 15000,
  headers: {
    Accept: "application/json",
  },
});

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toApiError(error: AxiosError<unknown>): ApiError {
  const status = error.response?.status ?? 0;
  const data = error.response?.data;
  let message = status ? `API trả lỗi ${status}` : "Không thể kết nối backend.";
  let code = status ? "API_ERROR" : error.code ?? "NETWORK_ERROR";

  if (data && typeof data === "object") {
    if ("message" in data && typeof data.message === "string") {
      message = data.message;
    }
    if ("code" in data && typeof data.code === "string") {
      code = data.code;
    }
  }

  return new ApiError(status, code, message);
}

async function request<T>(operation: () => Promise<{ data: T }>): Promise<T> {
  try {
    const response = await operation();
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw toApiError(error);
    }

    throw error;
  }
}

export function apiGet<T>(
  path: string,
  config?: Pick<AxiosRequestConfig, "params" | "signal">,
): Promise<T> {
  return request(() => apiClient.get<T>(path, config));
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request(() => apiClient.post<T>(path, body));
}
