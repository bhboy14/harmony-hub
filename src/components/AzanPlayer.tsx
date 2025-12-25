import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Volume2, Settings2, Clock, Play, Pause } from "lucide-react";
import { PostAzanAction } from "@/hooks/useAzanScheduler";

interface AzanSettings {
  reciter: string;
  fadeInDuration: number;
  fadeOutDuration: number;
  postAzanAction: PostAzanAction;
  postAzanDelay: number;
  enabled: boolean;
  minutesBefore: number;
}

interface AzanPlayerProps {
  isAzanPlaying?: boolean;
  onTestAzan?: () => void;
  settings?: AzanSettings;
  onSettingsChange?: (settings: AzanSettings) => void;
}

export const AzanPlayer = ({ 
  isAzanPlaying = false, 
  onTestAzan,
  settings: externalSettings,
  onSettingsChange 
}: AzanPlayerProps) => {
  const [internalSettings, setInternalSettings] = useState<AzanSettings>({
    reciter: "mishary",
    fadeInDuration: 3,
    fadeOutDuration: 5,
    postAzanAction: "resume",
    postAzanDelay: 30,
    enabled: true,
    minutesBefore: 2,
  });

  const settings = externalSettings || internalSettings;
  const updateSettings = (updates: Partial<AzanSettings>) => {
    const newSettings = { ...settings, ...updates };
    if (onSettingsChange) {
      onSettingsChange(newSettings);
    } else {
      setInternalSettings(newSettings);
    }
  };

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);

  const reciters = [
    { id: "mishary", name: "Mishary Rashid Alafasy" },
    { id: "sudais", name: "Abdul Rahman Al-Sudais" },
    { id: "makkah", name: "Makkah Muazzin" },
    { id: "madinah", name: "Madinah Muazzin" },
  ];

  const postAzanOptions: { id: PostAzanAction; name: string; description: string }[] = [
    { id: "resume", name: "Resume Music", description: "Continue playing what was playing before" },
    { id: "silence", name: "Stay Silent", description: "Keep audio off after Azan completes" },
    { id: "quran", name: "Play Quran", description: "Start playing a Quran recitation" },
  ];

  const handleTest = () => {
    if (onTestAzan) {
      onTestAzan();
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-accent" />
            Azan Player
          </CardTitle>
          <div className="flex items-center gap-3">
            {(isAzanPlaying || isPlaying) && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/30">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-medium text-accent">Playing</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Label htmlFor="azan-enabled" className="text-sm text-muted-foreground">Auto</Label>
              <Switch
                id="azan-enabled"
                checked={settings.enabled}
                onCheckedChange={(enabled) => updateSettings({ enabled })}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reciter Selection */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Muazzin / Reciter</Label>
          <Select
            value={settings.reciter}
            onValueChange={(reciter) => updateSettings({ reciter })}
          >
            <SelectTrigger className="bg-secondary/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {reciters.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Volume Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Azan Volume
            </Label>
            <span className="text-sm font-medium text-foreground">{volume}%</span>
          </div>
          <Slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={([v]) => setVolume(v)}
          />
        </div>

        {/* Minutes Before Prayer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Start fade before prayer
            </Label>
            <span className="text-sm font-medium">{settings.minutesBefore} min</span>
          </div>
          <Slider
            value={[settings.minutesBefore]}
            min={0}
            max={10}
            step={1}
            onValueChange={([v]) => updateSettings({ minutesBefore: v })}
          />
        </div>

        {/* Fade Controls */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Fade Out (seconds)</Label>
            <Slider
              value={[settings.fadeOutDuration]}
              max={15}
              step={1}
              onValueChange={([v]) => updateSettings({ fadeOutDuration: v })}
            />
            <span className="text-xs text-muted-foreground">{settings.fadeOutDuration}s</span>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Fade In (seconds)</Label>
            <Slider
              value={[settings.fadeInDuration]}
              max={15}
              step={1}
              onValueChange={([v]) => updateSettings({ fadeInDuration: v })}
            />
            <span className="text-xs text-muted-foreground">{settings.fadeInDuration}s</span>
          </div>
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
                  settings.postAzanAction === option.id
                    ? "bg-primary/20 border border-primary/30"
                    : "bg-secondary/30 hover:bg-secondary/50 border border-transparent"
                }`}
              >
                <p className={`font-medium ${settings.postAzanAction === option.id ? "text-primary" : "text-foreground"}`}>
                  {option.name}
                </p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>

          {settings.postAzanAction !== "silence" && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Delay before action
                </Label>
                <span className="text-sm font-medium">{settings.postAzanDelay}s</span>
              </div>
              <Slider
                value={[settings.postAzanDelay]}
                max={120}
                step={5}
                onValueChange={([v]) => updateSettings({ postAzanDelay: v })}
              />
            </div>
          )}
        </div>

        {/* Test Button */}
        <Button
          variant={(isAzanPlaying || isPlaying) ? "destructive" : "glow"}
          className="w-full"
          onClick={handleTest}
        >
          {(isAzanPlaying || isPlaying) ? (
            <>
              <Pause className="h-4 w-4 mr-2" />
              Stop Test
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
