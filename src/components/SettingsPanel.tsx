import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Volume2, Clock, MapPin, Wifi, Database, RefreshCw } from "lucide-react";

export const SettingsPanel = () => {
  return (
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
              <Wifi className="h-4 w-4 text-primary" />
              <span className="text-sm">Network: Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-sm">Storage: 45.2 GB free</span>
            </div>
          </div>
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
  );
};
