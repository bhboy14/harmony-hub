```typescript
import { useState, useEffect, useCallback } from "react";
import { Play, ChevronRight, Library, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpotify } from "@/contexts/SpotifyContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useColorExtractor } from "@/hooks/useColorExtractor";
import { useRecentlyPlayed, RecentTrack } from "@/hooks/useRecentlyPlayed";
import { RecentlyPlayed } from "@/components/RecentlyPlayed";
import { SourceIcon } from "@/components/SourceIcon";
import { PopularSongs } from "@/components/PopularSongs";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  source?: 'spotify' | 'soundcloud' | 'youtube' | 'local';
}

interface HomeContentProps {
  onOpenSearch: () => void;
}

export const HomeContent = ({ onOpenSearch }: HomeContentProps) => {
  const spotify = useSpotify();
  const [filter, setFilter] = useState<'all' | 'spotify' | 'soundcloud' | 'youtube' | 'local'>('all');
  const [recentItems, setRecentItems] = useState<QuickPlayItem[]>([]);
  const { recentTracks, addTrack, clearHistory } = useRecentlyPlayed();
  
  // Get current album art for color extraction
  const currentAlbumArt = spotify.playbackState?.track?.album?.images?.[0]?.url;
  const { colors } = useColorExtractor(currentAlbumArt);

  // Get playlists from Spotify
  const playlists = spotify.playlists || [];
  
  // Build Library / Quick Access items
  useEffect(() => {
    if (playlists.length > 0) {
      const items = playlists.slice(0, 8).map((p: any) => ({
        id: p.id,
        name: p.name,
        image: p.images?.[0]?.url,
        uri: p.uri,
        source: 'spotify'
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
    <div className="flex-1 flex overflow-hidden">
      {/* Main Content Area */}
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
          {/* Unified Search Bar */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search Spotify, SoundCloud, YouTube, and local files..."
                className="pl-12 h-12 bg-secondary border-0 rounded-full text-sm placeholder:text-muted-foreground shadow-lg"
                onClick={onOpenSearch}
                readOnly
              />
            </div>
          </div>

          {/* Service Filters */}
          <div className="flex gap-2">
            {(['all', 'spotify', 'soundcloud', 'youtube', 'local'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "secondary"}
                size="sm"
                className={`rounded-full h-8 px-4 text-sm font-medium capitalize transition-all ${
                  filter === f 
                    ? 'bg-foreground text-background hover:bg-foreground/90' 
                    : 'bg-white/10 hover:bg-white/20 text-foreground border-0'
                }`}
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>

          {/* Library Section */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <Library className="w-5 h-5" />
                <h2 className="text-2xl font-bold text-foreground">Your Library</h2>
             </div>
             
             {recentItems.length > 0 ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {recentItems.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-0 bg-white/5 hover:bg-white/10 rounded-md overflow-hidden cursor-pointer transition-all duration-200"
                      onClick={() => playItem(item)}
                    >
                      {/* Album Art */}
                      <div className="w-16 h-16 flex-shrink-0 shadow-lg relative">
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
                        <div className="absolute bottom-1 left-1">
                           <SourceIcon source={item.source || 'spotify'} size="xs" />
                        </div>
                      </div>
                      {/* Title */}
                      <span className="flex-1 font-semibold text-sm text-foreground truncate px-4">
                        {item.name}
                      </span>
                      {/* Play Button - appears on hover */}
                      <Button
                        size="icon"
                        className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-xl opacity-0 group-hover:opacity-100 mr-3 transition-all duration-200 hover:scale-105"
                      >
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm italic py-4">
                   Connect services to populate your library.
                </div>
              )}
          </div>

          {/* Connect Spotify prompt if not connected */}
          {!spotify.isConnected && (
            <div className="bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg p-6 text-center mt-6">
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

      {/* Unified Playback History Section */}
      <div className="px-6 pb-8">
        <div className="flex items-center gap-2 mb-4 mt-2">
            <History className="w-5 h-5" />
            <h2 className="text-2xl font-bold text-foreground">Recently Played</h2>
        </div>
        
        {/* 1. Local/Mixed History */}
        <RecentlyPlayed recentTracks={recentTracks} onClearHistory={clearHistory} />

        {/* 2. Spotify History (Stream) */}
        {spotify.isConnected && spotify.recentlyPlayed.length > 0 && (
          <section className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
                <SpotifyIcon />
                Spotify History
              </h3>
              <button 
                onClick={() => spotify.loadRecentlyPlayed()}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Refresh
              </button>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar -mx-6 px-6">
              {spotify.recentlyPlayed.map((item: any, index: number) => (
                <div
                  key={`${item.track.id}-${index}`}
                  className="flex-shrink-0 w-44 group cursor-pointer"
                  onClick={() => spotify.play(undefined, [item.track.uri])}
                >
                  <div className="relative mb-3">
                    <div className="aspect-square rounded-lg overflow-hidden shadow-lg bg-secondary">
                      {item.track.album?.images?.[0]?.url ? (
                        <img 
                          src={item.track.album.images[0].url} 
                          alt={item.track.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
                          <SpotifyIcon />
                        </div>
                      )}
                    </div>
                    <Button
                      size="icon"
                      className="absolute bottom-2 right-2 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-2xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:scale-105"
                    >
                      <Play className="h-6 w-6 fill-current ml-0.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate text-sm">{item.track.name}</h3>
                    <SourceIcon source="spotify" size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                    {item.track.artists?.map((a: any) => a.name).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. Spotify "Made For You" (Mixes) */}
        {madeForYou.length > 0 && (
          <section className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-muted-foreground">Made For You</h3>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar -mx-6 px-6">
              {madeForYou.map((item: any) => (
                <div
                  key={item.id}
                  className="flex-shrink-0 w-44 group cursor-pointer"
                  onClick={() => playItem({ id: item.id, name: item.name, image: item.images?.[0]?.url, uri: item.uri })}
                >
                  <div className="relative mb-3">
                    <div className="aspect-square rounded-lg overflow-hidden shadow-lg bg-secondary">
                      {item.images?.[0]?.url ? (
                        <img 
                          src={item.images[0].url} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
                          <SpotifyIcon />
                        </div>
                      )}
                    </div>
                    <Button
                      size="icon"
                      className="absolute bottom-2 right-2 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-2xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:scale-105"
                    >
                      <Play className="h-6 w-6 fill-current ml-0.5" />
                    </Button>
                  </div>
                  <h3 className="font-semibold text-foreground truncate text-sm">{item.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    Mixed for you
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      </div>
      
      {/* Right Sidebar - Popular Songs */}
      <div className="w-80 flex-shrink-0 p-4 border-l border-border/30 hidden xl:block overflow-y-auto custom-scrollbar">
        <PopularSongs title="Popular Songs" />
      </div>
    </div>
  );
};

```