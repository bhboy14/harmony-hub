import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Play, Music, Loader2, TrendingUp, Youtube, HardDrive, ExternalLink } from "lucide-react";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { supabase } from "@/integrations/supabase/client";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

interface Track {
  id: string;
  name: string;
  artist: string;
  albumArt?: string;
  uri?: string;
  source: 'spotify' | 'youtube' | 'local';
}

interface MusicBrowserProps {
  onOpenFullLibrary: () => void;
}

export const MusicBrowser = ({ onOpenFullLibrary }: MusicBrowserProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeSource, setActiveSource] = useState<'spotify' | 'youtube' | 'local'>('spotify');
  
  const spotify = useSpotify();
  const unifiedAudio = useUnifiedAudio();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);

    try {
      if (activeSource === 'spotify' && spotify.isConnected && spotify.tokens?.accessToken) {
        const response = await supabase.functions.invoke('spotify-player', {
          body: {
            action: 'search',
            accessToken: spotify.tokens.accessToken,
            query: searchQuery,
            type: 'track',
            limit: 10,
          },
        });

        if (response.data?.tracks?.items) {
          const tracks: Track[] = response.data.tracks.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            artist: item.artists.map((a: any) => a.name).join(', '),
            albumArt: item.album.images[0]?.url,
            uri: item.uri,
            source: 'spotify' as const,
          }));
          setSearchResults(tracks);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const playTrack = async (track: Track) => {
    if (track.source === 'spotify' && track.uri && spotify.tokens?.accessToken) {
      try {
        // First, get available devices and find web player
        const devicesResponse = await supabase.functions.invoke('spotify-player', {
          body: {
            action: 'get_devices',
            accessToken: spotify.tokens.accessToken,
          },
        });

        const devices = devicesResponse.data?.devices || [];
        const webPlayer = devices.find((d: any) => d.name?.includes('Web Player'));
        const activeDevice = devices.find((d: any) => d.is_active);
        const targetDevice = activeDevice || webPlayer || devices[0];

        if (!targetDevice) {
          // Activate web player if no device found
          if (spotify.activateWebPlayer) {
            await spotify.activateWebPlayer();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for activation
          }
        }

        // Check if it's a playlist/album (context) or a track
        const isContext = track.uri.includes(':playlist:') || track.uri.includes(':album:');
        
        await supabase.functions.invoke('spotify-player', {
          body: {
            action: 'play',
            accessToken: spotify.tokens.accessToken,
            deviceId: targetDevice?.id,
            ...(isContext ? { uri: track.uri } : { uris: [track.uri] }),
          },
        });
        spotify.refreshPlaybackState();
      } catch (error) {
        console.error('Failed to play track:', error);
      }
    }
  };

  // Popular/Featured tracks (placeholder - could fetch from API)
  const featuredTracks: Track[] = spotify.playlists?.slice(0, 4).map((playlist: any) => ({
    id: playlist.id,
    name: playlist.name,
    artist: `${playlist.tracks?.total || 0} tracks`,
    albumArt: playlist.images?.[0]?.url,
    uri: playlist.uri,
    source: 'spotify' as const,
  })) || [];

  return (
    <Card className="glass-panel h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Music className="h-5 w-5 text-primary" />
            Music Browser
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onOpenFullLibrary} className="text-xs gap-1">
            Full Library <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source Tabs */}
        <div className="flex gap-2">
          <Button 
            variant={activeSource === 'spotify' ? "default" : "outline"} 
            size="sm" 
            className="flex-1 gap-2"
            style={activeSource === 'spotify' && spotify.isConnected ? { backgroundColor: "#1DB954" } : {}}
            onClick={() => {
              setActiveSource('spotify');
              if (!spotify.isConnected) spotify.connect();
            }}
          >
            <SpotifyIcon />
            Spotify
          </Button>
          <Button 
            variant={activeSource === 'youtube' ? "default" : "outline"} 
            size="sm" 
            className="flex-1 gap-2"
            onClick={() => setActiveSource('youtube')}
          >
            <Youtube className="h-4 w-4 text-[#FF0000]" />
            YouTube
          </Button>
          <Button 
            variant={activeSource === 'local' ? "default" : "outline"} 
            size="sm" 
            className="flex-1 gap-2"
            onClick={() => {
              setActiveSource('local');
              onOpenFullLibrary();
            }}
          >
            <HardDrive className="h-4 w-4" />
            Local
          </Button>
        </div>

        {/* Search Bar */}
        {activeSource === 'spotify' && spotify.isConnected && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search songs, artists, albums..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching} size="icon">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Search className="h-3 w-3" /> Search Results
            </p>
            {searchResults.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer group transition-all"
                onClick={() => playTrack(track)}
              >
                {track.albumArt ? (
                  <img src={track.albumArt} alt="" className="w-10 h-10 rounded shadow" />
                ) : (
                  <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                    <Music className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{track.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Featured / Playlists */}
        {searchResults.length === 0 && activeSource === 'spotify' && (
          <>
            {spotify.isConnected ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Your Playlists
                </p>
                {featuredTracks.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {featuredTracks.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-all"
                        onClick={() => playTrack(item)}
                      >
                        {item.albumArt ? (
                          <img src={item.albumArt} alt="" className="w-10 h-10 rounded shadow" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                            <Music className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.artist}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Search for music above
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="text-[#1DB954] mx-auto mb-2 scale-150"><SpotifyIcon /></div>
                <p className="text-sm text-muted-foreground mb-3">Connect Spotify to search & play music</p>
                <Button 
                  onClick={spotify.connect}
                  style={{ backgroundColor: "#1DB954" }}
                  className="text-black"
                >
                  Connect Spotify
                </Button>
              </div>
            )}
          </>
        )}

        {/* YouTube placeholder */}
        {activeSource === 'youtube' && (
          <div className="text-center py-6">
            <Youtube className="h-12 w-12 mx-auto mb-2 text-[#FF0000]" />
            <p className="text-sm text-muted-foreground mb-3">Open full library for YouTube</p>
            <Button variant="outline" onClick={onOpenFullLibrary}>
              Open YouTube Player
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
