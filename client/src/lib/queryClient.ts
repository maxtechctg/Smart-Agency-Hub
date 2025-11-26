import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0] as string;
        const token = localStorage.getItem("token");
        
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(url, {
          headers,
          credentials: "include",
        });

        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/login";
          }
          const errorData = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(errorData.error || `Request failed with status ${res.status}`);
        }

        return res.json();
      },
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function apiRequest<T = any>(
  method: RequestMethod,
  url: string,
  data?: any
): Promise<T> {
  const token = localStorage.getItem("token");
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
    credentials: "include",
  };

  if (data && method !== "GET") {
    options.body = JSON.stringify(data);
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    const errorData = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(errorData.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}
