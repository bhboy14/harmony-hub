import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Volume2, Settings2, Clock } from "lucide-react";

interface AzanSettings {
  reciter: string;
  fadeInDuration: number;
  fadeOutDuration: number;
  postAzanAction: string;
  postAzanDelay: number;
  enabled: boolean;
}

export const AzanPlayer = () => {
  const [settings, setSettings] = useState<AzanSettings>({
    reciter: "mishary",
    fadeInDuration: 3,
    fadeOutDuration: 5,
    postAzanAction: "dua",
    postAzanDelay: 30,
    enabled: true,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);

  const reciters = [
    { id: "mishary", name: "Mishary Rashid Alafasy" },
    { id: "sudais", name: "Abdul Rahman Al-Sudais" },
    { id: "makkah", name: "Makkah Muazzin" },
    { id: "madinah", name: "Madinah Muazzin" },
  ];

  const postAzanOptions = [
    { id: "none", name: "Do Nothing" },
    { id: "dua", name: "Play Dua After Azan" },
    { id: "quran", name: "Play Quran Recitation" },
    { id: "silence", name: "Fade to Silence" },
  ];

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-accent" />
            Azan Player
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="azan-enabled" className="text-sm text-muted-foreground">Enabled</Label>
            <Switch
              id="azan-enabled"
              checked={settings.enabled}
              onCheckedChange={(enabled) => setSettings({ ...settings, enabled })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reciter Selection */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Muazzin / Reciter</Label>
          <Select
            value={settings.reciter}
            onValueChange={(reciter) => setSettings({ ...settings, reciter })}
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
              Volume
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

        {/* Fade Controls */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Fade In (seconds)</Label>
            <Slider
              value={[settings.fadeInDuration]}
              max={10}
              step={1}
              onValueChange={([v]) => setSettings({ ...settings, fadeInDuration: v })}
            />
            <span className="text-xs text-muted-foreground">{settings.fadeInDuration}s</span>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Fade Out (seconds)</Label>
            <Slider
              value={[settings.fadeOutDuration]}
              max={10}
              step={1}
              onValueChange={([v]) => setSettings({ ...settings, fadeOutDuration: v })}
            />
            <span className="text-xs text-muted-foreground">{settings.fadeOutDuration}s</span>
          </div>
        </div>

        {/* Post-Azan Settings */}
        <div className="p-4 rounded-lg bg-secondary/30 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-accent" />
            <Label className="text-sm font-medium">After Azan</Label>
          </div>
          
          <Select
            value={settings.postAzanAction}
            onValueChange={(postAzanAction) => setSettings({ ...settings, postAzanAction })}
          >
            <SelectTrigger className="bg-secondary/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {postAzanOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {settings.postAzanAction !== "none" && (
            <div className="space-y-2">
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
                onValueChange={([v]) => setSettings({ ...settings, postAzanDelay: v })}
              />
            </div>
          )}
        </div>

        {/* Test Button */}
        <Button
          variant={isPlaying ? "destructive" : "glow"}
          className="w-full"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? "Stop Test" : "Test Azan"}
        </Button>
      </CardContent>
    </Card>
  );
};
