import { useState, useEffect } from "react";
import { Play, Search, Music, Loader2, TrendingUp, History, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useToast } from "@/hooks/use-toast";

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

interface YouTubeTrack {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

export const YouTubeView = () => {
  const { toast } = useToast();
  const unifiedAudio = useUnifiedAudio();
  const [searchQuery, setSearchQuery] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<YouTubeTrack[]>([]);
  const [trendingTracks, setTrendingTracks] = useState<YouTubeTrack[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [recentlyWatched, setRecentlyWatched] = useState<YouTubeTrack[]>([]);

  // Load trending music on mount
  useEffect(() => {
    loadTrending();
    // Load recently watched from localStorage
    const stored = localStorage.getItem('youtube_recently_watched');
    if (stored) {
      setRecentlyWatched(JSON.parse(stored).slice(0, 8));
    }
  }, []);

  const loadTrending = async () => {
    try {
      const response = await supabase.functions.invoke('youtube-search', {
        body: { query: 'trending music 2024', maxResults: 12 },
      });
      if (response.data?.items) {
        setTrendingTracks(response.data.items.map((item: any) => ({
          id: item.id.videoId,
          videoId: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        })));
      }
    } catch (error) {
      console.error('Failed to load trending:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await supabase.functions.invoke('youtube-search', {
        body: { query: searchQuery, maxResults: 16 },
      });
      if (response.data?.items) {
        setSearchResults(response.data.items.map((item: any) => ({
          id: item.id.videoId,
          videoId: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        })));
      }
    } catch (error) {
      console.error('YouTube search failed:', error);
      toast({ title: "Search failed", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handlePlayUrl = () => {
    const videoId = extractVideoId(youtubeUrl);
    if (videoId) {
      playVideo({ id: videoId, videoId, title: "YouTube Video", channelTitle: "", thumbnail: "" });
    } else {
      toast({ title: "Invalid URL", description: "Please enter a valid YouTube URL", variant: "destructive" });
    }
  };

  const playVideo = (track: YouTubeTrack) => {
    setActiveVideoId(track.videoId);
    unifiedAudio.playYouTubeVideo(track.videoId, track.title);
    
    // Add to recently watched
    const updated = [track, ...recentlyWatched.filter(t => t.videoId !== track.videoId)].slice(0, 8);
    setRecentlyWatched(updated);
    localStorage.setItem('youtube_recently_watched', JSON.stringify(updated));
  };

  const VideoCard = ({ track, size = "normal" }: { track: YouTubeTrack; size?: "normal" | "large" }) => (
    <div
      className={`group cursor-pointer transition-all ${
        size === "large" ? "col-span-2 row-span-2" : ""
      }`}
      onClick={() => playVideo(track)}
    >
      <div className={`relative rounded-lg overflow-hidden bg-card/40 ${
        activeVideoId === track.videoId ? 'ring-2 ring-red-500' : ''
      }`}>
        <div className="aspect-video relative">
          {track.thumbnail ? (
            <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-red-500/20 flex items-center justify-center">
              <YouTubeIcon />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
            {activeVideoId === track.videoId ? (
              <Volume2 className="h-8 w-8 text-white animate-pulse" />
            ) : (
              <Play className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <h3 className={`font-semibold text-white truncate ${size === "large" ? "text-base" : "text-sm"}`}>
              {track.title}
            </h3>
            <p className="text-xs text-white/70 truncate">{track.channelTitle}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-red-500/20 flex items-center justify-center">
            <YouTubeIcon />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">YouTube Music</h1>
            <p className="text-muted-foreground text-sm">Search and play videos</p>
          </div>
        </div>

        {/* Search & URL Input */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2 flex-1">
            <Input
              placeholder="Search YouTube..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 h-11 bg-secondary/30 border-border/50"
            />
            <Button onClick={handleSearch} disabled={isSearching} className="bg-red-600 hover:bg-red-700 h-11">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Paste YouTube URL..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePlayUrl()}
              className="w-full sm:w-64 h-11 bg-secondary/30 border-border/50"
            />
            <Button onClick={handlePlayUrl} disabled={!youtubeUrl.trim()} variant="outline" className="h-11 border-red-500/30 text-red-500 hover:bg-red-500/10">
              <Play className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active Video Player */}
      {activeVideoId && (
        <div className="rounded-xl overflow-hidden border border-red-500/30 bg-black shadow-2xl">
          <div className="aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-bold">Search Results</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {searchResults.map((track) => (
              <VideoCard key={track.id} track={track} />
            ))}
          </div>
        </section>
      )}

      {/* Recently Watched */}
      {recentlyWatched.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-bold">Recently Watched</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {recentlyWatched.map((track) => (
              <VideoCard key={track.id} track={track} />
            ))}
          </div>
        </section>
      )}

      {/* Trending */}
      {trendingTracks.length > 0 && !searchResults.length && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-bold">Trending Music</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {trendingTracks.map((track, idx) => (
              <VideoCard key={track.id} track={track} size={idx === 0 ? "large" : "normal"} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
