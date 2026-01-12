import { useState } from "react";
import { 
  Cast, 
  Airplay, 
  Monitor, 
  Speaker, 
  Smartphone, 
  Check, 
  WifiOff,
  Wifi,
  Volume2,
  Plus,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCasting, CastDevice } from "@/contexts/CastingContext";
import { useSpotify } from "@/contexts/SpotifyContext";

interface DevicePanelProps {
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  className?: string;
}

type DeviceType = 'spotify' | 'chromecast' | 'airplay' | 'multiroom';

interface UnifiedDevice {
  id: string;
  name: string;
  type: DeviceType;
  deviceType?: string; // Computer, Smartphone, Speaker, etc.
  isActive: boolean;
  volume?: number;
  spotifyId?: string;
  castDevice?: CastDevice;
}

export const DevicePanel = ({ variant = "ghost", size = "icon", className }: DevicePanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [multiroomEnabled, setMultiroomEnabled] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());

  const casting = useCasting();
  const spotify = useSpotify();

  // Check browser capabilities
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isChrome = /chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent);

  // Build unified device list
  const devices: UnifiedDevice[] = [];

  // Add Spotify devices
  if (spotify.devices && spotify.devices.length > 0) {
    spotify.devices.forEach((device: any) => {
      devices.push({
        id: `spotify-${device.id}`,
        name: device.name,
        type: 'spotify',
        deviceType: device.type,
        isActive: device.is_active,
        volume: device.volume_percent,
        spotifyId: device.id,
      });
    });
  }

  // Add multiroom devices from casting context
  if (casting.multiRoom?.devices?.length > 0) {
    casting.multiRoom.devices.forEach((device) => {
      devices.push({
        id: `multiroom-${device.id}`,
        name: device.name,
        type: 'multiroom',
        deviceType: 'Speaker',
        isActive: false,
        volume: device.volume,
        castDevice: device,
      });
    });
  }

  // Check if any device is active
  const hasActiveDevice = devices.some(d => d.isActive) || casting.isCasting;
  const activeSpotifyDevice = devices.find(d => d.type === 'spotify' && d.isActive);

  const getDeviceIcon = (device: UnifiedDevice) => {
    if (device.type === 'airplay') return <Airplay className="h-4 w-4" />;
    if (device.type === 'chromecast') return <Cast className="h-4 w-4" />;
    if (device.type === 'multiroom') return <Speaker className="h-4 w-4" />;
    
    // Spotify device types
    switch (device.deviceType?.toLowerCase()) {
      case 'computer': return <Monitor className="h-4 w-4" />;
      case 'smartphone': return <Smartphone className="h-4 w-4" />;
      case 'speaker': return <Speaker className="h-4 w-4" />;
      default: return <Speaker className="h-4 w-4" />;
    }
  };

  const handleDeviceSelect = async (device: UnifiedDevice) => {
    if (multiroomEnabled) {
      // Toggle selection for multiroom
      setSelectedDevices(prev => {
        const next = new Set(prev);
        if (next.has(device.id)) {
          next.delete(device.id);
        } else {
          next.add(device.id);
        }
        return next;
      });
    } else {
      // Single device selection
      if (device.type === 'spotify' && device.spotifyId) {
        try {
          await spotify.transferPlayback(device.spotifyId);
        } catch (err) {
          console.error('Failed to transfer playback:', err);
        }
      }
    }
  };

  const handleChromecast = async () => {
    await casting.startChromecast();
  };

  const handleAirPlay = () => {
    casting.startAirPlay();
  };

  const handleDisconnect = () => {
    casting.stopCasting();
  };

  const handleDeviceVolumeChange = (deviceId: string, volume: number) => {
    const device = devices.find(d => d.id === deviceId);
    if (device?.type === 'multiroom' && device.castDevice) {
      casting.setDeviceVolume(device.castDevice.id, volume);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={variant}
                size={size}
                className={`${className} ${hasActiveDevice ? 'text-green-500' : ''}`}
              >
                {casting.isCasting ? (
                  <Wifi className="h-4 w-4" />
                ) : (
                  <Monitor className="h-4 w-4" />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {hasActiveDevice 
              ? `Playing on ${activeSpotifyDevice?.name || casting.currentDevice?.name || 'device'}` 
              : 'Select output device'
            }
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent 
        align="end" 
        className="w-80 p-0"
        onInteractOutside={(e) => {
          // Prevent closing when interacting with sliders
          if ((e.target as HTMLElement)?.closest('[role="slider"]')) {
            e.preventDefault();
          }
        }}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Speaker className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Output Devices</span>
            </div>
            {devices.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Multi-room</span>
                <Switch
                  checked={multiroomEnabled}
                  onCheckedChange={setMultiroomEnabled}
                  className="scale-75"
                />
              </div>
            )}
          </div>
          {multiroomEnabled && (
            <p className="text-xs text-muted-foreground mt-2">
              Select multiple devices for synchronized playback
            </p>
          )}
        </div>

        <ScrollArea className="max-h-[300px]">
          <div className="p-2 space-y-1">
            {/* Currently Casting */}
            {casting.isCasting && casting.currentDevice && (
              <>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        {casting.currentDevice.protocol === 'airplay' ? (
                          <Airplay className="h-4 w-4 text-primary" />
                        ) : (
                          <Cast className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{casting.currentDevice.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {casting.currentDevice.protocol} • Connected
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDisconnect}
                      className="text-destructive hover:text-destructive h-8"
                    >
                      <WifiOff className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Separator className="my-2" />
              </>
            )}

            {/* Spotify / Hardware Devices */}
            {devices.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                  Available Devices
                </p>
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className={`group rounded-lg transition-all ${
                      device.isActive 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'hover:bg-secondary/50'
                    } ${
                      multiroomEnabled && selectedDevices.has(device.id)
                        ? 'ring-2 ring-primary/50'
                        : ''
                    }`}
                  >
                    <button
                      onClick={() => handleDeviceSelect(device)}
                      className="w-full p-3 flex items-center gap-3 text-left"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        device.isActive ? 'bg-green-500/20' : 'bg-secondary'
                      }`}>
                        {getDeviceIcon(device)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{device.name}</p>
                          {device.type === 'spotify' && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Spotify
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">
                          {device.deviceType || device.type}
                        </p>
                      </div>
                      {device.isActive && !multiroomEnabled && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                      {multiroomEnabled && (
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          selectedDevices.has(device.id) 
                            ? 'bg-primary border-primary' 
                            : 'border-muted-foreground'
                        }`}>
                          {selectedDevices.has(device.id) && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                      )}
                    </button>

                    {/* Volume control for multiroom devices */}
                    {device.type === 'multiroom' && (
                      <div className="px-3 pb-3 flex items-center gap-3">
                        <Volume2 className="h-3 w-3 text-muted-foreground" />
                        <Slider
                          value={[device.volume || 100]}
                          max={100}
                          step={1}
                          onValueChange={([v]) => handleDeviceVolumeChange(device.id, v)}
                          className="flex-1"
                        />
                        <span className="text-xs w-8 text-right text-muted-foreground">
                          {device.volume || 100}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* No devices message */}
            {devices.length === 0 && !casting.isCasting && (
              <div className="py-6 text-center text-muted-foreground">
                <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No devices available</p>
                <p className="text-xs">Connect Spotify or add speakers</p>
              </div>
            )}

            {/* Cast Options */}
            {(isChrome || isSafari) && (
              <>
                <Separator className="my-2" />
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                  Cast To
                </p>
                
                {isChrome && (
                  <button
                    onClick={handleChromecast}
                    className="w-full p-3 rounded-lg hover:bg-secondary/50 flex items-center gap-3 text-left transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <Cast className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Chromecast</p>
                      <p className="text-xs text-muted-foreground">Cast to nearby devices</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}

                {isSafari && (
                  <button
                    onClick={handleAirPlay}
                    className="w-full p-3 rounded-lg hover:bg-secondary/50 flex items-center gap-3 text-left transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <Airplay className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">AirPlay</p>
                      <p className="text-xs text-muted-foreground">Stream to Apple devices</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </>
            )}

            {/* Add Speaker for Multi-room */}
            <Separator className="my-2" />
            <button
              onClick={() => {
                // Open settings or add device dialog
                setIsOpen(false);
              }}
              className="w-full p-3 rounded-lg hover:bg-secondary/50 flex items-center gap-3 text-left transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <Plus className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Add Speaker</p>
                <p className="text-xs text-muted-foreground">Setup multi-room audio</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </ScrollArea>

        {/* Multi-room action bar */}
        {multiroomEnabled && selectedDevices.size > 0 && (
          <div className="p-3 border-t border-border bg-secondary/30">
            <Button className="w-full gap-2" size="sm">
              <Wifi className="h-4 w-4" />
              Play on {selectedDevices.size} device{selectedDevices.size > 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
