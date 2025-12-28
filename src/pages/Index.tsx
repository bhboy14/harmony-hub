import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { PrayerTimesCard } from "@/components/PrayerTimesCard";
import { AzanPlayer } from "@/components/AzanPlayer";
import { PASystem } from "@/components/PASystem";
import { MediaLibrary } from "@/components/MediaLibrary";
import { SpotifyPlayer } from "@/components/SpotifyPlayer";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AdminPanel } from "@/components/AdminPanel";
import { RoleGate } from "@/components/RoleGate";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { useAzanScheduler, PostAzanAction } from "@/hooks/useAzanScheduler";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Users, Clock, Music, HardDrive, Music2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// Spotify brand icon
const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const navigate = useNavigate();
  const { user, isLoading: authLoading, role } = useAuth();
  const { prayerTimes, nextPrayer, timeUntilNext } = usePrayerTimes();
  const mediaLibrary = useMediaLibrary();
  const spotify = useSpotify();
  const { toast } = useToast();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

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
  // Azan scheduler integration with Spotify
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
    // In a real implementation, this would play the actual Azan audio
    // For now, we'll just show a toast
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

  const StatCard = ({ icon: Icon, label, value, accent, color }: { 
    icon: any; 
    label: string; 
    value: string; 
    accent?: boolean;
    color?: string;
  }) => (
    <Card className="glass-panel">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div 
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              color ? "" : accent ? "bg-accent/20" : "bg-primary/20"
            }`}
            style={color ? { backgroundColor: `${color}20` } : {}}
          >
            <Icon 
              className={`h-6 w-6 ${color ? "" : accent ? "text-accent" : "text-primary"}`}
              style={color ? { color } : {}}
            />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="ml-64 p-8">
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Your space, your sound, seamlessly integrated</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Clock} label="Next Prayer" value={nextPrayer?.name || "—"} />
              <StatCard icon={Activity} label="Time Until" value={timeUntilNext || "—"} accent />
              <StatCard 
                icon={SpotifyIcon} 
                label="Spotify" 
                value={spotify.isConnected ? "Connected" : "Disconnected"} 
                color="#1DB954"
              />
              <StatCard icon={Users} label="Active Zones" value="5" accent />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PrayerTimesCard 
                prayerTimes={prayerTimes} 
                nextPrayer={nextPrayer} 
                timeUntilNext={timeUntilNext} 
              />
              <div className="space-y-6">
                <Card className="glass-panel">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setActiveTab("azan")}
                      className="p-4 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all text-left"
                    >
                      <span className="font-arabic text-2xl text-accent block">الأذان</span>
                      <span className="text-sm text-muted-foreground">Play Azan</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab("pa")}
                      className="p-4 rounded-xl bg-accent/10 hover:bg-accent/20 border border-accent/20 transition-all text-left"
                    >
                      <span className="text-2xl">📢</span>
                      <span className="text-sm text-muted-foreground block">Announcement</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab("library")}
                      className="p-4 rounded-xl bg-secondary hover:bg-secondary/80 border border-border/50 transition-all text-left"
                    >
                      <span className="text-2xl">🎵</span>
                      <span className="text-sm text-muted-foreground block">Media Library</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab("settings")}
                      className="p-4 rounded-xl bg-secondary hover:bg-secondary/80 border border-border/50 transition-all text-left"
                    >
                      <span className="text-2xl">⚙️</span>
                      <span className="text-sm text-muted-foreground block">Settings</span>
                    </button>
                  </CardContent>
                </Card>
                
                {/* Now Playing Preview */}
                {spotify.playbackState?.track && (
                  <Card className="glass-panel bg-gradient-to-br from-[#1DB954]/10 to-primary/5 border-[#1DB954]/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div className="text-[#1DB954]"><SpotifyIcon /></div>
                        Now Playing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        {spotify.playbackState.track.album.images[0] && (
                          <img 
                            src={spotify.playbackState.track.album.images[0].url}
                            alt=""
                            className="w-12 h-12 rounded shadow"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {spotify.playbackState.track.name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {spotify.playbackState.track.artists.map(a => a.name).join(", ")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "library" && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground">Media Library</h1>
              <p className="text-muted-foreground mt-1">Manage local files and streaming music</p>
            </div>
            <Tabs defaultValue="spotify" className="space-y-6">
              <TabsList>
                <TabsTrigger value="spotify" className="gap-2">
                  <div className="text-[#1DB954]"><SpotifyIcon /></div>
                  Spotify
                </TabsTrigger>
                <TabsTrigger value="local" className="gap-2">
                  <HardDrive className="h-4 w-4" />
                  Local Library
                </TabsTrigger>
              </TabsList>
              <TabsContent value="spotify" className="h-[calc(100vh-12rem)]">
                <SpotifyPlayer />
              </TabsContent>
              <TabsContent value="local" className="h-[calc(100vh-12rem)]">
                <MediaLibrary {...mediaLibrary} />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {activeTab === "azan" && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground">Athan Schedule</h1>
              <p className="text-muted-foreground mt-1">Configure automated prayer calls with smart audio management</p>
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
          <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground">Broadcast Mode</h1>
              <p className="text-muted-foreground mt-1">Live announcements with professional audio effects</p>
            </div>
            <PASystem />
          </div>
        )}

        {activeTab === "admin" && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground">User Management</h1>
              <p className="text-muted-foreground mt-1">Manage user roles and permissions</p>
            </div>
            <AdminPanel />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground mt-1">Configure system preferences</p>
            </div>
            <SettingsPanel />
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
