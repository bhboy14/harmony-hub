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
  const spotifyTrack = spotify.playbackState?.track;

  if (!isOpen) return null;

  return (
    <div className="w-80 h-full bg-card flex flex-col border-l border-border animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Music className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">
            {currentTrack?.title || "Nothing playing"}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {/* Album Art */}
        <div className="p-4">
          <div className="aspect-square rounded-xl overflow-hidden shadow-2xl bg-secondary">
            {currentTrack?.albumArt ? (
              <img src={currentTrack.albumArt} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="h-20 w-20 text-muted-foreground/20" />
              </div>
            )}
          </div>
        </div>

        {/* Track Info */}
        <div className="px-4 pb-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground leading-tight tracking-tight break-words">
              {currentTrack?.title || "No track"}
            </h2>
            <p className="text-base text-muted-foreground truncate">{currentTrack?.artist || "Unknown artist"}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" className="flex-1 gap-2 rounded-full">
              <Plus className="h-4 w-4" /> Add to Playlist
            </Button>
            <Button variant="secondary" size="icon" className="rounded-full">
              <Share className="h-4 w-4" />
            </Button>
          </div>

          {/* Spotify Specific Credits */}
          {activeSource === "spotify" && spotifyTrack && (
            <div className="bg-secondary/30 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">About the artist</span>
                <Button variant="link" className="text-xs h-auto p-0 text-muted-foreground">
                  Show all
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Music className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{spotifyTrack.artists?.[0]?.name}</p>
                  <p className="text-xs text-muted-foreground">Main Artist</p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs rounded-full">
                  Follow
                </Button>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Playing From</p>
            <p className="text-sm font-medium capitalize flex items-center gap-2 mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {activeSource || "none"}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-background">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground gap-2"
        >
          <MoreHorizontal className="h-4 w-4" /> More Options
        </Button>
      </div>
    </div>
  );
};
