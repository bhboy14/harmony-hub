import { useState, useEffect } from "react";
import { Play, Library, History, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpotify } from "@/contexts/SpotifyContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRecentlyPlayed } from "@/hooks/useRecentlyPlayed";
import { RecentlyPlayed } from "@/components/RecentlyPlayed";
import { SourceIcon } from "@/components/SourceIcon";
import { PopularSongs } from "@/components/PopularSongs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

interface QuickPlayItem {
  id: string;
  name: string;
  image?: string;
  uri?: string;
  source?: "spotify" | "soundcloud" | "youtube" | "local";
}

interface HomeContentProps {
  onOpenSearch: () => void;
}

export const HomeContent = ({ onOpenSearch }: HomeContentProps) => {
  const spotify = useSpotify();
  const [filter, setFilter] = useState<"all" | "spotify" | "soundcloud" | "youtube" | "local">("all");
  const [recentItems, setRecentItems] = useState<QuickPlayItem[]>([]);
  const [playError, setPlayError] = useState<string | null>(null);
  const { recentTracks, addTrack, clearHistory } = useRecentlyPlayed();

  // Get playlists from Spotify
  const playlists = spotify.playlists || [];

  // Build Library / Quick Access items
  useEffect(() => {
    if (playlists.length > 0) {
      const items = playlists.slice(0, 10).map((p: any) => ({
        id: p.id,
        name: p.name,
        image: p.images?.[0]?.url,
        uri: p.uri,
        source: "spotify" as const,
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
        source: "spotify",
      });
    }
  }, [spotify.playbackState?.track?.id, spotify.playbackState?.isPlaying, addTrack]);

  // Apply Filter Logic for Library
  const filteredItems = recentItems.filter((item) => {
    if (filter === "all") return true;
    return item.source === filter;
  });

  // Apply Filter and Map Data Logic for Recently Played
  const filteredRecentTracks = recentTracks
    .filter((track) => {
      if (filter === "all") return true;
      return track.source === filter;
    })
    .map((track) => ({
      ...track,
      title: track.name, // Map name -> title
      coverUrl: track.albumArt || "", // Map albumArt -> coverUrl (handle undefined)
      playedAt: new Date(track.playedAt).toISOString(), // Convert timestamp number to ISO string
    }));

  const playItem = async (item: QuickPlayItem) => {
    if (!spotify.tokens?.accessToken || !item.uri) return;
    setPlayError(null);

    try {
      const deviceId = spotify.playbackState?.device?.id;

      const { error } = await supabase.functions.invoke("spotify-player", {
        body: {
          action: "play",
          accessToken: spotify.tokens.accessToken,
          uri: item.uri,
          deviceId: deviceId,
        },
      });

      if (error) throw error;
      setTimeout(() => spotify.refreshPlaybackState(), 500);
    } catch (error: any) {
      console.error("Failed to play:", error);
      if (error.message?.includes("No active device")) {
        setPlayError("No active Spotify device found. Open Spotify on your device and try again.");
      } else {
        setPlayError("Failed to start playback. Check your connection.");
      }
    }
  };

  // Featured sections
  const madeForYou = playlists
    .filter(
      (p: any) =>
        p.name?.toLowerCase().includes("mix") ||
        p.name?.toLowerCase().includes("daily") ||
        p.name?.toLowerCase().includes("discover"),
    )
    .slice(0, 4);

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
        {/* Top Section: Search & Filter */}
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search Spotify, SoundCloud, YouTube, and local files..."
              className="pl-12 h-12 bg-secondary/50 border-0 rounded-full text-sm placeholder:text-muted-foreground shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
              onClick={onOpenSearch}
              readOnly
            />
          </div>

          {/* Service Filters */}
          <div className="flex gap-2">
            {(["all", "spotify", "soundcloud", "youtube", "local"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "secondary"}
                size="sm"
                className={`rounded-full h-8 px-4 text-sm font-medium capitalize transition-all ${
                  filter === f
                    ? "bg-[#1DB954] text-black hover:bg-[#1ed760]"
                    : "bg-secondary/50 hover:bg-secondary text-foreground border-0"
                }`}
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>

          {/* Error Alert if Playback Fails */}
          {playError && (
            <Alert variant="destructive" className="max-w-2xl">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Playback Error</AlertTitle>
              <AlertDescription>{playError}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* MIDDLE SECTION: Hero / Banner */}
        {!spotify.isConnected ? (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1DB954]/20 via-[#1DB954]/5 to-background border border-[#1DB954]/20 p-8 md:p-12 text-center shadow-2xl">
            <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)] pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center justify-center space-y-6">
              <div className="h-16 w-16 bg-[#1DB954] rounded-full flex items-center justify-center shadow-lg mb-2">
                <SpotifyIcon />
              </div>
              <h3 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Connect to Spotify</h3>
              <p className="text-muted-foreground max-w-lg mx-auto text-lg">
                Link your account to unlock your playlists, daily mixes, and cross-platform playback history.
              </p>
              <Button
                onClick={spotify.connect}
                className="bg-[#1DB954] text-black hover:bg-[#1ed760] font-bold rounded-full px-8 py-6 h-auto text-lg transition-transform hover:scale-105 shadow-[0_0_20px_-5px_#1DB954]"
              >
                Connect Spotify
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/20 to-secondary/20 border border-white/5 p-8 shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-left">
                <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
                <p className="text-muted-foreground">Ready to jump back into the flow?</p>
              </div>
              {recentItems[0] && (
                <div
                  className="flex items-center gap-4 bg-black/20 p-2 pr-4 rounded-full hover:bg-black/40 transition-colors cursor-pointer border border-white/5"
                  onClick={() => playItem(recentItems[0])}
                >
                  <div className="h-12 w-12 rounded-full overflow-hidden">
                    <img src={recentItems[0].image} alt="Art" className="h-full w-full object-cover" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">Jump back in</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">{recentItems[0].name}</p>
                  </div>
                  <Play className="h-5 w-5 text-primary ml-2" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Library Grid */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5" />
            <h2 className="text-2xl font-bold text-foreground">Your Library</h2>
          </div>

          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex flex-col gap-2 p-3 bg-card/40 hover:bg-card/80 rounded-md transition-all duration-200 cursor-pointer border border-transparent hover:border-white/5"
                  onClick={() => playItem(item)}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-md shadow-lg">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <SpotifyIcon />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20">
                      <Button
                        size="icon"
                        className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-xl hover:scale-105 transition-transform"
                      >
                        <Play className="h-6 w-6 fill-current ml-1" />
                      </Button>
                    </div>
                    <div className="absolute bottom-2 left-2">
                      <SourceIcon source={item.source || "spotify"} size="sm" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-sm text-foreground truncate">{item.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{item.source} • Playlist</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 bg-secondary/20 rounded-lg border border-dashed border-white/10">
              <Library className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {filter === "all"
                  ? "Your library is empty. Connect services to get started."
                  : `No ${filter} items found in your library.`}
              </p>
            </div>
          )}
        </div>

        {/* Recently Played */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            <h2 className="text-2xl font-bold text-foreground">Recently Played</h2>
          </div>
          <RecentlyPlayed recentTracks={filteredRecentTracks} onClearHistory={clearHistory} />
        </div>

        {/* Spotify Mixes */}
        {spotify.isConnected && madeForYou.length > 0 && (filter === "spotify" || filter === "all") ? (
          <div className="space-y-4 pt-4">
            <h2 className="text-2xl font-bold text-foreground">Made For You</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar -mx-6 px-6">
              {madeForYou.map((item: any) => (
                <div
                  key={item.id}
                  className="flex-shrink-0 w-40 md:w-48 group cursor-pointer"
                  onClick={() =>
                    playItem({
                      id: item.id,
                      name: item.name,
                      image: item.images?.[0]?.url,
                      uri: item.uri,
                      source: "spotify",
                    })
                  }
                >
                  <div className="relative mb-3">
                    <div className="aspect-square rounded-md overflow-hidden shadow-lg bg-secondary">
                      {item.images?.[0]?.url ? (
                        <img src={item.images[0].url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-secondary flex items-center justify-center">
                          <SpotifyIcon />
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="font-semibold text-foreground truncate text-sm">{item.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">Mixed for you</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Right Sidebar */}
      <div className="w-80 flex-shrink-0 border-l border-border/30 hidden md:block bg-background/50 backdrop-blur-sm">
        <ScrollArea className="h-full">
          <div className="p-4">
            <PopularSongs title="Popular Songs" />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
