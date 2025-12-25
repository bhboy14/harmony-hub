import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Mic, MicOff, Volume2, Radio } from "lucide-react";

export const PASystem = () => {
  const [isLive, setIsLive] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [volume, setVolume] = useState(85);
  const [zone, setZone] = useState("all");
  const [presets] = useState([
    { id: "1", name: "Prayer Starting Soon", text: "Brothers and sisters, the prayer will begin in 5 minutes. Please make your way to the prayer hall." },
    { id: "2", name: "Car Blocking", text: "Attention please. The owner of vehicle with plate number [PLATE], your car is blocking another vehicle. Please move it immediately." },
    { id: "3", name: "Lost Child", text: "Attention parents. A child has been found at the information desk. Please come to collect your child." },
    { id: "4", name: "Event Reminder", text: "Brothers and sisters, we remind you of today's lecture after Maghrib prayer in the main hall." },
  ]);

  const zones = [
    { id: "all", name: "All Zones" },
    { id: "main-hall", name: "Main Prayer Hall" },
    { id: "women", name: "Women's Section" },
    { id: "courtyard", name: "Courtyard" },
    { id: "parking", name: "Parking Area" },
  ];

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-accent" />
            PA System
          </CardTitle>
          {isLive && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/20 border border-destructive/30">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-xs font-medium text-destructive">LIVE</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Zone Selection */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Broadcast Zone
          </Label>
          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger className="bg-secondary/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.name}
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
              Output Volume
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

        {/* Announcement Text */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Announcement Text</Label>
          <Textarea
            placeholder="Type your announcement here..."
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            className="min-h-[100px] bg-secondary/50 border-border/50 resize-none"
          />
        </div>

        {/* Quick Presets */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Quick Presets</Label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.id}
                variant="outline"
                size="sm"
                className="text-xs h-auto py-2 justify-start"
                onClick={() => setAnnouncement(preset.text)}
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Live Mic Button */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant={isLive ? "destructive" : "glow"}
            className="h-16"
            onClick={() => setIsLive(!isLive)}
          >
            {isLive ? (
              <>
                <MicOff className="h-5 w-5" />
                Stop Live
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" />
                Go Live
              </>
            )}
          </Button>
          <Button
            variant="gold"
            className="h-16"
            disabled={!announcement.trim()}
          >
            <Megaphone className="h-5 w-5" />
            Broadcast
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
