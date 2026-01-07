import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IconSidebar } from "@/components/IconSidebar";
import { DashboardMusic } from "@/components/DashboardMusic";
import { NowPlayingPanel } from "@/components/NowPlayingPanel";
import { AzanPlayer } from "@/components/AzanPlayer";
import { PASystem } from "@/components/PASystem";
import { MediaLibrary } from "@/components/MediaLibrary";
import { SpotifyPlayer } from "@/components/SpotifyPlayer";
import { SoundCloudPlayer } from "@/components/SoundCloudPlayer";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AdminPanel } from "@/components/AdminPanel";
import { PlaybackBar } from "@/components/PlaybackBar";
import { UnifiedLibrary } from "@/components/UnifiedLibrary";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useMediaLibrary, Track } from "@/hooks/useMediaLibrary";
import { useAzanScheduler } from "@/hooks/useAzanScheduler";
import { useSpotify, SpotifyContextType } from "@/contexts/SpotifyContext";
import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Youtube, HardDrive, ChevronLeft, ChevronRight, ListMusic, Moon, Clock, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";

// Helper to fix the TS2322 Error: Converts number duration to string "MM:SS"
const formatDuration = (duration: number | string | undefined): string => {
  if (!duration) return "0:00";
  if (typeof duration === "string") return duration;
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

const SoundCloudIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.09-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.165 1.308c.014.057.044.09.09.09.043 0 .073-.033.085-.09l.184-1.308-.175-1.332c-.009-.052-.04-.09-.09-.09m1.83-1.229c-.061 0-.12.045-.12.104l-.21 2.563.225 2.458c0 .06.045.09.104.09.061 0 .104-.045.12-.09l.239-2.458-.239-2.563c-.016-.06-.061-.104-.119-.104m.945-.089c-.075 0-.135.061-.15.135l-.193 2.64.21 2.544c.016.077.075.138.149.138.075 0 .135-.061.15-.138l.24-2.544-.24-2.544-.24-2.64c-.015-.074-.074-.135-.149-.135l-.017.0m1.155.36c-.005-.09-.075-.149-.159-.149-.09 0-.158.06-.164.149l-.217 2.43.2 2.563c0 .09.074.15.164.15.09 0 .164-.06.164-.15l.226-2.563-.214-2.43m.809-1.709c-.09 0-.18.075-.18.18l-.2 3.96.2 2.624c0 .105.09.18.18.18s.165-.075.18-.18l.2-2.624-.2-3.96c-.015-.105-.09-.18-.18-.18m.871-.449c-.104 0-.194.09-.194.195l-.18 4.23.18 2.67c0 .12.09.21.194.21.105 0 .195-.09.195-.21l.21-2.67-.21-4.23c0-.105-.09-.195-.195-.195m.88-.45c-.12 0-.211.104-.211.227l-.165 4.5.165 2.685c0 .135.09.225.21.225.12 0 .212-.09.227-.225l.18-2.685-.18-4.5c-.015-.12-.105-.227-.227-.227m.897-.39c-.135 0-.239.105-.239.24l-.149 4.62.149 2.684c.015.135.104.24.24.24.119 0 .224-.105.239-.24l.164-2.684-.164-4.62c-.015-.135-.12-.24-.24-.24m1.154.24c-.15 0-.27.135-.27.271l-.122 4.14.136 2.695c0 .15.12.27.256.27.15 0 .27-.12.285-.27l.151-2.695-.151-4.14c-.014-.136-.135-.271-.285-.271m.88-.269c-.165 0-.285.135-.285.3l-.12 4.11.12 2.7c.015.165.12.285.285.285.165 0 .285-.12.3-.285l.135-2.7-.135-4.11c-.015-.165-.135-.3-.3-.3m2.175-1.035c-.045-.015-.09-.015-.135-.015-.165 0-.315.135-.33.315l-.105 5.16.105 2.73c.015.18.165.315.33.315.165 0 .315-.135.33-.315l.12-2.73-.12-5.16c-.015-.18-.165-.315-.33-.315-.045 0-.09 0-.135.015-.06.015.06-.015 0 0m.87-.57c-.195 0-.345.15-.345.36l-.09 5.37.105 2.715c.015.21.15.36.33.36.195 0 .36-.15.36-.36l.12-2.715-.12-5.37c0-.21-.165-.36-.36-.36m.885-.135c-.21 0-.375.165-.375.39l-.075 5.265.09 2.73c.015.225.165.39.375.39.21 0 .375-.165.39-.39l.105-2.73-.105-5.265c-.015-.225-.18-.39-.39-.39m.89.135c-.21 0-.39.18-.39.405l-.075 4.935.09 2.73c.015.24.18.405.375.405.225 0 .405-.165.405-.405l.105-2.73-.105-4.935c0-.225-.18-.405-.405-.405m1.095-.405c-.045-.015-.09-.015-.135-.015-.225 0-.405.195-.405.435l-.06 5.1.075 2.73c0 .24.18.435.42.435.225 0 .42-.195.435-.435l.09-2.73-.09-5.1c0-.24-.195-.435-.435-.435 0 0-.045 0-.09-.015l.195.03m.88-.195c-.24 0-.435.21-.435.465l-.045 5.085.06 2.745c.015.255.195.45.435.45.24 0 .435-.195.45-.45l.075-2.745-.075-5.085c-.015-.255-.21-.465-.45-.465m1.095.135c-.24 0-.45.225-.465.48l-.03 4.53.03 2.745c.015.27.225.48.465.48s.45-.21.465-.48l.045-2.745-.045-4.53c-.015-.255-.225-.48-.465-.48m1.5.465c-.075-.27-.315-.45-.57-.45-.255 0-.495.18-.555.45l-.03 4.11.045 2.73c.06.3.3.495.54.495.255 0 .495-.195.555-.495l.045-2.73-.045-4.11m3.09.495c-.105-.03-.21-.045-.315-.045-.54 0-1.005.36-1.17.855-.165-.03-.345-.045-.525-.045-1.53 0-2.775 1.26-2.775 2.805 0 1.545 1.245 2.805 2.775 2.805h4.095c.885 0 1.605-.735 1.605-1.635V12.7c0-2.655-2.085-4.815-4.665-4.965" />
  </svg>
);

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
            {activeTab === "dashboard" && <DashboardMusic />}
            {activeTab === "library" && (
              <div className="p-6 h-full animate-fade-in flex flex-col">
                <Tabs defaultValue="unified" className="flex-1 flex flex-col space-y-6">
                  <TabsList className="bg-secondary shrink-0">
                    <TabsTrigger
                      value="unified"
                      className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background"
                    >
                      <Library className="h-4 w-4" /> Unified
                    </TabsTrigger>
                    <TabsTrigger
                      value="spotify"
                      className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background"
                    >
                      <div className="text-[#1DB954]">
                        <SpotifyIcon />
                      </div>{" "}
                      Spotify
                    </TabsTrigger>
                    <TabsTrigger
                      value="soundcloud"
                      className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background"
                    >
                      <div className="text-[#FF5500]">
                        <SoundCloudIcon />
                      </div>{" "}
                      SoundCloud
                    </TabsTrigger>
                    <TabsTrigger
                      value="youtube"
                      className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background"
                    >
                      <Youtube className="h-4 w-4 text-[#FF0000]" /> YouTube
                    </TabsTrigger>
                    <TabsTrigger
                      value="local"
                      className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background"
                    >
                      <HardDrive className="h-4 w-4" /> Local
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-hidden">
                    <TabsContent value="unified" className="h-full mt-0 overflow-y-auto no-scrollbar">
                      <UnifiedLibrary localFolderTracks={mediaLibrary.localTracks} />
                    </TabsContent>
                    <TabsContent value="spotify" className="h-full mt-0 overflow-y-auto no-scrollbar">
                      <SpotifyPlayer />
                    </TabsContent>
                    <TabsContent value="soundcloud" className="h-full mt-0 overflow-y-auto no-scrollbar">
                      <SoundCloudPlayer />
                    </TabsContent>
                    <TabsContent value="youtube" className="h-full mt-0 overflow-y-auto no-scrollbar">
                      <YouTubePlayer />
                    </TabsContent>
                    <TabsContent value="local" className="h-full mt-0">
                      <MediaLibrary
                        {...mediaLibrary}
                        playTrack={(track) => unifiedAudio.playLocalTrack({ ...track })}
                        currentTrack={
                          unifiedAudio.activeSource === "local" && unifiedAudio.currentTrack
                            ? ({
                                ...unifiedAudio.currentTrack,
                                duration: formatDuration(unifiedAudio.currentTrack.duration),
                              } as Track)
                            : null
                        }
                        isPlaying={unifiedAudio.activeSource === "local" && unifiedAudio.isPlaying}
                        pauseTrack={() => unifiedAudio.pause()}
                        resumeTrack={() => unifiedAudio.play()}
                        volume={unifiedAudio.volume}
                        setVolume={(v) => unifiedAudio.setVolume(v)}
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            )}

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
            <aside className="w-80 border-l border-white/10 bg-black/40 flex flex-col h-full animate-in slide-in-from-right duration-300 shrink-0">
              <NowPlayingPanel isOpen={true} onClose={() => setShowNowPlaying(false)} />
            </aside>
          )}
        </div>
      </div>
      <PlaybackBar />
    </div>
  );
};

export default Index;
