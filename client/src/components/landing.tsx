import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Brain, Lock, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <BookOpen className="h-12 w-12 text-[#6366F1]" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Journal</h1>
          <p className="text-gray-600">Transform your handwritten thoughts into digital insights</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4 mb-6">
              <div className="flex items-center space-x-3">
                <Brain className="h-5 w-5 text-[#6366F1]" />
                <span className="text-sm text-gray-600">AI-powered text extraction and analysis</span>
              </div>
              <div className="flex items-center space-x-3">
                <Lock className="h-5 w-5 text-[#6366F1]" />
                <span className="text-sm text-gray-600">Secure personal journal storage</span>
              </div>
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-[#6366F1]" />
                <span className="text-sm text-gray-600">Multi-user support with privacy</span>
              </div>
            </div>
            
            <Button 
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5]"
              onClick={() => window.location.href = '/api/login'}
            >
              Continue with Replit
            </Button>
            
            <p className="text-xs text-gray-500 text-center mt-4">
              Secure authentication powered by Replit
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}