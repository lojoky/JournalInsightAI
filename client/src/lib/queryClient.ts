import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const isFormData = data instanceof FormData;
  
  // For development, use localhost:5000 if we're on the deployed domain
  const baseUrl = window.location.hostname.includes('replit.app') 
    ? 'http://localhost:5000' 
    : '';
  
  const fullUrl = baseUrl + url;
  console.log(`Making ${method} request to:`, fullUrl);
  
  const res = await fetch(fullUrl, {
    method,
    headers: data && !isFormData ? { "Content-Type": "application/json" } : {},
    body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // For development, use localhost:5000 if we're on the deployed domain
    const baseUrl = window.location.hostname.includes('replit.app') 
      ? 'http://localhost:5000' 
      : '';
    
    const fullUrl = baseUrl + (queryKey[0] as string);
    console.log(`Making GET query to:`, fullUrl);
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
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
