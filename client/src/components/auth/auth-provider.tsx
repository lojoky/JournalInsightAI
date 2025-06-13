import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { queryClient } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previousUserId, setPreviousUserId] = useState<number | null>(null);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = (userData: User) => {
    // Clear cache before setting new user to prevent data leaks
    queryClient.clear();
    setUser(userData);
  };

  const logout = async () => {
    try {
      // Clear cache first to prevent data leaks
      queryClient.clear();
      
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setPreviousUserId(null);
      
      // Clear cache again after logout to ensure clean state
      setTimeout(() => {
        queryClient.clear();
      }, 100);
    }
  };

  // Clear cache when user changes to prevent cross-user data leaks
  useEffect(() => {
    const currentUserId = user?.id || null;
    
    // If user ID changed (including null to non-null or vice versa)
    if (currentUserId !== previousUserId) {
      // Aggressive cache clearing to prevent deployment data leaks
      queryClient.clear();
      
      // Additional cache invalidation for specific queries
      queryClient.invalidateQueries({ 
        queryKey: ['/api/journal-entries'] 
      });
      
      // Force remove all cached data
      queryClient.removeQueries();
      
      setPreviousUserId(currentUserId);
    }
  }, [user?.id, previousUserId]);

  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    user,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}