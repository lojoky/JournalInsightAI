import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { auth, handleAuthRedirect } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);

  // Handle Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsFirebaseLoading(false);
    });

    // Handle redirect result on app load
    handleAuthRedirect().catch(console.error);

    return () => unsubscribe();
  }, []);

  // Fallback to Replit auth if Firebase user is not available
  const { data: replitUser, isLoading: isReplitLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: !firebaseUser && !isFirebaseLoading,
  });

  const user = firebaseUser || replitUser;
  const isLoading = isFirebaseLoading || (isReplitLoading && !firebaseUser);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    authMethod: firebaseUser ? 'google' : 'replit',
  };
}