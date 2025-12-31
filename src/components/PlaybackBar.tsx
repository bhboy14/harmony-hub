import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { usePA } from "@/contexts/PAContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  RefreshCw,
  Mic,
  MicOff,
  Music,
  HardDrive,
  Youtube
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

const getSourceIcon = (source: string | null) => {
  switch (source) {
    case 'spotify':
      return <SpotifyIcon />;
    case 'local':
      return <HardDrive className="h-4 w-4" />;
    case 'youtube':
      return <Youtube className="h-4 w-4 text-[#FF0000]" />;
    default:
      return <Music className="h-4 w-4" />;
  }
};

const getSourceColor = (source: string | null) => {
  switch (source) {
    case 'spotify':
      return '#1DB954';
    case 'youtube':
      return '#FF0000';
    case 'local':
      return 'hsl(var(--primary))';
    default:
      return 'hsl(var(--muted-foreground))';
  }
};

export const PlaybackBar = () => {
  const { hasPermission } = useAuth();
  const unified = useUnifiedAudio();
  const spotify = useSpotify();
  const { isLive, audioLevel, toggleBroadcast } = usePA();
  
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(100);
  
  const canControl = hasPermission('dj');
  
  const { 
    activeSource,
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    play,
    pause,
    next,
    previous
  } = unified;

  // For device selection, we still use Spotify context
  const { 
    isConnected: spotifyConnected, 
    devices,
    webPlayerReady,
    webPlayerDeviceId,
    playbackState,
    transferPlayback,
    refreshPlaybackState,
    activateWebPlayer,
    connect
  } = spotify;

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
    await unified.setVolume(newVolume);
  };

  const toggleMute = async () => {
    if (!canControl) return;
    if (isMuted) {
      await unified.setVolume(previousVolume);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      await unified.setVolume(0);
      setIsMuted(true);
    }
  };

  const handleSeek = async (value: number[]) => {
    if (!canControl) return;
    await unified.seek(value[0]);
  };

  // Show connect prompt if nothing is connected/playing
  const hasAnySource = activeSource || spotifyConnected;
  
  if (!hasAnySource) {
    return (
      <div className="fixed bottom-0 left-64 right-0 h-20 bg-card/95 backdrop-blur-xl border-t border-border z-50">
        <div className="h-full flex items-center justify-center gap-4 px-6">
          <Music className="h-5 w-5 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Connect a source to control playback</p>
          <Button 
            onClick={connect}
            size="sm" 
            className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold gap-2"
          >
            <SpotifyIcon /> Connect Spotify
          </Button>
        </div>
      </div>
    );
  }

  const sourceColor = getSourceColor(activeSource);

  return (
    <div className="fixed bottom-0 left-64 right-0 h-20 bg-card/95 backdrop-blur-xl border-t border-border z-50">
      <div className="h-full grid grid-cols-3 items-center px-4 gap-4">
        {/* Left: Track Info */}
        <div className="flex items-center gap-3 min-w-0">
          {currentTrack ? (
            <>
              {currentTrack.albumArt ? (
                <img 
                  src={currentTrack.albumArt}
                  alt=""
                  className="w-14 h-14 rounded shadow-lg object-cover"
                />
              ) : (
                <div 
                  className="w-14 h-14 rounded shadow-lg flex items-center justify-center"
                  style={{ backgroundColor: `${sourceColor}20` }}
                >
                  {getSourceIcon(activeSource)}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate text-sm">
                    {currentTrack.title}
                  </p>
                  <span 
                    className="flex-shrink-0 opacity-70"
                    style={{ color: sourceColor }}
                  >
                    {getSourceIcon(activeSource)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {currentTrack.artist}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded bg-secondary flex items-center justify-center">
                <Music className="h-5 w-5 text-muted-foreground" />
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
              disabled={!canControl || !activeSource}
            >
              <SkipBack className="h-4 w-4 fill-current" />
            </Button>
            <Button 
              size="icon" 
              className="h-9 w-9 rounded-full bg-foreground text-background hover:scale-105 transition-transform"
              onClick={handlePlayPause}
              disabled={!canControl || !activeSource}
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
              disabled={!canControl || !activeSource}
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
            <Slider
              value={[progress]}
              max={duration || 1}
              step={1000}
              onValueChange={handleSeek}
              disabled={!canControl || activeSource === 'spotify'}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: PA, Volume & Device */}
        <div className="flex items-center justify-end gap-3">
          {/* PA Mic Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={`h-8 w-8 ${isLive ? 'text-destructive bg-destructive/10 hover:bg-destructive/20' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={toggleBroadcast}
                disabled={!canControl}
              >
                {isLive ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{isLive ? 'Stop Broadcast' : 'Start PA Broadcast'}</p>
            </TooltipContent>
          </Tooltip>
          
          {/* Audio Level Meter */}
          {isLive && (
            <div className="flex items-center gap-0.5 h-6">
              {[...Array(5)].map((_, i) => {
                const threshold = (i + 1) * 20;
                const isActive = audioLevel >= threshold - 10;
                const barColor = i < 3 ? 'bg-green-500' : i < 4 ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-75 ${
                      isActive ? barColor : 'bg-muted-foreground/30'
                    }`}
                    style={{
                      height: `${12 + i * 3}px`,
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Source Indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
                style={{ 
                  backgroundColor: `${sourceColor}15`,
                  color: sourceColor 
                }}
              >
                {getSourceIcon(activeSource)}
                <span className="hidden sm:inline capitalize">
                  {activeSource || 'None'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Active source: {activeSource || 'None'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Device Selector Dropdown (for Spotify) */}
          {spotifyConnected && (
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
          )}
          
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
        </div>
      </div>
    </div>
  );
};