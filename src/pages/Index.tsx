import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IconSidebar } from "@/components/IconSidebar";
import { UnifiedDashboard } from "@/components/UnifiedDashboard";
import { SidebarPanel } from "@/components/SidebarPanel";
import { AzanPlayer } from "@/components/AzanPlayer";
import { PASystem } from "@/components/PASystem";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AdminPanel } from "@/components/AdminPanel";
import { PlaybackBar } from "@/components/PlaybackBar";
import { AudioUnlockOverlay } from "@/components/AudioUnlockOverlay";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { useAzanScheduler } from "@/hooks/useAzanScheduler";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ChevronLeft, ChevronRight, ListMusic, Moon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";


const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { prayerTimes, nextPrayer, timeUntilNext, updatePrayerTimes, updateLocation } = usePrayerTimes();
  const mediaLibrary = useMediaLibrary();
  const spotify = useSpotify();
  const unifiedAudio = useUnifiedAudio();

  const handleFadeOut = useCallback(
    async (durationMs: number) => {
      if (spotify.isConnected && spotify.playbackState?.isPlaying) {
        await spotify.fadeVolume(0, durationMs);
      }
    },
    [spotify],
  );

  const handleFadeIn = useCallback(
    async (durationMs: number) => {
      if (spotify.isConnected) {
        await spotify.fadeVolume(100, durationMs);
      }
    },
    [spotify],
  );

  const handlePause = useCallback(async () => {
    if (spotify.isConnected && spotify.playbackState?.isPlaying) {
      await spotify.pause();
    }
    // Also pause local audio
    if (unifiedAudio.isPlaying) {
      unifiedAudio.pause();
    }
  }, [spotify, unifiedAudio]);

  const handleResume = useCallback(async () => {
    if (spotify.isConnected) {
      await spotify.play();
    }
  }, [spotify]);

  const azanScheduler = useAzanScheduler({
    prayerTimes,
    onFadeOut: handleFadeOut,
    onFadeIn: handleFadeIn,
    onPause: handlePause,
    onResume: handleResume,
    isPlaying: spotify.playbackState?.isPlaying || unifiedAudio.isPlaying || false,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (unifiedAudio.currentTrack && !showNowPlaying) {
      setShowNowPlaying(true);
    }
  }, [unifiedAudio.currentTrack]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      <IconSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main content - responsive margin */}
      <div className="flex-1 md:ml-[72px] flex flex-col h-screen">
        <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 bg-transparent shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            {/* Nav buttons - hidden on mobile */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-black/40"
                onClick={() => window.history.back()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-black/40"
                onClick={() => window.history.forward()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Next Prayer - Compact on mobile */}
            {nextPrayer && (
              <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-primary/10 border border-primary/20 ml-10 md:ml-0">
                <Moon className="h-3 md:h-4 w-3 md:w-4 text-primary" />
                <span className="text-xs md:text-sm font-medium text-primary">{nextPrayer.name}</span>
                <span className="hidden sm:inline font-arabic text-xs md:text-sm text-accent">{nextPrayer.arabicName}</span>
                <span className="text-xs md:text-sm font-bold text-foreground">{nextPrayer.time}</span>
                <div className="hidden sm:flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground border-l border-border/50 pl-1.5 md:pl-2 ml-0.5 md:ml-1">
                  <Clock className="h-2.5 md:h-3 w-2.5 md:w-3" />
                  <span>{timeUntilNext}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full transition-colors ${showNowPlaying ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => setShowNowPlaying(!showNowPlaying)}
            >
              <ListMusic className="h-5 w-5" />
            </Button>
            <UserMenu />
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto pb-24 md:pb-32 no-scrollbar">
            {activeTab === "dashboard" && <UnifiedDashboard localFolderTracks={mediaLibrary.localTracks} />}
            {activeTab === "azan" && (
              <div className="p-4 md:p-6 max-w-2xl mx-auto animate-fade-in">
                <AzanPlayer
                  {...azanScheduler}
                  onPrayerTimesUpdate={updatePrayerTimes}
                  onLocationChange={updateLocation}
                />
              </div>
            )}
            {activeTab === "pa" && (
              <div className="p-4 md:p-6 max-w-4xl mx-auto animate-fade-in">
                <PASystem />
              </div>
            )}
            {activeTab === "admin" && (
              <div className="p-4 md:p-6 animate-fade-in">
                <AdminPanel />
              </div>
            )}
            {activeTab === "settings" && (
              <div className="p-4 md:p-6 animate-fade-in">
                <SettingsPanel />
              </div>
            )}
          </main>

          {showNowPlaying && (
            <SidebarPanel isOpen={true} onClose={() => setShowNowPlaying(false)} />
          )}
        </div>
      </div>
      <PlaybackBar />
      
      {/* iOS/Safari Audio Unlock Overlay */}
      <AudioUnlockOverlay />
    </div>
  );
};

export default Index;
