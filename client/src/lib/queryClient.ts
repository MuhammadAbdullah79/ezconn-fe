import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

// Error subclass carries the HTTP status so global cache handlers can branch on it
// without re-parsing the message string.
export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const raw = (await res.text()) || res.statusText;
    let humanMsg = raw;
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
      // NestJS error shape: { message, error, statusCode }. Fall back to raw if absent.
      if (parsed && typeof parsed === 'object') {
        humanMsg = parsed.message || parsed.error || raw;
      }
    } catch {
      // not JSON — keep raw
    }
    throw new ApiError(res.status, humanMsg, parsed);
  }
}

// Global error handler — mirrors replyagent's axios interceptor pattern:
//   - 401 → clear auth + redirect to /login
//   - Everything else (incl. 403) → generic destructive toast with the server's message
function handleApiError(error: unknown) {
  const isApi = error instanceof ApiError;
  const status = isApi ? error.status : 0;
  const description = isApi ? error.message : (error instanceof Error ? error.message : 'An error occurred');

  if (status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    if (typeof window !== 'undefined' && !window.location.pathname.endsWith('/login')) {
      window.location.href = '/login';
    }
    return;
  }

  toast({
    title: status === 403 ? 'Access denied' : 'Error',
    description,
    variant: 'destructive',
  });
}

// When VITE_API_BASE_URL is set (e.g. production), calls go directly to that
// absolute backend URL. When it's empty (local dev), API_BASE_URL stays "" so
// requests use relative /api/... paths and the Vite dev proxy forwards them to
// the backend — same-origin, so no CORS/preflight ("Failed to fetch") issues.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

// The backend (NestJS) serves routes at root: /auth/login, /workspaces/branding…
// Call sites are inconsistent — some pass "/api/..." and some bare "/auth/...".
// Normalize both for whichever mode we're in:
//  • Direct mode (absolute base): strip a leading /api, then prefix the base.
//  • Proxy mode (empty base): force everything under /api so the Vite dev proxy
//    matches it; the proxy's rewrite strips /api before hitting the backend.
function buildApiUrl(rawPath: string): string {
  let p = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const hasApiPrefix = p === "/api" || p.startsWith("/api/");
  if (API_BASE_URL) {
    if (hasApiPrefix) p = p.substring(4) || "/";
    return `${API_BASE_URL}${p}`;
  }
  return hasApiPrefix ? p : `/api${p}`;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | FormData | undefined,
): Promise<Response> {
  const isFormData = data instanceof FormData;
  const token = localStorage.getItem("auth_token");

  const headers: Record<string, string> = {};
  if (!isFormData && data) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const fullUrl = buildApiUrl(url);

  console.log("Requesting:", fullUrl);

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: isFormData ? (data as FormData) : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  try {
    await throwIfResNotOk(res);
  } catch (error) {
    handleApiError(error);
    throw error;
  }
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem("auth_token");
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const fullUrl = buildApiUrl(queryKey.join("/"));

    const res = await fetch(fullUrl, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    try {
      await throwIfResNotOk(res);
    } catch (error) {
      handleApiError(error);
      throw error;
    }
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
