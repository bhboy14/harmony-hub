import { useSpotify } from "@/contexts/SpotifyContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Repeat,
  Shuffle,
  MonitorSpeaker,
  Laptop,
  Smartphone,
  Speaker,
  Tv,
  Check,
  Globe,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const getDeviceIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'computer':
      return Laptop;
    case 'smartphone':
      return Smartphone;
    case 'speaker':
      return Speaker;
    case 'tv':
      return Tv;
    default:
      return MonitorSpeaker;
  }
};

export const PlaybackBar = () => {
  const { hasPermission } = useAuth();
  const { 
    isConnected, 
    playbackState, 
    devices,
    webPlayerReady,
    webPlayerDeviceId,
    play, 
    pause, 
    next, 
    previous, 
    setVolume,
    transferPlayback,
    refreshPlaybackState,
    activateWebPlayer,
    connect
  } = useSpotify();
  
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(100);
  
  const canControl = hasPermission('dj');
  const track = playbackState?.track;
  const isPlaying = playbackState?.isPlaying ?? false;
  const progress = playbackState?.progress ?? 0;
  const duration = track?.duration_ms ?? 0;
  const volume = playbackState?.volume ?? 100;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    if (!canControl) return;
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  };

  const handleVolumeChange = async (value: number[]) => {
    if (!canControl) return;
    const newVolume = value[0];
    setIsMuted(newVolume === 0);
    await setVolume(newVolume);
  };

  const toggleMute = async () => {
    if (!canControl) return;
    if (isMuted) {
      await setVolume(previousVolume);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      await setVolume(0);
      setIsMuted(true);
    }
  };

  // Don't show if not connected
  if (!isConnected) {
    return (
      <div className="fixed bottom-0 left-64 right-0 h-20 bg-card/95 backdrop-blur-xl border-t border-border z-50">
        <div className="h-full flex items-center justify-center gap-4 px-6">
          <div className="text-[#1DB954]"><SpotifyIcon /></div>
          <p className="text-muted-foreground text-sm">Connect to Spotify to control playback</p>
          <Button 
            onClick={connect}
            size="sm" 
            className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold"
          >
            Connect Spotify
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-64 right-0 h-20 bg-card/95 backdrop-blur-xl border-t border-border z-50">
      <div className="h-full grid grid-cols-3 items-center px-4 gap-4">
        {/* Left: Track Info */}
        <div className="flex items-center gap-3 min-w-0">
          {track ? (
            <>
              {track.album.images[0] && (
                <img 
                  src={track.album.images[0].url}
                  alt={track.album.name}
                  className="w-14 h-14 rounded shadow-lg"
                />
              )}
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate text-sm">
                  {track.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {track.artists.map(a => a.name).join(", ")}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded bg-secondary flex items-center justify-center">
                <div className="text-[#1DB954]"><SpotifyIcon /></div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">No track playing</p>
                <p className="text-xs text-muted-foreground">Select a song to play</p>
              </div>
            </div>
          )}
        </div>

        {/* Center: Playback Controls */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              disabled={!canControl}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => canControl && previous()}
              disabled={!canControl}
            >
              <SkipBack className="h-4 w-4 fill-current" />
            </Button>
            <Button 
              size="icon" 
              className="h-9 w-9 rounded-full bg-foreground text-background hover:scale-105 transition-transform"
              onClick={handlePlayPause}
              disabled={!canControl}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current ml-0.5" />
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => canControl && next()}
              disabled={!canControl}
            >
              <SkipForward className="h-4 w-4 fill-current" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              disabled={!canControl}
            >
              <Repeat className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center gap-2 w-full max-w-md">
            <span className="text-xs text-muted-foreground w-10 text-right">
              {formatTime(progress)}
            </span>
            <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-foreground rounded-full transition-all duration-1000"
                style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Volume & Device */}
        <div className="flex items-center justify-end gap-3">
          {/* Device Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={`h-8 w-8 ${playbackState?.device ? 'text-[#1DB954]' : 'text-muted-foreground'} hover:text-foreground`}
                disabled={!canControl}
              >
                {playbackState?.device ? (
                  (() => {
                    const DeviceIcon = getDeviceIcon(playbackState.device.type);
                    return <DeviceIcon className="h-4 w-4" />;
                  })()
                ) : (
                  <MonitorSpeaker className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-72 bg-popover border border-border shadow-lg z-[60]"
              sideOffset={8}
            >
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Connect to a device</p>
                  <p className="text-xs text-muted-foreground">Select a device to play on</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    refreshPlaybackState();
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
              
              {/* Web Player Option */}
              {webPlayerReady && webPlayerDeviceId && (
                <div className="border-b border-border">
                  <DropdownMenuItem 
                    onClick={() => activateWebPlayer()}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${
                      playbackState?.device?.name === 'Lovable Web Player' ? 'bg-[#1DB954]/10' : ''
                    }`}
                  >
                    <Globe className={`h-5 w-5 ${
                      playbackState?.device?.name === 'Lovable Web Player' ? 'text-[#1DB954]' : 'text-muted-foreground'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${
                        playbackState?.device?.name === 'Lovable Web Player' ? 'text-[#1DB954] font-medium' : 'text-foreground'
                      }`}>
                        This Browser
                      </p>
                      <p className="text-xs text-muted-foreground">Cast via AirPlay / Chromecast</p>
                    </div>
                    {playbackState?.device?.name === 'Lovable Web Player' && (
                      <Check className="h-4 w-4 text-[#1DB954]" />
                    )}
                  </DropdownMenuItem>
                </div>
              )}
              
              {!webPlayerReady && (
                <div className="px-3 py-2 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>Web player initializing...</span>
                  </div>
                </div>
              )}
              
              {devices.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-sm text-muted-foreground">No other devices found</p>
                  <p className="text-xs text-muted-foreground mt-1">Open Spotify on a device</p>
                </div>
              ) : (
                devices.filter(d => d.name !== 'Lovable Web Player').map((device) => {
                  const DeviceIcon = getDeviceIcon(device.type);
                  const isActive = device.is_active;
                  return (
                    <DropdownMenuItem 
                      key={device.id}
                      onClick={() => !isActive && transferPlayback(device.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${isActive ? 'bg-[#1DB954]/10' : ''}`}
                    >
                      <DeviceIcon className={`h-5 w-5 ${isActive ? 'text-[#1DB954]' : 'text-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${isActive ? 'text-[#1DB954] font-medium' : 'text-foreground'}`}>
                          {device.name}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">{device.type}</p>
                      </div>
                      {isActive && <Check className="h-4 w-4 text-[#1DB954]" />}
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="flex items-center gap-2 w-32">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={toggleMute}
              disabled={!canControl}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={100}
              step={1}
              onValueChange={handleVolumeChange}
              disabled={!canControl}
              className="flex-1"
            />
          </div>
          {playbackState?.device && (
            <span className="text-xs text-muted-foreground hidden lg:block max-w-24 truncate">
              {playbackState.device.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
