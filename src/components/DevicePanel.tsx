import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  ChevronDown,
  ChevronRight,
  AudioLines,
  RefreshCw,
  Trash2,
  X,
  Mic,
  Headphones,
  Globe,
  Music2,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCasting, CastDevice } from "@/contexts/CastingContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useAudioOutput } from "@/hooks/useAudioOutput";
import { useNetworkSpeakers } from "@/hooks/useNetworkSpeakers";
import { useRecordingDevices } from "@/hooks/useRecordingDevices";
import { useStationUnlock } from "@/hooks/useStationUnlock";
import { useToast } from "@/hooks/use-toast";

interface DevicePanelProps {
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  className?: string;
}

type DeviceType = "spotify" | "chromecast" | "airplay" | "multiroom" | "local" | "browser" | "cast";

interface UnifiedDevice {
  id: string;
  name: string;
  type: DeviceType;
  deviceType?: string;
  isActive: boolean;
  volume?: number;
  spotifyId?: string;
  castDevice?: CastDevice;
}

export const DevicePanel = ({ variant = "ghost", size = "icon", className }: DevicePanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [multiroomEnabled, setMultiroomEnabled] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [addSpeakerOpen, setAddSpeakerOpen] = useState(false);
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [newSpeakerIp, setNewSpeakerIp] = useState("");
  const [playbackExpanded, setPlaybackExpanded] = useState(true);
  const [recordingExpanded, setRecordingExpanded] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState({ bottom: 100, right: 16 });

  const casting = useCasting();
  const spotify = useSpotify();
  const audioOutput = useAudioOutput();
  const networkSpeakers = useNetworkSpeakers({ enabled: true });
  const recordingDevices = useRecordingDevices();
  const stationUnlock = useStationUnlock();
  const { toast } = useToast();

  // Browser capabilities
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isChrome = /chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent);

  // Calculate position when open
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const panelWidth = Math.min(360, viewportWidth - 32);

      // Position above the playback bar
      let right = viewportWidth - rect.right;
      let bottom = viewportHeight - rect.top + 8;

      // Ensure it doesn't overflow on mobile
      if (right < 16) right = 16;
      if (right + panelWidth > viewportWidth - 16) {
        right = viewportWidth - panelWidth - 16;
      }

      setPanelPosition({ bottom, right: Math.max(16, right) });
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  // Build unified device list for playback
  const playbackDevices: UnifiedDevice[] = [];

  // Check if Spotify has an active device
  const activeSpotifyDevice = spotify.devices?.find((d: any) => d.is_active);
  const isSpotifyActive = !!activeSpotifyDevice;
  const isCastingActive = casting.isCasting && !!casting.currentDevice;

  // Add browser as first option - only active if nothing else is playing
  playbackDevices.push({
    id: "browser-default",
    name: "Lovable Browser",
    type: "browser",
    deviceType: "Browser",
    isActive: !isSpotifyActive && !isCastingActive,
  });

  // Add local audio output devices
  if (audioOutput.devices.length > 0) {
    audioOutput.devices.forEach((device) => {
      playbackDevices.push({
        id: `local-${device.deviceId}`,
        name: device.label || "Speaker",
        type: "local",
        deviceType: "Speaker",
        isActive: device.deviceId === audioOutput.currentDeviceId && !isSpotifyActive && !isCastingActive,
      });
    });
  }

  // Add Spotify devices
  if (spotify.devices && spotify.devices.length > 0) {
    spotify.devices.forEach((device: any) => {
      playbackDevices.push({
        id: `spotify-${device.id}`,
        name: device.name,
        type: "spotify",
        deviceType: device.type,
        isActive: device.is_active,
        volume: device.volume_percent,
        spotifyId: device.id,
      });
    });
  }

  // Add multiroom devices
  if (casting.multiRoom?.devices?.length > 0) {
    casting.multiRoom.devices.forEach((device) => {
      playbackDevices.push({
        id: `multiroom-${device.id}`,
        name: device.name,
        type: "multiroom",
        deviceType: "Speaker",
        isActive: false,
        volume: device.volume,
        castDevice: device,
      });
    });
  }

  // Network speakers
  networkSpeakers.speakers.forEach((speaker) => {
    playbackDevices.push({
      id: `network-${speaker.id}`,
      name: speaker.name,
      type: "multiroom",
      deviceType: "Network Speaker",
      isActive: speaker.isConnected,
    });
  });

  // Add casting device if actively casting
  if (isCastingActive && casting.currentDevice) {
    // Check if not already in the list
    const existing = playbackDevices.find((d) => d.name === casting.currentDevice?.name);
    if (existing) {
      // Mark the existing one as active
      existing.isActive = true;
    } else {
      playbackDevices.push({
        id: `cast-${casting.currentDevice.id}`,
        name: casting.currentDevice.name,
        type: "cast",
        deviceType: casting.currentDevice.protocol === "airplay" ? "AirPlay" : "Chromecast",
        isActive: true,
      });
    }
  }

  // Determine active device name with proper priority
  let activeDeviceName = "Browser";
  if (isCastingActive && casting.currentDevice) {
    activeDeviceName = casting.currentDevice.name;
  } else if (isSpotifyActive && activeSpotifyDevice) {
    activeDeviceName = activeSpotifyDevice.name;
  } else {
    const activeDevice = playbackDevices.find((d) => d.isActive);
    if (activeDevice) {
      activeDeviceName = activeDevice.name;
    }
  }

  const hasActiveDevice = isSpotifyActive || isCastingActive || playbackDevices.some((d) => d.isActive);

  const getDeviceIcon = (device: UnifiedDevice) => {
    if (device.type === "browser") return <Globe className="h-4 w-4" />;
    if (device.type === "airplay") return <Airplay className="h-4 w-4" />;
    if (device.type === "chromecast" || device.type === "cast") return <Cast className="h-4 w-4" />;
    if (device.type === "multiroom") return <Speaker className="h-4 w-4" />;
    if (device.type === "local") return <Headphones className="h-4 w-4" />;
    if (device.type === "spotify") {
      switch (device.deviceType?.toLowerCase()) {
        case "computer":
          return <Monitor className="h-4 w-4" />;
        case "smartphone":
          return <Smartphone className="h-4 w-4" />;
        default:
          return <Music2 className="h-4 w-4" />;
      }
    }
    return <Speaker className="h-4 w-4" />;
  };

  const handleDeviceSelect = async (device: UnifiedDevice) => {
    if (multiroomEnabled) {
      setSelectedDevices((prev) => {
        const next = new Set(prev);
        if (next.has(device.id)) {
          next.delete(device.id);
        } else {
          next.add(device.id);
        }
        return next;
      });
    } else {
      if (device.type === "local") {
        const deviceId = device.id.replace("local-", "");
        await audioOutput.setOutputDevice(deviceId);
      } else if (device.type === "spotify" && device.spotifyId) {
        try {
          await spotify.transferPlayback(device.spotifyId);
        } catch (err) {
          console.error("Failed to transfer playback:", err);
        }
      } else if (device.type === "browser") {
        // Reset to default browser output
        if (audioOutput.devices[0]) {
          await audioOutput.setOutputDevice(audioOutput.devices[0].deviceId);
        }
      }
      setIsOpen(false);
    }
  };

  const handleChromecast = async () => {
    await casting.startChromecast();
    setIsOpen(false);
  };

  const handleAirPlay = () => {
    casting.startAirPlay();
    setIsOpen(false);
  };

  const handleDisconnect = () => {
    casting.stopCasting();
  };

  const handleDeviceVolumeChange = (deviceId: string, volume: number) => {
    const device = playbackDevices.find((d) => d.id === deviceId);
    if (device?.type === "multiroom" && device.castDevice) {
      casting.setDeviceVolume(device.castDevice.id, volume);
    }
  };

  const handleAddSpeaker = () => {
    if (newSpeakerName && newSpeakerIp) {
      networkSpeakers.addSpeakerManually(newSpeakerName, newSpeakerIp);
      setNewSpeakerName("");
      setNewSpeakerIp("");
      setAddSpeakerOpen(false);
    }
  };

  const handleShowOutputPicker = async () => {
    if (audioOutput.isSelectorSupported) {
      await audioOutput.showOutputPicker();
    }
  };

  // Refresh audio output devices when panel opens
  useEffect(() => {
    if (isOpen && audioOutput.isSupported) {
      audioOutput.refreshDevices();
    }
  }, [isOpen, audioOutput.isSupported]);

  // Portal content
  const panelContent =
    isOpen &&
    createPortal(
      <div
        ref={panelRef}
        className="fixed z-[9999] w-[360px] max-w-[calc(100vw-32px)] bg-card border border-border rounded-xl shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        style={{
          bottom: panelPosition.bottom,
          right: panelPosition.right,
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Speaker className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Output Devices</span>
          </div>
          <div className="flex items-center gap-2">
            {playbackDevices.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Multi-room</span>
                <Switch checked={multiroomEnabled} onCheckedChange={setMultiroomEnabled} className="scale-75" />
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-2 space-y-2">
            {/* Unlock Station Banner - only show when needed */}
            {stationUnlock.needsUnlock && (
              <div className="p-3 mx-2 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Volume2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Enable Audio</p>
                    <p className="text-xs text-muted-foreground">Tap to enable audio sync & mic access</p>
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    const success = await stationUnlock.unlockStation();
                    if (success) {
                      toast({
                        title: "Audio Enabled",
                        description: "Your device is now ready for sync",
                      });
                      // Refresh device lists
                      audioOutput.refreshDevices();
                      recordingDevices.refresh();
                    }
                  }}
                  disabled={stationUnlock.isUnlocking}
                  className="w-full gap-2"
                  size="sm"
                >
                  {stationUnlock.isUnlocking ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4" />
                      Unlock Station
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Currently Casting */}
            {casting.isCasting && casting.currentDevice && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 mx-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      {casting.currentDevice.protocol === "airplay" ? (
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
            )}

            {/* Playback Devices Section */}
            <Collapsible open={playbackExpanded} onOpenChange={setPlaybackExpanded}>
              <CollapsibleTrigger className="w-full p-2 flex items-center justify-between hover:bg-secondary/50 rounded-lg transition-colors">
                <div className="flex items-center gap-2">
                  <Headphones className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Playback</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    {playbackDevices.length}
                  </Badge>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${playbackExpanded ? "" : "-rotate-90"}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                {/* Browser picker - only show on supported browsers as an extra option */}
                {audioOutput.isSelectorSupported && (
                  <button
                    onClick={handleShowOutputPicker}
                    className="w-full p-3 rounded-lg hover:bg-secondary/50 flex items-center gap-3 text-left transition-all mx-1"
                  >
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <AudioLines className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">System Picker</p>
                      <p className="text-xs text-muted-foreground">Open browser audio selector</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}

                {/* Device List */}
                {playbackDevices.map((device) => (
                  <div
                    key={device.id}
                    className={`group rounded-lg transition-all mx-1 ${
                      device.isActive ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary/50"
                    } ${multiroomEnabled && selectedDevices.has(device.id) ? "ring-2 ring-primary/50" : ""}`}
                  >
                    <button
                      onClick={() => handleDeviceSelect(device)}
                      className="w-full p-3 flex items-center gap-3 text-left"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          device.isActive ? "bg-green-500/20 text-green-500" : "bg-secondary"
                        }`}
                      >
                        {getDeviceIcon(device)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{device.name}</p>
                          {device.type === "spotify" && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-500 border-green-500/30"
                            >
                              Spotify
                            </Badge>
                          )}
                          {device.type === "browser" && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-500 border-blue-500/30"
                            >
                              Browser
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">{device.deviceType || device.type}</p>
                      </div>
                      {device.isActive && !multiroomEnabled && <Check className="h-4 w-4 text-green-500" />}
                      {multiroomEnabled && (
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            selectedDevices.has(device.id) ? "bg-primary border-primary" : "border-muted-foreground"
                          }`}
                        >
                          {selectedDevices.has(device.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      )}
                    </button>

                    {/* Volume for multiroom */}
                    {device.type === "multiroom" && device.volume !== undefined && (
                      <div className="px-3 pb-3 flex items-center gap-3">
                        <Volume2 className="h-3 w-3 text-muted-foreground" />
                        <Slider
                          value={[device.volume]}
                          max={100}
                          step={1}
                          onValueChange={([v]) => handleDeviceVolumeChange(device.id, v)}
                          className="flex-1"
                        />
                        <span className="text-xs w-8 text-right text-muted-foreground">{device.volume}%</span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Cast Options */}
                {(isChrome || isSafari) && (
                  <>
                    <Separator className="my-2" />
                    <p className="text-xs font-medium text-muted-foreground px-3 py-1">Cast To</p>

                    {isChrome && (
                      <button
                        onClick={handleChromecast}
                        className="w-full p-3 rounded-lg hover:bg-secondary/50 flex items-center gap-3 text-left transition-all mx-1"
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
                        className="w-full p-3 rounded-lg hover:bg-secondary/50 flex items-center gap-3 text-left transition-all mx-1"
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

                {/* Network Speakers */}
                {networkSpeakers.speakers.length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between px-3 py-1">
                      <p className="text-xs font-medium text-muted-foreground">Network Speakers</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => networkSpeakers.scanNetwork()}
                        disabled={networkSpeakers.isScanning}
                      >
                        <RefreshCw className={`h-3 w-3 ${networkSpeakers.isScanning ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                    {networkSpeakers.speakers.map((speaker) => (
                      <div
                        key={speaker.id}
                        className={`p-3 rounded-lg flex items-center gap-3 mx-1 ${
                          speaker.isConnected ? "bg-primary/10" : "hover:bg-secondary/50"
                        } ${!speaker.isAvailable ? "opacity-50" : ""}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            speaker.isConnected ? "bg-green-500/20" : "bg-secondary"
                          }`}
                        >
                          <Wifi className={`h-4 w-4 ${speaker.isAvailable ? "" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{speaker.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {speaker.ipAddress} • {speaker.isAvailable ? "Available" : "Offline"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => networkSpeakers.removeSpeaker(speaker.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </>
                )}

                {/* Add Speaker */}
                <Dialog open={addSpeakerOpen} onOpenChange={setAddSpeakerOpen}>
                  <DialogTrigger asChild>
                    <button className="w-full p-3 rounded-lg hover:bg-secondary/50 flex items-center gap-3 text-left transition-all mx-1">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <Plus className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Add Speaker</p>
                        <p className="text-xs text-muted-foreground">Setup multi-room audio</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Network Speaker</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Speaker Name</label>
                        <Input
                          placeholder="Living Room Speaker"
                          value={newSpeakerName}
                          onChange={(e) => setNewSpeakerName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">IP Address</label>
                        <Input
                          placeholder="192.168.1.100"
                          value={newSpeakerIp}
                          onChange={(e) => setNewSpeakerIp(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleAddSpeaker} className="w-full">
                        Add Speaker
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Recording Devices Section */}
            <Collapsible open={recordingExpanded} onOpenChange={setRecordingExpanded}>
              <CollapsibleTrigger className="w-full p-2 flex items-center justify-between hover:bg-secondary/50 rounded-lg transition-colors">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Recording</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    {recordingDevices.devices.length}
                  </Badge>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${recordingExpanded ? "" : "-rotate-90"}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                {recordingDevices.hasPermission === false && (
                  <div className="p-3 mx-1 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-xs text-destructive">Microphone access denied</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={recordingDevices.requestPermission}
                    >
                      Grant Permission
                    </Button>
                  </div>
                )}

                {recordingDevices.devices.map((device) => (
                  <button
                    key={device.deviceId}
                    onClick={() => recordingDevices.selectDevice(device.deviceId)}
                    className={`w-full p-3 rounded-lg flex items-center gap-3 text-left transition-all mx-1 ${
                      device.deviceId === recordingDevices.currentDeviceId
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-secondary/50"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        device.deviceId === recordingDevices.currentDeviceId
                          ? "bg-green-500/20 text-green-500"
                          : "bg-secondary"
                      }`}
                    >
                      <Mic className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{device.label}</p>
                      <p className="text-xs text-muted-foreground">{device.isDefault ? "Default" : "Microphone"}</p>
                    </div>
                    {device.deviceId === recordingDevices.currentDeviceId && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </button>
                ))}

                {recordingDevices.devices.length === 0 && recordingDevices.hasPermission !== false && (
                  <div className="py-4 text-center text-muted-foreground mx-1">
                    <Mic className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No microphones found</p>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>

        {/* Multi-room action bar */}
        {multiroomEnabled && selectedDevices.size > 0 && (
          <div className="p-3 border-t border-border bg-secondary/30">
            <Button className="w-full gap-2" size="sm">
              <Radio className="h-4 w-4" />
              Play on {selectedDevices.size} device{selectedDevices.size > 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </div>,
      document.body,
    );

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={triggerRef}
              variant={variant}
              size={size}
              className={`${className} ${hasActiveDevice ? "text-green-500" : ""}`}
              onClick={() => setIsOpen(!isOpen)}
            >
              {casting.isCasting ? <Wifi className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{hasActiveDevice ? `Playing on ${activeDeviceName}` : "Select output device"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {panelContent}
    </>
  );
};
