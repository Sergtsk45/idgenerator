import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getTelegramInitData } from "./telegram";
import { getAuthToken, clearAuthToken } from "./auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Создаёт заголовки для API-запросов с приоритетом аутентификации:
 * 1. JWT токен (Authorization: Bearer)
 * 2. Telegram initData (X-Telegram-Init-Data)
 */
function createHeaders(includeContentType: boolean): HeadersInit {
  const headers: HeadersInit = {};
  
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  
  // Приоритет 1: JWT токен
  const jwtToken = getAuthToken();
  if (jwtToken) {
    headers["Authorization"] = `Bearer ${jwtToken}`;
    return headers;
  }
  
  // Приоритет 2: Telegram initData
  const initData = getTelegramInitData();
  if (initData) {
    headers["X-Telegram-Init-Data"] = initData;
    return headers;
  }
  
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: createHeaders(!!data),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Обработка 401: очистка JWT и редирект на логин
  if (res.status === 401 && getAuthToken()) {
    clearAuthToken();
    window.location.href = '/login';
    throw new Error('401: Unauthorized');
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: createHeaders(false),
      credentials: "include",
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      
      // Очистка JWT и редирект на логин при 401
      if (getAuthToken()) {
        clearAuthToken();
        window.location.href = '/login';
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
