import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Credentials
const CLIENT_ID = "dH1Xed1fpITYonugor6sw39jvdq58M3h";
const OAUTH_TOKEN = "OAuth 2-310286-92172367-WPpVc4VRL7UmlRO";

const App = () => {
  useEffect(() => {
    // 1. Initialize Credentials
    // We store these in localStorage so your service files can read them easily
    // without needing to pass props everywhere.
    localStorage.setItem("SC_CLIENT_ID", CLIENT_ID);
    localStorage.setItem("SC_OAUTH_TOKEN", OAUTH_TOKEN);

    console.log("Harmony Hub: SoundCloud credentials initialized.");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
