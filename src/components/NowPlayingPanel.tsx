import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { X, Share, Plus, MoreHorizontal, Music } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NowPlayingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NowPlayingPanel = ({ isOpen, onClose }: NowPlayingPanelProps) => {
  const unified = useUnifiedAudio();
  const spotify = useSpotify();
  
  const { currentTrack, activeSource } = unified;
  
  // Get additional info from Spotify if available
  const spotifyTrack = spotify.playbackState?.track;

  if (!isOpen) return null;

  return (
    <div className="w-80 h-full bg-card flex flex-col border-l border-border animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {currentTrack?.title || "Nothing playing"}
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Album Art */}
      <div className="p-4 now-playing-gradient">
        <div className="aspect-square rounded-lg overflow-hidden shadow-lg">
          {currentTrack?.albumArt ? (
            <img 
              src={currentTrack.albumArt} 
              alt={currentTrack.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <Music className="h-20 w-20 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Track Info */}
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-foreground truncate">
              {currentTrack?.title || "No track"}
            </h2>
            <p className="text-sm text-muted-foreground truncate">
              {currentTrack?.artist || "Unknown artist"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Share className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Credits Section */}
        {activeSource === 'spotify' && spotifyTrack && (
          <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Credits</span>
              <button className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                Show all
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {spotifyTrack.artists?.[0]?.name || currentTrack?.artist}
                </p>
                <p className="text-xs text-muted-foreground">Main Artist</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-xs rounded-full border-border"
              >
                Follow
              </Button>
            </div>
          </div>
        )}

        {/* Source indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">Playing from {activeSource || 'nowhere'}</span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-muted-foreground hover:text-foreground gap-2"
        >
          <MoreHorizontal className="h-4 w-4" />
          More options
        </Button>
      </div>
    </div>
  );
};
