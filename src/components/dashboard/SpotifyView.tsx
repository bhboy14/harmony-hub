import { Play, Music, TrendingUp, Clock, Disc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpotify } from "@/contexts/SpotifyContext";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

export const SpotifyView = () => {
  const spotify = useSpotify();

  if (!spotify.isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md space-y-6">
          <div className="h-20 w-20 mx-auto bg-[#1DB954] rounded-full flex items-center justify-center">
            <SpotifyIcon />
          </div>
          <h2 className="text-3xl font-bold">Connect to Spotify</h2>
          <p className="text-muted-foreground">
            Link your Spotify account to access your playlists, daily mixes, and control playback.
          </p>
          <Button 
            onClick={spotify.connect} 
            size="lg"
            className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold rounded-full px-8"
          >
            Connect Spotify
          </Button>
        </div>
      </div>
    );
  }

  const playlists = spotify.playlists || [];
  const recentlyPlayed = spotify.recentlyPlayed || [];
  const madeForYou = playlists.filter((p: any) => 
    p.name?.toLowerCase().includes("mix") ||
    p.name?.toLowerCase().includes("daily") ||
    p.name?.toLowerCase().includes("discover")
  ).slice(0, 6);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">{greeting()}</h1>
        <div className="flex items-center gap-2 text-[#1DB954]">
          <SpotifyIcon />
          <span className="text-sm font-medium">Spotify Connected</span>
        </div>
      </div>

      {/* Quick Play Grid */}
      {playlists.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {playlists.slice(0, 8).map((playlist: any) => (
            <div
              key={playlist.id}
              className="group flex items-center gap-3 bg-card/60 hover:bg-card rounded-lg overflow-hidden cursor-pointer transition-all"
              onClick={() => spotify.play(playlist.uri)}
            >
              <div className="w-16 h-16 flex-shrink-0 bg-secondary">
                {playlist.images?.[0]?.url ? (
                  <img src={playlist.images[0].url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <span className="font-semibold text-sm truncate pr-2 flex-1">{playlist.name}</span>
              <Button 
                size="icon" 
                className="h-10 w-10 rounded-full bg-[#1DB954] text-black opacity-0 group-hover:opacity-100 mr-2 shadow-lg transition-all hover:scale-105"
              >
                <Play className="h-5 w-5 fill-current ml-0.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Made For You */}
      {madeForYou.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#1DB954]" />
            <h2 className="text-xl font-bold">Made For You</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {madeForYou.map((item: any) => (
              <div
                key={item.id}
                className="group p-4 bg-card/40 hover:bg-card/80 rounded-lg cursor-pointer transition-all"
                onClick={() => spotify.play(item.uri)}
              >
                <div className="relative aspect-square rounded-md overflow-hidden mb-3 shadow-lg">
                  {item.images?.[0]?.url ? (
                    <img src={item.images[0].url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <Music className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <Button 
                    size="icon" 
                    className="absolute bottom-2 right-2 h-10 w-10 rounded-full bg-[#1DB954] text-black opacity-0 group-hover:opacity-100 shadow-lg transition-all translate-y-2 group-hover:translate-y-0"
                  >
                    <Play className="h-5 w-5 fill-current ml-0.5" />
                  </Button>
                </div>
                <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                <p className="text-xs text-muted-foreground truncate">Mixed for you</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently Played */}
      {recentlyPlayed.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-bold">Recently Played</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {recentlyPlayed.slice(0, 12).map((item: any, idx: number) => (
              <div
                key={`${item.track?.id}-${idx}`}
                className="group p-4 bg-card/40 hover:bg-card/80 rounded-lg cursor-pointer transition-all"
                onClick={() => item.track?.uri && spotify.play(undefined, [item.track.uri])}
              >
                <div className="relative aspect-square rounded-md overflow-hidden mb-3 shadow-lg">
                  {item.track?.album?.images?.[0]?.url ? (
                    <img src={item.track.album.images[0].url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <Disc className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <Button 
                    size="icon" 
                    className="absolute bottom-2 right-2 h-10 w-10 rounded-full bg-[#1DB954] text-black opacity-0 group-hover:opacity-100 shadow-lg transition-all translate-y-2 group-hover:translate-y-0"
                  >
                    <Play className="h-5 w-5 fill-current ml-0.5" />
                  </Button>
                </div>
                <h3 className="font-semibold text-sm truncate">{item.track?.name}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {item.track?.artists?.map((a: any) => a.name).join(", ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All Playlists */}
      {playlists.length > 8 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Your Playlists</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {playlists.slice(8).map((item: any) => (
              <div
                key={item.id}
                className="group p-4 bg-card/40 hover:bg-card/80 rounded-lg cursor-pointer transition-all"
                onClick={() => spotify.play(item.uri)}
              >
                <div className="relative aspect-square rounded-md overflow-hidden mb-3 shadow-lg">
                  {item.images?.[0]?.url ? (
                    <img src={item.images[0].url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <Music className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <Button 
                    size="icon" 
                    className="absolute bottom-2 right-2 h-10 w-10 rounded-full bg-[#1DB954] text-black opacity-0 group-hover:opacity-100 shadow-lg transition-all translate-y-2 group-hover:translate-y-0"
                  >
                    <Play className="h-5 w-5 fill-current ml-0.5" />
                  </Button>
                </div>
                <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                <p className="text-xs text-muted-foreground">{item.tracks?.total || 0} tracks</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
