import { useState } from "react";
import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { X, Music, Play, ChevronLeft, ChevronRight, Disc, ListMusic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeekBar } from "@/components/SeekBar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

export const SidebarPanel = ({ isOpen, onClose }: SidebarPanelProps) => {
  const [activeTab, setActiveTab] = useState<"nowPlaying" | "popular">("nowPlaying");
  const { currentTrack, activeSource, isPlaying, progress, duration, seek } = useUnifiedAudio();
  const spotify = useSpotify();

  if (!isOpen) return null;

  // Seek handler for SeekBar component
  const handleSeek = async (positionMs: number) => {
    await seek(positionMs);
  };

  const getSourceColor = (source: string | null) => {
    switch (source) {
      case 'spotify': return 'bg-[#1DB954]';
      case 'youtube': return 'bg-red-500';
      case 'local': return 'bg-amber-500';
      case 'soundcloud': return 'bg-orange-500';
      default: return 'bg-primary';
    }
  };

  const tabs = [
    { id: "nowPlaying" as const, label: "Now Playing", icon: Disc },
    { id: "popular" as const, label: "Popular", icon: ListMusic },
  ];

  const currentIndex = tabs.findIndex(t => t.id === activeTab);
  
  const goNext = () => {
    const nextIndex = (currentIndex + 1) % tabs.length;
    setActiveTab(tabs[nextIndex].id);
  };

  const goPrev = () => {
    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    setActiveTab(tabs[prevIndex].id);
  };

  // Get tracks for popular section
  const popularTracks: { id: string; name: string; artist: string; albumArt?: string; uri?: string }[] = [];
  if (spotify.recentlyPlayed?.length > 0) {
    spotify.recentlyPlayed.slice(0, 10).forEach((item: any) => {
      if (item.track && !popularTracks.find(t => t.id === item.track.id)) {
        popularTracks.push({
          id: item.track.id,
          name: item.track.name,
          artist: item.track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
          albumArt: item.track.album?.images?.[0]?.url,
          uri: item.track.uri,
        });
      }
    });
  }
  if (popularTracks.length < 8 && spotify.playlists?.length > 0) {
    spotify.playlists.slice(0, 8 - popularTracks.length).forEach((playlist: any) => {
      if (!popularTracks.find(t => t.id === playlist.id)) {
        popularTracks.push({
          id: playlist.id,
          name: playlist.name,
          artist: "Playlist",
          albumArt: playlist.images?.[0]?.url,
          uri: playlist.uri,
        });
      }
    });
  }

  const handlePlayTrack = (uri?: string) => {
    if (uri) {
      spotify.play(undefined, [uri]);
    }
  };

  return (
    <div className="w-72 sm:w-80 h-full bg-background/95 backdrop-blur-sm flex flex-col border-l border-border">
      {/* Header with tab navigation */}
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-secondary/30">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={goPrev}
          className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <tab.icon className="h-3 w-3" />
              {tab.label}
            </button>
          ))}
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={goNext}
          className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Close button */}
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onClose} 
        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground z-10"
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Tab Content */}
      <ScrollArea className="flex-1">
        {activeTab === "nowPlaying" && (
          <div className="p-4 space-y-4">
            {/* Album Art */}
            <div className="aspect-square rounded-xl overflow-hidden shadow-lg bg-secondary/50">
              {currentTrack?.albumArt ? (
                <img src={currentTrack.albumArt} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary">
                  <Music className="h-16 w-16 text-muted-foreground/50" />
                </div>
              )}
            </div>

            {/* Track Info */}
            <div className="space-y-1 text-center">
              <h2 className="text-base font-bold text-foreground truncate leading-tight">
                {currentTrack?.title || "No track playing"}
              </h2>
              <p className="text-muted-foreground truncate text-sm">
                {currentTrack?.artist || "Select a track to play"}
              </p>
            </div>

            {currentTrack && (
              <SeekBar
                progressMs={progress}
                durationMs={duration}
                onSeek={handleSeek}
                showLabels={false}
                activeSource={activeSource}
              />
            )}

            {/* Source Info */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-center gap-2 text-foreground text-sm capitalize">
                <div className={`h-2.5 w-2.5 rounded-full ${getSourceColor(activeSource)} ${isPlaying ? 'animate-pulse' : ''}`} />
                <span className="text-muted-foreground text-xs">{activeSource || "None"}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "popular" && (
          <div className="p-3 space-y-1">
            {popularTracks.length > 0 ? (
              popularTracks.map((track, index) => (
                <div
                  key={track.id}
                  className="group flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-all"
                  onClick={() => handlePlayTrack(track.uri)}
                >
                  <div className="w-5 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-muted-foreground group-hover:hidden">{index + 1}</span>
                    <Play className="h-3 w-3 hidden group-hover:block text-primary" />
                  </div>
                  <div className="w-9 h-9 rounded overflow-hidden bg-secondary flex-shrink-0">
                    {track.albumArt ? (
                      <img src={track.albumArt} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <SpotifyIcon />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs text-foreground truncate">{track.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Music className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No songs yet</p>
                <p className="text-xs">Connect Spotify to see popular tracks</p>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
