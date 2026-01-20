import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Volume2, Clock, MapPin, Wifi, WifiOff, Database, RefreshCw, Cast, Cloud, Trash2, Download, Palette } from "lucide-react";
import { CastingSettings } from "./CastingSettings";
import { SeekBarColorSettings } from "./settings/SeekBarColorSettings";
import { useOfflineSupport, clearAudioCache } from "@/hooks/useOfflineSupport";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export const SettingsPanel = () => {
  const { isOnline, cachedPrayerTimes, clearCache, isPrayerTimesCacheStale } = useOfflineSupport();
  const { toast } = useToast();

  const handleClearAllCache = async () => {
    clearCache();
    await clearAudioCache();
    
    // Clear service worker cache
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    toast({
      title: "Cache Cleared",
      description: "All offline data has been removed",
    });
  };

  const handleInstallPWA = async () => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      toast({
        title: "Already Installed",
        description: "App is already installed on your device",
      });
      return;
    }

    toast({
      title: "Install App",
      description: "Use your browser's 'Add to Home Screen' option to install",
    });
  };

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="general" className="gap-2">
          <Settings className="h-4 w-4" />
          General
        </TabsTrigger>
        <TabsTrigger value="appearance" className="gap-2">
          <Palette className="h-4 w-4" />
          Appearance
        </TabsTrigger>
        <TabsTrigger value="casting" className="gap-2">
          <Cast className="h-4 w-4" />
          Casting & AirPlay
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Audio Settings */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-accent" />
                Audio Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Master Volume</Label>
                  <span className="text-sm font-medium">85%</span>
                </div>
                <Slider defaultValue={[85]} max={100} step={1} />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Auto-duck Media</Label>
                  <p className="text-xs text-muted-foreground">Lower media volume during announcements</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Cross-fade Tracks</Label>
                  <p className="text-xs text-muted-foreground">Smooth transitions between tracks</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Default Output Device</Label>
                <Select defaultValue="main">
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Main Speakers</SelectItem>
                    <SelectItem value="aux">Auxiliary Output</SelectItem>
                    <SelectItem value="headphones">Headphones</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Prayer Time Settings */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" />
                Prayer Time Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </Label>
                <Input 
                  placeholder="Enter city or coordinates" 
                  defaultValue="Makkah, Saudi Arabia"
                  className="bg-secondary/50 border-border/50"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Calculation Method</Label>
                <Select defaultValue="mwl">
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mwl">Muslim World League</SelectItem>
                    <SelectItem value="isna">ISNA</SelectItem>
                    <SelectItem value="egypt">Egyptian General Authority</SelectItem>
                    <SelectItem value="makkah">Umm al-Qura University</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Juristic Method (Asr)</Label>
                <Select defaultValue="standard">
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (Shafi, Maliki, Hanbali)</SelectItem>
                    <SelectItem value="hanafi">Hanafi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Sync Prayer Times
              </Button>
            </CardContent>
          </Card>

          {/* System Settings */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-accent" />
                System Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Auto-start on boot</Label>
                  <p className="text-xs text-muted-foreground">Start system when device powers on</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Remote Access</Label>
                  <p className="text-xs text-muted-foreground">Allow control from other devices</p>
                </div>
                <Switch />
              </div>

              <div className="p-3 rounded-lg bg-secondary/30 space-y-2">
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <Wifi className="h-4 w-4 text-primary" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm">Network: {isOnline ? 'Connected' : 'Offline'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <span className="text-sm">Storage: 45.2 GB free</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Offline & Cache Settings */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-accent" />
                Offline & Cache
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status */}
              <div className="p-3 rounded-lg bg-secondary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Connection Status</span>
                  <Badge variant={isOnline ? "secondary" : "destructive"}>
                    {isOnline ? (
                      <><Wifi className="h-3 w-3 mr-1" /> Online</>
                    ) : (
                      <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
                    )}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Prayer Times Cache</span>
                  <Badge variant={cachedPrayerTimes ? (isPrayerTimesCacheStale() ? "outline" : "secondary") : "destructive"}>
                    {cachedPrayerTimes 
                      ? (isPrayerTimesCacheStale() ? "Outdated" : "Fresh")
                      : "Not Cached"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Service Worker</span>
                  <Badge variant="secondary">
                    {'serviceWorker' in navigator ? 'Active' : 'Not Supported'}
                  </Badge>
                </div>
              </div>

              {/* Cached Data Info */}
              {cachedPrayerTimes && (
                <div className="p-3 rounded-lg border border-border/50 space-y-2">
                  <p className="text-xs text-muted-foreground">Cached Prayer Times</p>
                  <p className="text-sm font-medium">
                    {cachedPrayerTimes.location.city}, {cachedPrayerTimes.location.country}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cached on: {new Date(cachedPrayerTimes.cachedAt).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={handleInstallPWA}
                >
                  <Download className="h-4 w-4" />
                  Install App
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full gap-2 text-destructive hover:text-destructive"
                  onClick={handleClearAllCache}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All Cache
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Local audio files are always available offline. Spotify and YouTube require internet.
              </p>
            </CardContent>
          </Card>

          {/* Backup & Data */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-accent" />
                Backup & Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full">Export Settings</Button>
              <Button variant="outline" className="w-full">Import Settings</Button>
              <Button variant="outline" className="w-full">Backup Media Library</Button>
              <div className="pt-2 border-t border-border">
                <Button variant="destructive" className="w-full">Reset to Defaults</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="appearance">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SeekBarColorSettings />
        </div>
      </TabsContent>

      <TabsContent value="casting">
        <CastingSettings />
      </TabsContent>
    </Tabs>
  );
};
