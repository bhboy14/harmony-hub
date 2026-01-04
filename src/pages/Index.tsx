import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IconSidebar } from "@/components/IconSidebar";
import { HomeContent } from "@/components/HomeContent";
import { NowPlayingPanel } from "@/components/NowPlayingPanel";
import { MusicBrowser } from "@/components/MusicBrowser";
import { AzanPlayer } from "@/components/AzanPlayer";
import { PASystem } from "@/components/PASystem";
import { MediaLibrary } from "@/components/MediaLibrary";
import { SpotifyPlayer } from "@/components/SpotifyPlayer";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AdminPanel } from "@/components/AdminPanel";
import { PlaybackBar } from "@/components/PlaybackBar";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useMediaLibrary, Track } from "@/hooks/useMediaLibrary";
import { useAzanScheduler } from "@/hooks/useAzanScheduler";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Youtube, HardDrive, ChevronLeft, ChevronRight, User, ListMusic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";

// Spotify brand icon
const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { prayerTimes, nextPrayer, timeUntilNext } = usePrayerTimes();
  const mediaLibrary = useMediaLibrary();
  const spotify = useSpotify();
  const unifiedAudio = useUnifiedAudio();
  const { toast } = useToast();

  // Azan scheduler integration
  const handleFadeOut = useCallback(async (durationMs: number) => {
    if (spotify.isConnected && spotify.playbackState?.isPlaying) {
      await spotify.fadeVolume(0, durationMs);
    }
  }, [spotify]);

  const handleFadeIn = useCallback(async (durationMs: number) => {
    if (spotify.isConnected) {
      await spotify.fadeVolume(100, durationMs);
    }
  }, [spotify]);

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

  const handlePlayAzan = useCallback(async () => {
    toast({ title: "Azan", description: "Playing Azan..." });
  }, [toast]);

  const azanScheduler = useAzanScheduler({
    prayerTimes,
    onFadeOut: handleFadeOut,
    onFadeIn: handleFadeIn,
    onPause: handlePause,
    onResume: handleResume,
    onPlayAzan: handlePlayAzan,
    isPlaying: spotify.playbackState?.isPlaying || false,
  });

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  // Show now playing when a track is active
  useEffect(() => {
    if (unifiedAudio.currentTrack && !showNowPlaying) {
      setShowNowPlaying(true);
    }
  }, [unifiedAudio.currentTrack]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Icon Sidebar */}
      <IconSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Main Content Area */}
      <div className="flex-1 ml-[72px] flex flex-col h-screen">
        {/* Top Header Bar */}
        <header className="h-16 flex items-center justify-between px-6 bg-transparent">
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
          
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full ${showNowPlaying ? 'text-primary' : 'text-muted-foreground'}`}
              onClick={() => setShowNowPlaying(!showNowPlaying)}
            >
              <ListMusic className="h-5 w-5" />
            </Button>
            <UserMenu />
          </div>
        </header>

        {/* Content + Now Playing */}
        <div className="flex-1 flex overflow-hidden pb-20">
          {/* Main Content */}
          <main className="flex-1 overflow-hidden">
            {activeTab === "dashboard" && (
              <HomeContent onOpenSearch={() => setActiveTab("search")} />
            )}

            {activeTab === "search" && (
              <div className="p-6 animate-fade-in">
                <MusicBrowser onOpenFullLibrary={() => setActiveTab("library")} />
              </div>
            )}

            {activeTab === "library" && (
              <div className="p-6 h-full animate-fade-in overflow-y-auto custom-scrollbar pb-32">
                <Tabs defaultValue="spotify" className="space-y-6">
                  <TabsList className="bg-secondary">
                    <TabsTrigger value="spotify" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background">
                      <div className="text-[#1DB954]"><SpotifyIcon /></div>
                      Spotify
                    </TabsTrigger>
                    <TabsTrigger value="youtube" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background">
                      <Youtube className="h-4 w-4 text-[#FF0000]" />
                      YouTube
                    </TabsTrigger>
                    <TabsTrigger value="local" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background">
                      <HardDrive className="h-4 w-4" />
                      Local
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="spotify" className="h-[calc(100vh-14rem)]">
                    <SpotifyPlayer />
                  </TabsContent>
                  <TabsContent value="youtube" className="h-[calc(100vh-14rem)]">
                    <YouTubePlayer />
                  </TabsContent>
                  <TabsContent value="local" className="h-[calc(100vh-14rem)]">
                    <MediaLibrary 
                      {...mediaLibrary} 
                      playTrack={(track: Track) => {
                        unifiedAudio.playLocalTrack({
                          id: track.id,
                          title: track.title,
                          artist: track.artist,
                          duration: track.duration,
                          fileHandle: track.fileHandle,
                          url: track.url,
                          albumArt: track.albumArt,
                        });
                      }}
                      currentTrack={unifiedAudio.activeSource === 'local' && unifiedAudio.currentTrack ? {
                        id: unifiedAudio.currentTrack.id,
                        title: unifiedAudio.currentTrack.title,
                        artist: unifiedAudio.currentTrack.artist,
                        duration: mediaLibrary.currentTrack?.duration || '0:00',
                        source: 'local',
                        albumArt: unifiedAudio.currentTrack.albumArt,
                      } : null}
                      isPlaying={unifiedAudio.activeSource === 'local' && unifiedAudio.isPlaying}
                      pauseTrack={() => unifiedAudio.pause()}
                      resumeTrack={() => unifiedAudio.play()}
                      volume={unifiedAudio.volume}
                      setVolume={(v) => unifiedAudio.setVolume(v)}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {activeTab === "azan" && (
              <div className="p-6 max-w-2xl mx-auto animate-fade-in overflow-y-auto h-full custom-scrollbar pb-32">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-foreground">Athan Schedule</h1>
                  <p className="text-muted-foreground mt-1">Configure automated prayer calls</p>
                </div>
                <AzanPlayer 
                  isAzanPlaying={azanScheduler.isAzanPlaying}
                  onTestAzan={azanScheduler.testAzanSequence}
                  settings={{
                    reciter: "mishary",
                    fadeInDuration: azanScheduler.settings.fadeInDuration,
                    fadeOutDuration: azanScheduler.settings.fadeOutDuration,
                    postAzanAction: azanScheduler.settings.postAzanAction,
                    postAzanDelay: azanScheduler.settings.postAzanDelay,
                    enabled: azanScheduler.settings.enabled,
                    minutesBefore: azanScheduler.settings.minutesBefore,
                  }}
                  onSettingsChange={(newSettings) => {
                    azanScheduler.setSettings({
                      ...azanScheduler.settings,
                      fadeInDuration: newSettings.fadeInDuration,
                      fadeOutDuration: newSettings.fadeOutDuration,
                      postAzanAction: newSettings.postAzanAction,
                      postAzanDelay: newSettings.postAzanDelay,
                      enabled: newSettings.enabled,
                      minutesBefore: newSettings.minutesBefore,
                    });
                  }}
                />
              </div>
            )}

            {activeTab === "pa" && (
              <div className="p-6 max-w-4xl mx-auto animate-fade-in overflow-y-auto h-full custom-scrollbar pb-32">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-foreground">Broadcast Mode</h1>
                  <p className="text-muted-foreground mt-1">Live announcements</p>
                </div>
                <PASystem />
              </div>
            )}

            {activeTab === "admin" && (
              <div className="p-6 animate-fade-in overflow-y-auto h-full custom-scrollbar pb-32">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-foreground">User Management</h1>
                  <p className="text-muted-foreground mt-1">Manage roles and permissions</p>
                </div>
                <AdminPanel />
              </div>
            )}

            {activeTab === "settings" && (
              <div className="p-6 animate-fade-in overflow-y-auto h-full custom-scrollbar pb-32">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-foreground">Settings</h1>
                  <p className="text-muted-foreground mt-1">Configure preferences</p>
                </div>
                <SettingsPanel />
              </div>
            )}
          </main>

          {/* Now Playing Panel */}
          <NowPlayingPanel 
            isOpen={showNowPlaying} 
            onClose={() => setShowNowPlaying(false)} 
          />
        </div>
      </div>
      
      {/* Playback Bar */}
      <PlaybackBar />
    </div>
  );
};

export default Index;
