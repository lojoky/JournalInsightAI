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
  
  // Get headers for authentication
  const headers: Record<string, string> = data && !isFormData ? { "Content-Type": "application/json" } : {};
  
  // Add Firebase auth token if available and on deployed domain
  const isDeployedDomain = window.location.hostname.includes('replit.app');
  if (isDeployedDomain) {
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (user) {
        const idToken = await user.getIdToken();
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    } catch (error) {
      console.warn('Could not get Firebase auth token:', error);
    }
  }
  
  const res = await fetch(url, {
    method,
    headers,
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
    // Get headers for authentication
    const headers: Record<string, string> = {};
    
    // Add Firebase auth token if available and on deployed domain
    const isDeployedDomain = window.location.hostname.includes('replit.app');
    if (isDeployedDomain) {
      try {
        const { auth } = await import('@/lib/firebase');
        const user = auth.currentUser;
        if (user) {
          const idToken = await user.getIdToken();
          headers['Authorization'] = `Bearer ${idToken}`;
        }
      } catch (error) {
        console.warn('Could not get Firebase auth token for query:', error);
      }
    }
    
    const res = await fetch(queryKey[0] as string, {
      headers,
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
