import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Palette, RotateCcw, Music, Youtube, HardDrive, Cloud, Radio, Disc } from "lucide-react";
import { useSeekBarSettings, SeekBarColors } from "@/hooks/useSeekBarSettings";

interface ColorInputProps {
  label: string;
  icon: React.ReactNode;
  color: string;
  onChange: (color: string) => void;
}

const ColorInput = ({ label, icon, color, onChange }: ColorInputProps) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2 min-w-0">
      {icon}
      <Label className="text-sm text-foreground truncate">{label}</Label>
    </div>
    <div className="flex items-center gap-2">
      <div 
        className="w-8 h-8 rounded-md border border-border/50 shrink-0"
        style={{ backgroundColor: color }}
      />
      <Input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-8 p-0 border-0 cursor-pointer bg-transparent"
      />
    </div>
  </div>
);

export const SeekBarColorSettings = () => {
  const { settings, updateColor, updateOpacity, resetToDefaults, defaultSettings } = useSeekBarSettings();

  const colorConfigs: Array<{ key: keyof SeekBarColors; label: string; icon: React.ReactNode }> = [
    { key: "spotify", label: "Spotify", icon: <Music className="h-4 w-4 text-green-500" /> },
    { key: "youtube", label: "YouTube", icon: <Youtube className="h-4 w-4 text-red-500" /> },
    { key: "local", label: "Local Files", icon: <HardDrive className="h-4 w-4 text-amber-500" /> },
    { key: "soundcloud", label: "SoundCloud", icon: <Cloud className="h-4 w-4 text-orange-500" /> },
    { key: "pa", label: "PA System", icon: <Radio className="h-4 w-4 text-red-400" /> },
    { key: "default", label: "Default", icon: <Disc className="h-4 w-4 text-primary" /> },
  ];

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-accent" />
          Seek Bar Colors
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Opacity Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Opacity</Label>
            <span className="text-sm font-medium">{settings.opacity}%</span>
          </div>
          <Slider
            value={[settings.opacity]}
            onValueChange={([v]) => updateOpacity(v)}
            max={100}
            min={20}
            step={5}
          />
        </div>

        {/* Preview Bar */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Preview</Label>
          <div className="h-3 rounded-full bg-secondary overflow-hidden">
            <div 
              className="h-full w-2/3 rounded-full transition-all"
              style={{ 
                backgroundColor: settings.colors.spotify,
                opacity: settings.opacity / 100,
              }}
            />
          </div>
        </div>

        {/* Color Inputs */}
        <div className="space-y-4 pt-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Source Colors</Label>
          {colorConfigs.map(({ key, label, icon }) => (
            <ColorInput
              key={key}
              label={label}
              icon={icon}
              color={settings.colors[key]}
              onChange={(color) => updateColor(key, color)}
            />
          ))}
        </div>

        {/* Reset Button */}
        <Button 
          variant="outline" 
          className="w-full gap-2"
          onClick={resetToDefaults}
        >
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </Button>
      </CardContent>
    </Card>
  );
};
