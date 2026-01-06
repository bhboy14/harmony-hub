import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { SpotifyProvider } from "@/contexts/SpotifyContext";
import { SoundCloudProvider } from "@/contexts/SoundCloudContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PAProvider } from "@/contexts/PAContext";
import { UnifiedAudioProvider } from "@/contexts/UnifiedAudioContext";
import { CastingProvider } from "@/contexts/CastingContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import SpotifyCallback from "./pages/SpotifyCallback";
import SoundCloudCallback from "./pages/SoundCloudCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// --- SOUNDCLOUD CREDENTIALS ---
const SC_CLIENT_ID = "dH1Xed1fpITYonugor6sw39jvdq58M3h";
const SC_OAUTH_TOKEN = "OAuth 2-310286-92172367-WPpVc4VRL7UmlRO";
// ------------------------------

const App = () => {
  useEffect(() => {
    // 1. Initialize Credentials in localStorage
    // This allows src/lib/soundcloud.ts to read them without prop drilling
    localStorage.setItem("SC_CLIENT_ID", SC_CLIENT_ID);
    localStorage.setItem("SC_OAUTH_TOKEN", SC_OAUTH_TOKEN);
    console.log("Harmony Hub: SoundCloud credentials initialized.");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SpotifyProvider>
            <SoundCloudProvider>
              <UnifiedAudioProvider>
                <CastingProvider>
                  <PAProvider>
                    <Toaster />
                    <Sonner />
                    <BrowserRouter>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/auth" element={<Auth />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/spotify-callback" element={<SpotifyCallback />} />
                        <Route path="/soundcloud-callback" element={<SoundCloudCallback />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </BrowserRouter>
                  </PAProvider>
                </CastingProvider>
              </UnifiedAudioProvider>
            </SoundCloudProvider>
          </SpotifyProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
