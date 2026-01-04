import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SpotifyProvider } from "@/contexts/SpotifyContext";
import { SoundCloudProvider } from "@/contexts/SoundCloudContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PAProvider } from "@/contexts/PAContext";
import { UnifiedAudioProvider } from "@/contexts/UnifiedAudioContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import SpotifyCallback from "./pages/SpotifyCallback";
import SoundCloudCallback from "./pages/SoundCloudCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SpotifyProvider>
          <SoundCloudProvider>
            <PAProvider>
              <UnifiedAudioProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/spotify-callback" element={<SpotifyCallback />} />
                    <Route path="/soundcloud-callback" element={<SoundCloudCallback />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </UnifiedAudioProvider>
            </PAProvider>
          </SoundCloudProvider>
        </SpotifyProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
