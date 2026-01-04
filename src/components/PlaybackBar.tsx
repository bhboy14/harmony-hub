import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { usePA } from "@/contexts/PAContext";
import { useCasting } from "@/contexts/CastingContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  Volume1,
  Repeat,
  Repeat1,
  Shuffle,
  MonitorSpeaker,
  Laptop,
  Smartphone,
  Speaker,
  Tv,
  Check,
  RefreshCw,
  Mic,
  MicOff,
  Music,
  HardDrive,
  Youtube,
  Maximize2,
  ListMusic,
  Airplay,
  Cast,
  Wifi,
  WifiOff
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useRef } from "react";
import { QueuePanel } from "@/components/QueuePanel";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const getDeviceIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'computer': return Laptop;
    case 'smartphone': return Smartphone;
    case 'speaker': return Speaker;
    case 'tv': return Tv;
    default: return MonitorSpeaker;
  }
};

const getSourceIcon = (source: string | null) => {
  switch (source) {
    case 'spotify': return <SpotifyIcon />;
    case 'local': return <HardDrive className="h-4 w-4" />;
    case 'youtube': return <Youtube className="h-4 w-4 text-[#FF0000]" />;
    default: return <Music className="h-4 w-4" />;
  }
};

export const PlaybackBar = () => {
  const { hasPermission } = useAuth();
  const unified = useUnifiedAudio();
  const spotify = useSpotify();
  const { isLive, audioLevel, toggleBroadcast } = usePA();
  const casting = useCasting();
  
  const [queueOpen, setQueueOpen] = useState(false);
  
  const canControl = hasPermission('dj');
  
  const { 
    activeSource,
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    isMuted,
    isLoading,
    play,
    pause,
    next,
    previous,
    queue,
    queueHistory,
    currentQueueIndex,
    upcomingTracks,
    shuffle,
    repeat,
    removeFromQueue,
    clearQueue,
    clearUpcoming,
    playQueueTrack,
    toggleShuffle,
    toggleRepeat,
    setGlobalVolume,
    toggleMute,
  } = unified;

  const { 
    isConnected: spotifyConnected, 
    devices,
    webPlayerReady,
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
    await setGlobalVolume(value[0]);
  };

  const handleToggleMute = async () => {
    if (!canControl) return;
    await toggleMute();
  };

  const handleSeek = async (value: number[]) => {
    if (!canControl) return;
    await unified.seek(value[0]);
  };

  const hasAnySource = activeSource || spotifyConnected;
  
  // Empty state
  if (!hasAnySource) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-[90px] bg-black border-t border-border z-50">
        <div className="h-full flex items-center justify-center gap-4 px-6">
          <Music className="h-5 w-5 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Connect a source to play music</p>
          <Button 
            onClick={connect}
            size="sm" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 rounded-full px-6"
          >
            <SpotifyIcon /> Connect Spotify
          </Button>
        </div>
      </div>
    );
  }

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[90px] bg-black border-t border-border z-50">
      <div className="h-full grid grid-cols-3 items-center px-4">
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
                <div className="w-14 h-14 rounded shadow-lg bg-secondary flex items-center justify-center">
                  {getSourceIcon(activeSource)}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate text-sm hover:underline cursor-pointer">
                  {currentTrack.title}
                </p>
                <p className="text-xs text-muted-foreground truncate hover:underline cursor-pointer">
                  {currentTrack.artist}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                  <path d="M1.69 2A4.582 4.582 0 018 2.023 4.583 4.583 0 0114.31 2a4.583 4.583 0 010 6.496L8 14.153 1.69 8.496a4.583 4.583 0 010-6.496z"/>
                </svg>
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded bg-secondary flex items-center justify-center">
                <Music className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">No track playing</p>
              </div>
            </div>
          )}
        </div>

        {/* Center: Playback Controls */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`h-8 w-8 ${shuffle ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              disabled={!canControl}
              onClick={toggleShuffle}
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
              className="h-8 w-8 rounded-full bg-foreground text-background hover:scale-105 hover:bg-foreground transition-transform"
              onClick={handlePlayPause}
              disabled={!canControl || !activeSource}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current ml-0.5" />
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
              className={`h-8 w-8 ${repeat !== 'off' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              disabled={!canControl}
              onClick={toggleRepeat}
            >
              {repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center gap-2 w-full max-w-[600px]">
            <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
              {formatTime(progress)}
            </span>
            <div className="flex-1 group">
              <Slider
                value={[progress]}
                max={duration || 1}
                step={1000}
                onValueChange={handleSeek}
                disabled={!canControl || activeSource === 'spotify'}
                className="cursor-pointer"
              />
            </div>
            <span className="text-xs text-muted-foreground w-10 tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center justify-end gap-1">
          {/* PA Mic */}
          {canControl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`h-8 w-8 ${isLive ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={toggleBroadcast}
                >
                  {isLive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isLive ? 'Stop Broadcast' : 'Start Broadcast'}</TooltipContent>
            </Tooltip>
          )}

          {/* Audio Level */}
          {isLive && (
            <div className="flex items-center gap-0.5 h-6 mx-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all ${
                    audioLevel >= (i + 1) * 20 - 10 
                      ? i < 3 ? 'bg-green-500' : i < 4 ? 'bg-yellow-500' : 'bg-red-500'
                      : 'bg-muted-foreground/30'
                  }`}
                  style={{ height: `${12 + i * 3}px` }}
                />
              ))}
            </div>
          )}

          {/* Now Playing Queue */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={`h-8 w-8 ${queueOpen || queue.length > 0 ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setQueueOpen(true)}
              >
                <ListMusic className="h-4 w-4" />
                {queue.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {queue.length > 99 ? '99+' : queue.length}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Queue ({queue.length})</TooltipContent>
          </Tooltip>

          {/* Device Selector */}
          {spotifyConnected && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`h-8 w-8 ${playbackState?.device ? 'text-primary' : 'text-muted-foreground'} hover:text-foreground`}
                  disabled={!canControl}
                >
                  <Airplay className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-popover" sideOffset={16}>
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-medium">Connect to a device</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); refreshPlaybackState(); }}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
                
                {webPlayerReady && (
                  <DropdownMenuItem 
                    onClick={activateWebPlayer}
                    className={`flex items-center gap-3 px-3 py-2 ${playbackState?.device?.name === 'Lovable Web Player' ? 'bg-primary/10' : ''}`}
                  >
                    <MonitorSpeaker className={`h-4 w-4 ${playbackState?.device?.name === 'Lovable Web Player' ? 'text-primary' : ''}`} />
                    <span className={playbackState?.device?.name === 'Lovable Web Player' ? 'text-primary font-medium' : ''}>This Browser</span>
                    {playbackState?.device?.name === 'Lovable Web Player' && <Check className="h-4 w-4 text-primary ml-auto" />}
                  </DropdownMenuItem>
                )}
                
                {devices.filter(d => d.name !== 'Lovable Web Player').map((device) => {
                  const DeviceIcon = getDeviceIcon(device.type);
                  return (
                    <DropdownMenuItem 
                      key={device.id}
                      onClick={() => !device.is_active && transferPlayback(device.id)}
                      className={`flex items-center gap-3 px-3 py-2 ${device.is_active ? 'bg-primary/10' : ''}`}
                    >
                      <DeviceIcon className={`h-4 w-4 ${device.is_active ? 'text-primary' : ''}`} />
                      <span className={device.is_active ? 'text-primary font-medium' : ''}>{device.name}</span>
                      {device.is_active && <Check className="h-4 w-4 text-primary ml-auto" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Cast to External Devices */}
          {casting.isCastingSupported && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`h-8 w-8 ${casting.isCasting ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {casting.isCasting ? (
                        <Wifi className="h-4 w-4" />
                      ) : (
                        <Cast className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  {casting.isCasting ? `Casting to ${casting.currentDevice?.name}` : 'Cast to device'}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-56">
                {casting.isCasting && casting.currentDevice ? (
                  <>
                    <div className="px-3 py-2 flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="font-medium">{casting.currentDevice.name}</span>
                    </div>
                    <DropdownMenuItem 
                      onClick={casting.stopCasting}
                      className="text-destructive focus:text-destructive"
                    >
                      <WifiOff className="h-4 w-4 mr-2" />
                      Disconnect
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    {/* Chromecast - Chrome only */}
                    {/chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent) && (
                      <DropdownMenuItem onClick={casting.startChromecast}>
                        <Cast className="h-4 w-4 mr-2" />
                        <div className="flex flex-col">
                          <span>Chromecast</span>
                          <span className="text-xs text-muted-foreground">Cast to nearby devices</span>
                        </div>
                      </DropdownMenuItem>
                    )}
                    {/* AirPlay - Safari only */}
                    {/^((?!chrome|android).)*safari/i.test(navigator.userAgent) && (
                      <DropdownMenuItem onClick={() => casting.startAirPlay()}>
                        <Airplay className="h-4 w-4 mr-2" />
                        <div className="flex flex-col">
                          <span>AirPlay</span>
                          <span className="text-xs text-muted-foreground">Stream to Apple devices</span>
                        </div>
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Volume */}
          <div className="flex items-center gap-1 w-32">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleToggleMute}
              disabled={!canControl}
            >
              <VolumeIcon className="h-4 w-4" />
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={100}
              step={1}
              onValueChange={handleVolumeChange}
              disabled={!canControl}
              className="w-24"
            />
          </div>

          {/* Fullscreen */}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Queue Panel */}
      <QueuePanel
        isOpen={queueOpen}
        onOpenChange={setQueueOpen}
        queue={queue}
        currentIndex={currentQueueIndex}
        upcomingTracks={upcomingTracks}
        history={queueHistory}
        onPlayTrack={playQueueTrack}
        onRemoveTrack={removeFromQueue}
        onClearQueue={clearQueue}
        onClearUpcoming={clearUpcoming}
        isPlaying={isPlaying}
      />
    </div>
  );
};
