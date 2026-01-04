import { Play, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecentTrack, useRecentlyPlayed } from "@/hooks/useRecentlyPlayed";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { supabase } from "@/integrations/supabase/client";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

interface RecentlyPlayedProps {
  recentTracks: RecentTrack[];
  onClearHistory: () => void;
}

export const RecentlyPlayed = ({ recentTracks, onClearHistory }: RecentlyPlayedProps) => {
  const spotify = useSpotify();
  const unifiedAudio = useUnifiedAudio();

  const formatTimeAgo = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const playTrack = async (track: RecentTrack) => {
    if (track.source === 'spotify' && track.uri) {
      if (!spotify.tokens?.accessToken) return;
      try {
        await supabase.functions.invoke('spotify-player', {
          body: {
            action: 'play',
            accessToken: spotify.tokens.accessToken,
            uris: [track.uri],
          },
        });
        spotify.refreshPlaybackState();
      } catch (error) {
        console.error('Failed to play Spotify track:', error);
      }
    } else if (track.source === 'youtube' && track.videoId) {
      unifiedAudio.playYouTubeVideo(track.videoId, track.name);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'spotify':
        return <SpotifyIcon />;
      case 'youtube':
        return <YouTubeIcon />;
      default:
        return null;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'spotify':
        return 'text-[#1DB954]';
      case 'youtube':
        return 'text-[#FF0000]';
      default:
        return 'text-muted-foreground';
    }
  };

  if (recentTracks.length === 0) {
    return null;
  }

  return (
    <section className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="section-title">Recently Played</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearHistory}
          className="text-muted-foreground hover:text-foreground"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {recentTracks.slice(0, 12).map((track) => (
          <div
            key={`${track.id}-${track.playedAt}`}
            className="spotify-card group cursor-pointer"
            onClick={() => playTrack(track)}
          >
            <div className="relative mb-3">
              <div className="aspect-square rounded-md overflow-hidden shadow-lg">
                {track.albumArt ? (
                  <img
                    src={track.albumArt}
                    alt={track.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <div className={getSourceColor(track.source)}>
                      {getSourceIcon(track.source)}
                    </div>
                  </div>
                )}
              </div>
              <Button
                size="icon"
                className="play-btn absolute bottom-2 right-2 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all"
              >
                <Play className="h-5 w-5 fill-current ml-0.5" />
              </Button>
              {/* Source badge */}
              <div className={`absolute top-2 left-2 p-1 rounded bg-black/60 ${getSourceColor(track.source)}`}>
                {getSourceIcon(track.source)}
              </div>
            </div>
            <h3 className="font-semibold text-foreground truncate text-sm">{track.name}</h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{track.artist}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{formatTimeAgo(track.playedAt)}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
