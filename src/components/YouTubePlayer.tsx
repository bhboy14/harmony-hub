import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  Volume2,
  Lock,
  Search,
  Cast,
  Airplay,
  Loader2,
  MonitorSpeaker,
  Smartphone,
  Tv,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

// YouTube icon
const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

interface CastDevice {
  id: string;
  name: string;
  type: "chromecast" | "airplay" | "local";
}

export const YouTubePlayer = () => {
  const { hasPermission } = useAuth();
  const canControl = hasPermission("dj");
  
  const [videoUrl, setVideoUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<CastDevice>({
    id: "local",
    name: "This Device",
    type: "local",
  });
  const [availableDevices, setAvailableDevices] = useState<CastDevice[]>([
    { id: "local", name: "This Device", type: "local" },
  ]);
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isAirPlayAvailable, setIsAirPlayAvailable] = useState(false);

  const playerRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Extract video ID from YouTube URL
  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Check for Cast availability
  useEffect(() => {
    // Check for Chromecast
    const checkCast = () => {
      if ((window as any).chrome?.cast) {
        setIsCastAvailable(true);
        // In a real implementation, you would initialize the Cast SDK here
      }
    };

    // Check for AirPlay (Safari only)
    const checkAirPlay = () => {
      if ((window as any).WebKitPlaybackTargetAvailabilityEvent) {
        setIsAirPlayAvailable(true);
      }
    };

    checkCast();
    checkAirPlay();

    // Listen for Cast SDK
    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) {
        setIsCastAvailable(true);
        // Add Chromecast devices
        setAvailableDevices(prev => [
          ...prev,
          { id: "chromecast-1", name: "Living Room TV", type: "chromecast" as const },
          { id: "chromecast-2", name: "Bedroom Speaker", type: "chromecast" as const },
        ]);
      }
    };
  }, []);

  const onPlayerReady = useCallback((event: any) => {
    setIsLoading(false);
    setDuration(event.target.getDuration());
    event.target.setVolume(volume);
  }, [volume]);

  const onPlayerStateChange = useCallback((event: any) => {
    if (event.data === (window as any).YT?.PlayerState?.PLAYING) {
      setIsPlaying(true);
    } else if (event.data === (window as any).YT?.PlayerState?.PAUSED) {
      setIsPlaying(false);
    }
  }, []);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!videoId) return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      playerRef.current = new (window as any).YT.Player(`youtube-player-${videoId}`, {
        height: "100%",
        width: "100%",
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });
    };

    // If API is already loaded
    if ((window as any).YT && (window as any).YT.Player) {
      playerRef.current = new (window as any).YT.Player(`youtube-player-${videoId}`, {
        height: "100%",
        width: "100%",
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });
    }

    return () => {
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [videoId, onPlayerReady, onPlayerStateChange]);

  // Update current time
  useEffect(() => {
    if (!isPlaying || !playerRef.current?.getCurrentTime) return;
    
    const interval = setInterval(() => {
      setCurrentTime(playerRef.current.getCurrentTime() || 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleLoadVideo = () => {
    const id = extractVideoId(videoUrl);
    if (id) {
      setIsLoading(true);
      setVideoId(id);
    }
  };

  const handlePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolumeState(newVolume);
    if (playerRef.current?.setVolume) {
      playerRef.current.setVolume(newVolume);
    }
  };

  const handleSeek = (value: number[]) => {
    const seekTime = value[0];
    setCurrentTime(seekTime);
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(seekTime, true);
    }
  };

  const handleDeviceSelect = (device: CastDevice) => {
    setSelectedDevice(device);
    // In a real implementation, you would cast to the selected device here
    if (device.type === "chromecast") {
      // Initialize Chromecast session
      console.log("Casting to Chromecast:", device.name);
    } else if (device.type === "airplay") {
      // Trigger AirPlay picker
      if (iframeRef.current) {
        (iframeRef.current as any).webkitShowPlaybackTargetPicker?.();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getDeviceIcon = (type: CastDevice["type"]) => {
    switch (type) {
      case "chromecast":
        return <Cast className="h-4 w-4" />;
      case "airplay":
        return <Airplay className="h-4 w-4" />;
      default:
        return <MonitorSpeaker className="h-4 w-4" />;
    }
  };

  return (
    <Card className="glass-panel h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <div className="text-[#FF0000]">
            <YouTubeIcon />
          </div>
          YouTube Player
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden space-y-4">
        {/* URL Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Paste YouTube URL or Video ID..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoadVideo()}
            className="flex-1"
            disabled={!canControl}
          />
          <Button
            onClick={handleLoadVideo}
            disabled={!videoUrl || !canControl || isLoading}
            className="bg-[#FF0000] hover:bg-[#cc0000] text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Video Player */}
        {videoId ? (
          <div className="space-y-4">
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
              <div id={`youtube-player-${videoId}`} className="absolute inset-0" />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#FF0000]/20 to-primary/10 border border-[#FF0000]/30">
              {/* Progress bar */}
              <div className="space-y-1 mb-4">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={1}
                  onValueChange={handleSeek}
                  disabled={!canControl}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Play/Pause & Device Selection */}
              <div className="flex items-center justify-between">
                <Button
                  variant="glow"
                  size="lg"
                  className="bg-[#FF0000] hover:bg-[#cc0000] text-white disabled:opacity-50"
                  onClick={handlePlayPause}
                  disabled={!canControl}
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6" />
                  )}
                </Button>

                {/* Device Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={!canControl}
                    >
                      {getDeviceIcon(selectedDevice.type)}
                      <span className="hidden sm:inline">{selectedDevice.name}</span>
                      {selectedDevice.type !== "local" && (
                        <span className="text-xs text-muted-foreground">
                          (Casting)
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Cast to Device</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Local Device */}
                    <DropdownMenuItem
                      onClick={() =>
                        handleDeviceSelect({
                          id: "local",
                          name: "This Device",
                          type: "local",
                        })
                      }
                    >
                      <MonitorSpeaker className="h-4 w-4 mr-2" />
                      This Device
                      {selectedDevice.id === "local" && (
                        <span className="ml-auto text-xs text-primary">Active</span>
                      )}
                    </DropdownMenuItem>

                    {/* Chromecast devices */}
                    {isCastAvailable && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1">
                          <Cast className="h-3 w-3" /> Chromecast
                        </DropdownMenuLabel>
                        {availableDevices
                          .filter((d) => d.type === "chromecast")
                          .map((device) => (
                            <DropdownMenuItem
                              key={device.id}
                              onClick={() => handleDeviceSelect(device)}
                            >
                              <Tv className="h-4 w-4 mr-2" />
                              {device.name}
                              {selectedDevice.id === device.id && (
                                <span className="ml-auto text-xs text-primary">
                                  Active
                                </span>
                              )}
                            </DropdownMenuItem>
                          ))}
                      </>
                    )}

                    {/* AirPlay */}
                    {isAirPlayAvailable && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            handleDeviceSelect({
                              id: "airplay",
                              name: "AirPlay",
                              type: "airplay",
                            })
                          }
                        >
                          <Airplay className="h-4 w-4 mr-2" />
                          AirPlay
                          {selectedDevice.type === "airplay" && (
                            <span className="ml-auto text-xs text-primary">
                              Active
                            </span>
                          )}
                        </DropdownMenuItem>
                      </>
                    )}

                    {!isCastAvailable && !isAirPlayAvailable && (
                      <DropdownMenuItem disabled>
                        <span className="text-xs text-muted-foreground">
                          No cast devices available
                        </span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {!canControl && (
                <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
                  <Lock className="h-3 w-3" /> Only DJs and Admins can control playback
                </p>
              )}

              {/* Volume */}
              <div className="flex items-center gap-3 mt-4">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={[volume]}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeChange}
                  className="flex-1"
                  disabled={!canControl}
                />
                <span className="text-xs text-muted-foreground w-8">
                  {volume}%
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8 rounded-xl bg-secondary/30">
              <div className="w-16 h-16 rounded-full bg-[#FF0000]/20 flex items-center justify-center mx-auto mb-4">
                <YouTubeIcon />
              </div>
              <h3 className="text-lg font-semibold mb-2">Play YouTube Videos</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Paste a YouTube URL above to start playing
              </p>
              <div className="flex items-center justify-center gap-4 text-muted-foreground">
                {isCastAvailable && (
                  <div className="flex items-center gap-1 text-xs">
                    <Cast className="h-3 w-3" /> Chromecast
                  </div>
                )}
                {isAirPlayAvailable && (
                  <div className="flex items-center gap-1 text-xs">
                    <Airplay className="h-3 w-3" /> AirPlay
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
