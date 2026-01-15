import { useIoTLighting } from "@/hooks/useIoTLighting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bluetooth,
  Lightbulb,
  Music2,
  Palette,
  Power,
  RefreshCw,
  Wifi,
  WifiOff,
  Zap,
  Search,
} from "lucide-react";

interface IoTLightingPanelProps {
  className?: string;
}

export const IoTLightingPanel = ({ className }: IoTLightingPanelProps) => {
  const {
    devices,
    isScanning,
    currentPreset,
    settings,
    presets,
    isBluetoothSupported,
    isMidiSupported,
    scanBluetoothDevices,
    initializeMidi,
    connectDevice,
    disconnectDevice,
    applyPreset,
    stopEffect,
    resetLighting,
    updateSettings,
  } = useIoTLighting();

  const connectedCount = devices.filter((d) => d.connected).length;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5" />
            Smart Lighting
          </CardTitle>
          <Badge variant={settings.enabled ? "default" : "secondary"}>
            {connectedCount} Connected
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Power className="h-4 w-4 text-muted-foreground" />
            <Label>Enable IoT Lighting</Label>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) => updateSettings({ enabled })}
          />
        </div>

        {!settings.enabled ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Enable to control smart lights
          </p>
        ) : (
          <>
            <Separator />

            {/* Device Discovery */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Device Discovery
              </h4>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scanBluetoothDevices}
                  disabled={isScanning || !isBluetoothSupported()}
                  className="flex-1"
                >
                  {isScanning ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Bluetooth className="h-4 w-4 mr-2" />
                  )}
                  {isBluetoothSupported() ? "Scan Bluetooth" : "Not Supported"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={initializeMidi}
                  disabled={!isMidiSupported()}
                  className="flex-1"
                >
                  <Music2 className="h-4 w-4 mr-2" />
                  {isMidiSupported() ? "Init MIDI" : "Not Supported"}
                </Button>
              </div>
            </div>

            {/* Connected Devices */}
            {devices.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Devices</h4>
                  <ScrollArea className="h-24">
                    <div className="space-y-2">
                      {devices.map((device) => (
                        <div
                          key={device.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            {device.connected ? (
                              <Wifi className="h-4 w-4 text-green-500" />
                            ) : (
                              <WifiOff className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{device.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {device.type === "bluetooth" ? "Bluetooth" : "MIDI"}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant={device.connected ? "destructive" : "secondary"}
                            size="sm"
                            onClick={() =>
                              device.connected
                                ? disconnectDevice(device.id)
                                : connectDevice(device.id)
                            }
                          >
                            {device.connected ? "Disconnect" : "Connect"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}

            <Separator />

            {/* Lighting Presets */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Lighting Presets
              </h4>

              <div className="grid grid-cols-2 gap-2">
                {Object.entries(presets).map(([key, preset]) => (
                  <Button
                    key={key}
                    variant={currentPreset === key ? "default" : "outline"}
                    size="sm"
                    className="justify-start"
                    onClick={() => applyPreset(key)}
                    style={{
                      borderColor:
                        currentPreset === key
                          ? undefined
                          : `hsl(${preset.color.h}, ${preset.color.s}%, ${preset.color.l}%)`,
                    }}
                  >
                    <div
                      className="h-3 w-3 rounded-full mr-2"
                      style={{
                        backgroundColor: `hsl(${preset.color.h}, ${preset.color.s}%, ${preset.color.l}%)`,
                      }}
                    />
                    {preset.name}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopEffect}
                  className="flex-1"
                >
                  Stop Effect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetLighting}
                  className="flex-1"
                >
                  Reset
                </Button>
              </div>
            </div>

            <Separator />

            {/* Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Automation
              </h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Auto-sync with Music</Label>
                  <Switch
                    checked={settings.autoSync}
                    onCheckedChange={(autoSync) => updateSettings({ autoSync })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm">Audio Visualizer Mode</Label>
                  <Switch
                    checked={settings.visualizerEnabled}
                    onCheckedChange={(visualizerEnabled) =>
                      updateSettings({ visualizerEnabled })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Pre-Azan Fade (minutes)</Label>
                    <span className="text-sm text-muted-foreground">
                      {settings.preAzanFadeMinutes} min
                    </span>
                  </div>
                  <Slider
                    value={[settings.preAzanFadeMinutes]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={([value]) =>
                      updateSettings({ preAzanFadeMinutes: value })
                    }
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default IoTLightingPanel;
