import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Volume2, Settings2, Clock, Play, Pause, Upload, RotateCcw, Music, VolumeX, Mic, X, Check } from "lucide-react";
import { AzanPlayerSettings, MusicStopMode, PostAzanAction } from "@/hooks/useAzanPlayer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AzanPlayerProps {
  isAzanPlaying?: boolean;
  currentPrayer?: string | null;
  onTestAzan?: (prayerName?: string) => void;
  settings?: AzanPlayerSettings;
  onSettingsChange?: (settings: Partial<AzanPlayerSettings>) => void;
  onCustomAzanFile?: (file: File) => void;
  onResetToDefault?: () => void;
  onSetPrayerAnnouncement?: (prayer: string, file: File) => void;
  onClearPrayerAnnouncement?: (prayer: string) => void;
  nextScheduledPrayer?: string | null;
  prayerList?: string[];
}

export const AzanPlayer = ({ 
  isAzanPlaying = false, 
  currentPrayer,
  onTestAzan,
  settings,
  onSettingsChange,
  onCustomAzanFile,
  onResetToDefault,
  onSetPrayerAnnouncement,
  onClearPrayerAnnouncement,
  nextScheduledPrayer,
  prayerList = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"],
}: AzanPlayerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const announcementInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const defaultSettings: AzanPlayerSettings = {
    enabled: true,
    azanFile: "/audio/azan-default.mp3",
    volume: 80,
    fadeInDuration: 3,
    fadeOutDuration: 5,
    musicStopMode: "fade",
    postAzanAction: "resume",
    postAzanDelay: 30,
    minutesBefore: 2,
    announcePrayerName: true,
    useArabicAnnouncement: true,
    prayerAnnouncements: {},
  };

  const currentSettings = settings || defaultSettings;

  const updateSettings = (updates: Partial<AzanPlayerSettings>) => {
    if (onSettingsChange) {
      onSettingsChange(updates);
    }
  };

  const musicStopOptions: { id: MusicStopMode; name: string; description: string }[] = [
    { id: "fade", name: "Fade Out", description: "Gradually lower volume before stopping" },
    { id: "immediate", name: "Immediate Stop", description: "Stop music instantly" },
  ];

  const postAzanOptions: { id: PostAzanAction; name: string; description: string }[] = [
    { id: "resume", name: "Resume Music", description: "Continue playing what was playing before" },
    { id: "silence", name: "Stay Silent", description: "Keep audio off after Azan completes" },
    { id: "quran", name: "Play Quran", description: "Start playing a Quran recitation" },
  ];

  const handleTest = (prayerName?: string) => {
    if (onTestAzan) {
      onTestAzan(prayerName);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onCustomAzanFile) {
      onCustomAzanFile(file);
    }
  };

  const handleAnnouncementUpload = (prayer: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSetPrayerAnnouncement) {
      onSetPrayerAnnouncement(prayer, file);
    }
  };

  const isDefaultAzan = currentSettings.azanFile === "/audio/azan-default.mp3";

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-accent" />
            Azan Player
          </CardTitle>
          <div className="flex items-center gap-3">
            {isAzanPlaying && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/30">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-medium text-accent">
                  {currentPrayer ? `Playing ${currentPrayer}` : "Playing"}
                </span>
              </div>
            )}
            {!isAzanPlaying && nextScheduledPrayer && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                <Clock className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-primary">
                  Next: {nextScheduledPrayer}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Label htmlFor="azan-enabled" className="text-sm text-muted-foreground">Auto</Label>
              <Switch
                id="azan-enabled"
                checked={currentSettings.enabled}
                onCheckedChange={(enabled) => updateSettings({ enabled })}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Custom Azan File */}
        <div className="space-y-3">
          <Label className="text-sm text-muted-foreground flex items-center gap-2">
            <Music className="h-4 w-4" />
            Azan Audio File
          </Label>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isDefaultAzan ? "Upload Custom Azan" : "Change Azan"}
            </Button>
            {!isDefaultAzan && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetToDefault}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Default
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isDefaultAzan ? "Using default azan" : "Using custom azan file"}
          </p>
        </div>

        {/* Prayer Announcements */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto bg-secondary/30 hover:bg-secondary/50">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-accent" />
                <div className="text-left">
                  <p className="font-medium text-sm">Prayer Name Announcements</p>
                  <p className="text-xs text-muted-foreground">Upload Arabic audio for each prayer</p>
                </div>
              </div>
              <Settings2 className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20">
              <div>
                <Label className="text-sm font-medium">Enable Announcements</Label>
                <p className="text-xs text-muted-foreground">Say prayer name before azan</p>
              </div>
              <Switch
                checked={currentSettings.announcePrayerName}
                onCheckedChange={(announcePrayerName) => updateSettings({ announcePrayerName })}
              />
            </div>

            {currentSettings.announcePrayerName && (
              <>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20">
                  <div>
                    <Label className="text-sm font-medium">Use Arabic</Label>
                    <p className="text-xs text-muted-foreground">Arabic names (fallback if no audio)</p>
                  </div>
                  <Switch
                    checked={currentSettings.useArabicAnnouncement}
                    onCheckedChange={(useArabicAnnouncement) => updateSettings({ useArabicAnnouncement })}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Custom Audio per Prayer</Label>
                  {prayerList.map((prayer) => {
                    const hasCustom = !!currentSettings.prayerAnnouncements?.[prayer];
                    return (
                      <div key={prayer} className="flex items-center justify-between p-2 rounded-lg bg-secondary/10">
                        <div className="flex items-center gap-2">
                          {hasCustom ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Mic className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium">{prayer}</span>
                          {hasCustom && (
                            <span className="text-xs text-green-500">Custom audio</span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <input
                            ref={(el) => { announcementInputRefs.current[prayer] = el; }}
                            type="file"
                            accept="audio/*"
                            onChange={(e) => handleAnnouncementUpload(prayer, e)}
                            className="hidden"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => announcementInputRefs.current[prayer]?.click()}
                          >
                            <Upload className="h-3 w-3" />
                          </Button>
                          {hasCustom && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-destructive hover:text-destructive"
                              onClick={() => onClearPrayerAnnouncement?.(prayer)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleTest(prayer)}
                            disabled={isAzanPlaying}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Volume Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Azan Volume
            </Label>
            <span className="text-sm font-medium text-foreground">{currentSettings.volume}%</span>
          </div>
          <Slider
            value={[currentSettings.volume]}
            max={100}
            step={1}
            onValueChange={([v]) => updateSettings({ volume: v })}
          />
        </div>

        {/* Minutes Before Prayer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Start before prayer
            </Label>
            <span className="text-sm font-medium">{currentSettings.minutesBefore} min</span>
          </div>
          <Slider
            value={[currentSettings.minutesBefore]}
            min={0}
            max={10}
            step={1}
            onValueChange={([v]) => updateSettings({ minutesBefore: v })}
          />
        </div>

        {/* Music Stop Mode */}
        <div className="p-4 rounded-lg bg-secondary/30 space-y-4">
          <div className="flex items-center gap-2">
            <VolumeX className="h-4 w-4 text-accent" />
            <Label className="text-sm font-medium">Music Stop Mode</Label>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {musicStopOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => updateSettings({ musicStopMode: option.id })}
                className={`p-3 rounded-lg text-left transition-all ${
                  currentSettings.musicStopMode === option.id
                    ? "bg-primary/20 border border-primary/30"
                    : "bg-secondary/30 hover:bg-secondary/50 border border-transparent"
                }`}
              >
                <p className={`font-medium text-sm ${currentSettings.musicStopMode === option.id ? "text-primary" : "text-foreground"}`}>
                  {option.name}
                </p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>

          {currentSettings.musicStopMode === "fade" && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Fade Out</Label>
                <Slider
                  value={[currentSettings.fadeOutDuration]}
                  max={15}
                  step={1}
                  onValueChange={([v]) => updateSettings({ fadeOutDuration: v })}
                />
                <span className="text-xs text-muted-foreground">{currentSettings.fadeOutDuration}s</span>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Fade In</Label>
                <Slider
                  value={[currentSettings.fadeInDuration]}
                  max={15}
                  step={1}
                  onValueChange={([v]) => updateSettings({ fadeInDuration: v })}
                />
                <span className="text-xs text-muted-foreground">{currentSettings.fadeInDuration}s</span>
              </div>
            </div>
          )}
        </div>

        {/* Post-Azan Settings */}
        <div className="p-4 rounded-lg bg-secondary/30 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-accent" />
            <Label className="text-sm font-medium">After Azan</Label>
          </div>
          
          <div className="space-y-2">
            {postAzanOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => updateSettings({ postAzanAction: option.id })}
                className={`w-full p-3 rounded-lg text-left transition-all ${
                  currentSettings.postAzanAction === option.id
                    ? "bg-primary/20 border border-primary/30"
                    : "bg-secondary/30 hover:bg-secondary/50 border border-transparent"
                }`}
              >
                <p className={`font-medium ${currentSettings.postAzanAction === option.id ? "text-primary" : "text-foreground"}`}>
                  {option.name}
                </p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>

          {currentSettings.postAzanAction !== "silence" && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Delay before action
                </Label>
                <span className="text-sm font-medium">{currentSettings.postAzanDelay}s</span>
              </div>
              <Slider
                value={[currentSettings.postAzanDelay]}
                max={120}
                step={5}
                onValueChange={([v]) => updateSettings({ postAzanDelay: v })}
              />
            </div>
          )}
        </div>

        {/* Test Button */}
        <Button
          variant={isAzanPlaying ? "destructive" : "glow"}
          className="w-full"
          onClick={() => handleTest("Dhuhr")}
        >
          {isAzanPlaying ? (
            <>
              <Pause className="h-4 w-4 mr-2" />
              Stop Azan
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Test Azan Sequence
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
