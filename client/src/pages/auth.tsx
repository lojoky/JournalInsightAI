import { useState } from "react";
import LoginForm from "@/components/auth/login-form";
import SignupForm from "@/components/auth/signup-form";
import { useAuth } from "@/components/auth/auth-provider";
import { useLocation } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleAuthSuccess = (user: any) => {
    login(user);
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#111827] mb-2">
            Journal AI
          </h1>
          <p className="text-gray-600">
            Transform your handwritten thoughts into meaningful insights
          </p>
        </div>

        {isLogin ? (
          <LoginForm
            onSuccess={handleAuthSuccess}
            onSwitchToSignup={() => setIsLogin(false)}
          />
        ) : (
          <SignupForm
            onSuccess={handleAuthSuccess}
            onSwitchToLogin={() => setIsLogin(true)}
          />
        )}
      </div>
    </div>
  );
}