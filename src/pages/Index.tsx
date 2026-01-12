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
  }, [spotify]);

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
    isPlaying: spotify.playbackState?.isPlaying || false,
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

      <div className="flex-1 ml-[72px] flex flex-col h-screen">
        <header className="h-16 flex items-center justify-between px-6 bg-transparent shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
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

            {nextPrayer && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <Moon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">{nextPrayer.name}</span>
                <span className="font-arabic text-sm text-accent">{nextPrayer.arabicName}</span>
                <span className="text-sm font-bold text-foreground">{nextPrayer.time}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground border-l border-border/50 pl-2 ml-1">
                  <Clock className="h-3 w-3" />
                  <span>{timeUntilNext}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
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
          <main className="flex-1 overflow-y-auto pb-32 no-scrollbar">
            {activeTab === "dashboard" && <UnifiedDashboard localFolderTracks={mediaLibrary.localTracks} />}
            {activeTab === "azan" && (
              <div className="p-6 max-w-2xl mx-auto animate-fade-in">
                <AzanPlayer
                  {...azanScheduler}
                  onPrayerTimesUpdate={updatePrayerTimes}
                  onLocationChange={updateLocation}
                />
              </div>
            )}
            {activeTab === "pa" && (
              <div className="p-6 max-w-4xl mx-auto animate-fade-in">
                <PASystem />
              </div>
            )}
            {activeTab === "admin" && (
              <div className="p-6 animate-fade-in">
                <AdminPanel />
              </div>
            )}
            {activeTab === "settings" && (
              <div className="p-6 animate-fade-in">
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
