import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import Home from "@/pages/home";
import Entries from "@/pages/entries";
import EntryDetail from "@/pages/entry-detail";
import Insights from "@/pages/insights";
import Settings from "@/pages/settings";
import SettingsIntegrations from "@/pages/settings-integrations";
import GoogleSetup from "@/pages/google-setup";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";

function ProtectedRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/entries" component={Entries} />
      <Route path="/entry/:id" component={EntryDetail} />
      <Route path="/insights" component={Insights} />
      <Route path="/settings" component={Settings} />
      <Route path="/settings/integrations" component={SettingsIntegrations} />
      <Route path="/google-setup" component={GoogleSetup} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="journal-ui-theme">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <ProtectedRouter />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
