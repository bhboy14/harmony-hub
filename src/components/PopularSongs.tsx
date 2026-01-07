import { Play, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSpotify } from "@/contexts/SpotifyContext";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

interface Track {
  id: string;
  name: string;
  artist: string;
  albumArt?: string;
  uri?: string;
}

interface PopularSongsProps {
  title?: string;
}

export const PopularSongs = ({ title = "Popular Songs" }: PopularSongsProps) => {
  const spotify = useSpotify();
  
  // Get tracks from Spotify recently played or playlists
  const tracks: Track[] = [];
  
  // Add recently played tracks
  if (spotify.recentlyPlayed?.length > 0) {
    spotify.recentlyPlayed.slice(0, 10).forEach((item: any) => {
      if (item.track && !tracks.find(t => t.id === item.track.id)) {
        tracks.push({
          id: item.track.id,
          name: item.track.name,
          artist: item.track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
          albumArt: item.track.album?.images?.[0]?.url,
          uri: item.track.uri,
        });
      }
    });
  }
  
  // Add tracks from playlists if we don't have enough
  if (tracks.length < 8 && spotify.playlists?.length > 0) {
    spotify.playlists.slice(0, 8 - tracks.length).forEach((playlist: any) => {
      if (!tracks.find(t => t.id === playlist.id)) {
        tracks.push({
          id: playlist.id,
          name: playlist.name,
          artist: "Playlist",
          albumArt: playlist.images?.[0]?.url,
          uri: playlist.uri,
        });
      }
    });
  }

  const handlePlay = (track: Track) => {
    if (track.uri) {
      spotify.play(undefined, [track.uri]);
    }
  };

  if (!spotify.isConnected) {
    return null;
  }

  return (
    <div className="bg-card/50 rounded-xl border border-border/30 overflow-hidden">
      <div className="p-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center">
            <Music className="h-3 w-3 text-primary" />
          </div>
          <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        </div>
      </div>
      
      <ScrollArea className="h-auto max-h-[60vh]">
        <div className="p-2 space-y-0.5">
          {tracks.length > 0 ? (
            tracks.map((track, index) => (
              <div
                key={track.id}
                className="group flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-all"
                onClick={() => handlePlay(track)}
              >
                {/* Index / Play button */}
                <div className="w-5 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-muted-foreground group-hover:hidden">
                    {index + 1}
                  </span>
                  <Play className="h-3 w-3 hidden group-hover:block text-primary" />
                </div>
                
                {/* Album Art */}
                <div className="w-9 h-9 rounded overflow-hidden bg-secondary flex-shrink-0">
                  {track.albumArt ? (
                    <img 
                      src={track.albumArt} 
                      alt={track.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <SpotifyIcon />
                    </div>
                  )}
                </div>
                
                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs text-foreground truncate leading-tight">
                    {track.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {track.artist}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Music className="h-6 w-6 mb-2 opacity-50" />
              <p className="text-xs">No songs yet</p>
              <p className="text-[10px]">Play something on Spotify</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
