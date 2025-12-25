import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { PrayerTimesCard } from "@/components/PrayerTimesCard";
import { AzanPlayer } from "@/components/AzanPlayer";
import { PASystem } from "@/components/PASystem";
import { MediaLibrary } from "@/components/MediaLibrary";
import { SettingsPanel } from "@/components/SettingsPanel";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Clock, Music } from "lucide-react";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { prayerTimes, nextPrayer, timeUntilNext } = usePrayerTimes();
  const mediaLibrary = useMediaLibrary();

  const StatCard = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) => (
    <Card className="glass-panel">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${accent ? "bg-accent/20" : "bg-primary/20"}`}>
            <Icon className={`h-6 w-6 ${accent ? "text-accent" : "text-primary"}`} />
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
              <p className="text-muted-foreground mt-1">Manage your masjid's audio and prayer systems</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Clock} label="Next Prayer" value={nextPrayer?.name || "—"} />
              <StatCard icon={Activity} label="Time Until" value={timeUntilNext || "—"} accent />
              <StatCard icon={Music} label="Library Tracks" value={mediaLibrary.tracks.length.toString()} />
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
                {mediaLibrary.currentTrack && (
                  <Card className="glass-panel bg-gradient-to-br from-primary/5 to-accent/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Music className="h-4 w-4 text-primary" />
                        Now Playing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium text-foreground">{mediaLibrary.currentTrack.title}</p>
                      <p className="text-sm text-muted-foreground">{mediaLibrary.currentTrack.artist}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "library" && (
          <div className="h-[calc(100vh-4rem)] animate-fade-in">
            <MediaLibrary {...mediaLibrary} />
          </div>
        )}

        {activeTab === "azan" && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground">Azan Player</h1>
              <p className="text-muted-foreground mt-1">Configure automated prayer calls</p>
            </div>
            <AzanPlayer />
          </div>
        )}

        {activeTab === "pa" && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-foreground">PA System</h1>
              <p className="text-muted-foreground mt-1">Broadcast announcements to all zones</p>
            </div>
            <PASystem />
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
