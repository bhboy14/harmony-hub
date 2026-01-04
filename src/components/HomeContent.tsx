import { useState, useEffect, useCallback } from "react";
import { Play, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpotify } from "@/contexts/SpotifyContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useColorExtractor } from "@/hooks/useColorExtractor";
import { useRecentlyPlayed, RecentTrack } from "@/hooks/useRecentlyPlayed";
import { RecentlyPlayed } from "@/components/RecentlyPlayed";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

interface QuickPlayItem {
  id: string;
  name: string;
  image?: string;
  uri?: string;
}

interface HomeContentProps {
  onOpenSearch: () => void;
}

export const HomeContent = ({ onOpenSearch }: HomeContentProps) => {
  const spotify = useSpotify();
  const [filter, setFilter] = useState<'all' | 'music' | 'podcasts'>('all');
  const [recentItems, setRecentItems] = useState<QuickPlayItem[]>([]);
  const { recentTracks, addTrack, clearHistory } = useRecentlyPlayed();
  
  // Get current album art for color extraction
  const currentAlbumArt = spotify.playbackState?.track?.album?.images?.[0]?.url;
  const { colors } = useColorExtractor(currentAlbumArt);

  // Get playlists from Spotify
  const playlists = spotify.playlists || [];
  
  // Build quick-play items from playlists
  useEffect(() => {
    if (playlists.length > 0) {
      const items = playlists.slice(0, 6).map((p: any) => ({
        id: p.id,
        name: p.name,
        image: p.images?.[0]?.url,
        uri: p.uri,
      }));
      setRecentItems(items);
    }
  }, [playlists]);

  // Track recently played when Spotify track changes
  useEffect(() => {
    if (spotify.playbackState?.track && spotify.playbackState.isPlaying) {
      const track = spotify.playbackState.track;
      addTrack({
        id: track.id,
        name: track.name,
        artist: track.artists.map((a: any) => a.name).join(", "),
        albumArt: track.album.images?.[0]?.url,
        uri: track.uri,
        source: 'spotify',
      });
    }
  }, [spotify.playbackState?.track?.id, spotify.playbackState?.isPlaying, addTrack]);

  const playItem = async (item: QuickPlayItem) => {
    if (!spotify.tokens?.accessToken || !item.uri) return;
    
    try {
      await supabase.functions.invoke('spotify-player', {
        body: {
          action: 'play',
          accessToken: spotify.tokens.accessToken,
          uri: item.uri,
        },
      });
      spotify.refreshPlaybackState();
    } catch (error) {
      console.error('Failed to play:', error);
    }
  };

  // Featured sections
  const madeForYou = playlists.filter((p: any) => 
    p.name?.toLowerCase().includes('mix') || 
    p.name?.toLowerCase().includes('daily') ||
    p.name?.toLowerCase().includes('discover')
  ).slice(0, 4);

  const topMixes = playlists.slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* Animated gradient background based on album art */}
      <div className="relative">
        <div 
          className="absolute inset-0 h-96 transition-all duration-1000 ease-out"
          style={{
            background: currentAlbumArt 
              ? `linear-gradient(180deg, hsl(${colors.vibrant}) 0%, hsl(${colors.primary}) 40%, hsl(0 0% 7%) 100%)`
              : 'linear-gradient(180deg, hsl(160 40% 20%) 0%, hsl(0 0% 7%) 100%)'
          }}
        >
          {/* Animated overlay for subtle movement */}
          <div 
            className="absolute inset-0 opacity-30 animate-pulse"
            style={{
              background: currentAlbumArt 
                ? `radial-gradient(ellipse at 30% 20%, hsl(${colors.vibrant} / 0.4) 0%, transparent 50%)`
                : 'none',
              animationDuration: '4s',
            }}
          />
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              background: currentAlbumArt 
                ? `radial-gradient(ellipse at 70% 60%, hsl(${colors.primary} / 0.3) 0%, transparent 50%)`
                : 'none',
              animation: 'pulse 6s ease-in-out infinite',
            }}
          />
        </div>
        
        {/* Content */}
        <div className="relative p-6 space-y-6">
          {/* Search Bar - Spotify style */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="What do you want to play?"
                className="pl-12 h-12 bg-secondary border-0 rounded-full text-sm placeholder:text-muted-foreground"
                onClick={onOpenSearch}
                readOnly
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2">
            {(['all', 'music', 'podcasts'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "secondary"}
                size="sm"
                className={`rounded-full h-8 px-4 capitalize ${
                  filter === f 
                    ? 'bg-foreground text-background hover:bg-foreground/90' 
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>

          {/* Quick Play Grid */}
          {recentItems.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {recentItems.map((item) => (
                <div
                  key={item.id}
                  className="quick-play-card group"
                  onClick={() => playItem(item)}
                >
                  <div className="w-12 h-12 flex-shrink-0">
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <SpotifyIcon />
                      </div>
                    )}
                  </div>
                  <span className="flex-1 font-medium text-sm truncate pr-2">
                    {item.name}
                  </span>
                  <Button
                    size="icon"
                    className="play-btn h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg mr-2"
                  >
                    <Play className="h-5 w-5 fill-current ml-0.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Connect Spotify prompt if not connected */}
          {!spotify.isConnected && (
            <div className="bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg p-6 text-center">
              <h3 className="text-xl font-bold text-foreground mb-2">Connect to Spotify</h3>
              <p className="text-muted-foreground mb-4">Link your Spotify account to see your playlists and play music</p>
              <Button 
                onClick={spotify.connect}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8"
              >
                Connect Spotify
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Recently Played Section */}
      <RecentlyPlayed recentTracks={recentTracks} onClearHistory={clearHistory} />

      {/* Made For You Section */}
      {madeForYou.length > 0 && (
        <section className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Made For You</h2>
            <button className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline">
              Show all
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {madeForYou.map((item: any) => (
              <div
                key={item.id}
                className="spotify-card group cursor-pointer"
                onClick={() => playItem({ id: item.id, name: item.name, image: item.images?.[0]?.url, uri: item.uri })}
              >
                <div className="relative mb-4">
                  <div className="aspect-square rounded-md overflow-hidden shadow-lg">
                    {item.images?.[0]?.url ? (
                      <img 
                        src={item.images[0].url} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <SpotifyIcon />
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    className="play-btn absolute bottom-2 right-2 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all"
                  >
                    <Play className="h-6 w-6 fill-current ml-0.5" />
                  </Button>
                </div>
                <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
                <p className="text-sm text-muted-foreground truncate mt-1">
                  {item.tracks?.total || 0} tracks
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Your Top Mixes */}
      {topMixes.length > 0 && (
        <section className="p-6 space-y-4 pb-32">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Your Library</h2>
            <button className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline">
              Show all
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {topMixes.map((item: any) => (
              <div
                key={item.id}
                className="spotify-card group cursor-pointer"
                onClick={() => playItem({ id: item.id, name: item.name, image: item.images?.[0]?.url, uri: item.uri })}
              >
                <div className="relative mb-4">
                  <div className="aspect-square rounded-md overflow-hidden shadow-lg">
                    {item.images?.[0]?.url ? (
                      <img 
                        src={item.images[0].url} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <SpotifyIcon />
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    className="play-btn absolute bottom-2 right-2 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all"
                  >
                    <Play className="h-6 w-6 fill-current ml-0.5" />
                  </Button>
                </div>
                <h3 className="font-semibold text-foreground truncate text-sm">{item.name}</h3>
                <p className="text-xs text-muted-foreground truncate mt-1">
                  {item.description || `${item.tracks?.total || 0} tracks`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
