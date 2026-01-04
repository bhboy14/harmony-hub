import { useEffect } from "react";
import { useSoundCloud } from "@/contexts/SoundCloudContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Music2,
  Play,
  Pause,
  Volume2,
  LogOut,
  Loader2,
  ListMusic,
  Lock,
  Heart,
} from "lucide-react";

// SoundCloud brand icon
const SoundCloudIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.09-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.165 1.308c.014.057.044.09.09.09.043 0 .073-.033.085-.09l.184-1.308-.175-1.332c-.009-.052-.04-.09-.09-.09m1.83-1.229c-.061 0-.12.045-.12.104l-.21 2.563.225 2.458c0 .06.045.09.104.09.061 0 .104-.045.12-.09l.239-2.458-.239-2.563c-.016-.06-.061-.104-.119-.104m.945-.089c-.075 0-.135.061-.15.135l-.193 2.64.21 2.544c.016.077.075.138.149.138.075 0 .135-.061.15-.138l.24-2.544-.24-2.64c-.015-.074-.074-.135-.149-.135l-.017.0m1.155.36c-.005-.09-.075-.149-.159-.149-.09 0-.158.06-.164.149l-.217 2.43.2 2.563c0 .09.074.15.164.15.09 0 .164-.06.164-.15l.226-2.563-.214-2.43m.809-1.709c-.09 0-.18.075-.18.18l-.2 3.96.2 2.624c0 .105.09.18.18.18s.165-.075.18-.18l.2-2.624-.2-3.96c-.015-.105-.09-.18-.18-.18m.871-.449c-.104 0-.194.09-.194.195l-.18 4.23.18 2.67c0 .12.09.21.194.21.105 0 .195-.09.195-.21l.21-2.67-.21-4.23c0-.105-.09-.195-.195-.195m.88-.45c-.12 0-.211.104-.211.227l-.165 4.5.165 2.685c0 .135.09.225.21.225.12 0 .212-.09.227-.225l.18-2.685-.18-4.5c-.015-.12-.105-.227-.227-.227m.897-.39c-.135 0-.239.105-.239.24l-.149 4.62.149 2.684c.015.135.104.24.24.24.119 0 .224-.105.239-.24l.164-2.684-.164-4.62c-.015-.135-.12-.24-.24-.24m1.154.24c-.15 0-.27.135-.27.271l-.122 4.14.136 2.695c0 .15.12.27.256.27.15 0 .27-.12.285-.27l.151-2.695-.151-4.14c-.014-.136-.135-.271-.285-.271m.88-.269c-.165 0-.285.135-.285.3l-.12 4.11.12 2.7c.015.165.12.285.285.285.165 0 .285-.12.3-.285l.135-2.7-.135-4.11c-.015-.165-.135-.3-.3-.3m2.175-1.035c-.045-.015-.09-.015-.135-.015-.165 0-.315.135-.33.315l-.105 5.16.105 2.73c.015.18.165.315.33.315.165 0 .315-.135.33-.315l.12-2.73-.12-5.16c-.015-.18-.165-.315-.33-.315-.045 0-.09 0-.135.015-.06.015.06-.015 0 0m.87-.57c-.195 0-.345.15-.345.36l-.09 5.37.105 2.715c.015.21.15.36.33.36.195 0 .36-.15.36-.36l.12-2.715-.12-5.37c0-.21-.165-.36-.36-.36m.885-.135c-.21 0-.375.165-.375.39l-.075 5.265.09 2.73c.015.225.165.39.375.39.21 0 .375-.165.39-.39l.105-2.73-.105-5.265c-.015-.225-.18-.39-.39-.39m.89.135c-.21 0-.39.18-.39.405l-.075 4.935.09 2.73c.015.24.18.405.375.405.225 0 .405-.165.405-.405l.105-2.73-.105-4.935c0-.225-.18-.405-.405-.405m1.095-.405c-.045-.015-.09-.015-.135-.015-.225 0-.405.195-.405.435l-.06 5.1.075 2.73c0 .24.18.435.42.435.225 0 .42-.195.435-.435l.09-2.73-.09-5.1c0-.24-.195-.435-.435-.435 0 0-.045 0-.09-.015l.195.03m.88-.195c-.24 0-.435.21-.435.465l-.045 5.085.06 2.745c.015.255.195.45.435.45.24 0 .435-.195.45-.45l.075-2.745-.075-5.085c-.015-.255-.21-.465-.45-.465m1.095.135c-.24 0-.45.225-.465.48l-.03 4.53.03 2.745c.015.27.225.48.465.48s.45-.21.465-.48l.045-2.745-.045-4.53c-.015-.255-.225-.48-.465-.48m1.5.465c-.075-.27-.315-.45-.57-.45-.255 0-.495.18-.555.45l-.03 4.11.045 2.73c.06.3.3.495.54.495.255 0 .495-.195.555-.495l.045-2.73-.045-4.11m3.09.495c-.105-.03-.21-.045-.315-.045-.54 0-1.005.36-1.17.855-.165-.03-.345-.045-.525-.045-1.53 0-2.775 1.26-2.775 2.805 0 1.545 1.245 2.805 2.775 2.805h4.095c.885 0 1.605-.735 1.605-1.635V12.7c0-2.655-2.085-4.815-4.665-4.965"/>
  </svg>
);

export const SoundCloudPlayer = () => {
  const {
    isConnected,
    isLoading,
    user,
    playlists,
    likedTracks,
    currentTrack,
    isPlaying,
    progress,
    volume,
    connect,
    disconnect,
    play,
    pause,
    resume,
    setVolume,
    loadPlaylists,
    loadLikedTracks,
  } = useSoundCloud();

  const { hasPermission } = useAuth();
  const canControl = hasPermission("dj");

  useEffect(() => {
    if (isConnected) {
      loadPlaylists();
      loadLikedTracks();
    }
  }, [isConnected, loadPlaylists, loadLikedTracks]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getArtwork = (url: string | null, size = "large") => {
    if (!url) return null;
    return url.replace("-large", `-${size}`);
  };

  if (!isConnected) {
    return (
      <Card className="glass-panel">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#FF5500]/20 flex items-center justify-center mx-auto mb-4">
            <SoundCloudIcon />
          </div>
          <h3 className="text-xl font-semibold mb-2">Connect SoundCloud</h3>
          <p className="text-muted-foreground mb-6">
            Link your SoundCloud account to stream music and access your playlists
          </p>
          <Button
            onClick={connect}
            disabled={isLoading}
            className="bg-[#FF5500] hover:bg-[#FF6600] text-white font-semibold"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <SoundCloudIcon />
            )}
            Connect with SoundCloud
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="text-[#FF5500]">
              <SoundCloudIcon />
            </div>
            SoundCloud Player
            {user && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                @{user.username}
              </span>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={disconnect}>
            <LogOut className="h-4 w-4 mr-1" />
            Disconnect
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden space-y-4">
        {/* Now Playing */}
        {currentTrack ? (
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#FF5500]/20 to-primary/10 border border-[#FF5500]/30">
            <div className="flex gap-4">
              {currentTrack.artwork_url && (
                <img
                  src={getArtwork(currentTrack.artwork_url, "t300x300") || ""}
                  alt="Artwork"
                  className="w-20 h-20 rounded-lg shadow-lg object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg truncate">{currentTrack.title}</p>
                <p className="text-muted-foreground truncate">
                  {currentTrack.user.username}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 space-y-1">
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FF5500] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime((progress / 100) * currentTrack.duration)}</span>
                <span>{formatTime(currentTrack.duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <Button
                variant="glow"
                size="lg"
                className="bg-[#FF5500] hover:bg-[#FF6600] text-white disabled:opacity-50"
                onClick={() => (isPlaying ? pause() : resume())}
                disabled={!canControl}
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </Button>
            </div>
            {!canControl && (
              <p className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" /> Only DJs and Admins can control playback
              </p>
            )}

            {/* Volume */}
            <div className="flex items-center gap-3 mt-4">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[volume]}
                max={100}
                step={1}
                onValueChange={([v]) => setVolume(v)}
                className="flex-1"
                disabled={!canControl}
              />
              <span className="text-xs text-muted-foreground w-8">{volume}%</span>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-secondary/30 text-center">
            <Music2 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No track playing</p>
            <p className="text-xs text-muted-foreground mt-1">
              Select a track from your library
            </p>
          </div>
        )}

        {/* Playlists & Likes */}
        <Tabs defaultValue="playlists" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full">
            <TabsTrigger value="playlists" className="flex-1">
              Playlists
            </TabsTrigger>
            <TabsTrigger value="likes" className="flex-1">
              Liked Tracks
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-2">
            <TabsContent value="playlists" className="m-0">
              <div className="space-y-2">
                {playlists.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No playlists found</p>
                ) : (
                  playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className="w-full flex items-center gap-3 p-2 rounded-lg bg-secondary/30"
                    >
                      {playlist.artwork_url ? (
                        <img
                          src={getArtwork(playlist.artwork_url, "t67x67") || ""}
                          alt=""
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                          <ListMusic className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium truncate">{playlist.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {playlist.track_count} tracks
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
            <TabsContent value="likes" className="m-0">
              <div className="space-y-2">
                {likedTracks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No liked tracks found</p>
                ) : (
                  likedTracks.slice(0, 20).map((track) => (
                    <button
                      key={track.id}
                      onClick={() => canControl && play(track)}
                      disabled={!canControl}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all ${
                        !canControl ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {track.artwork_url ? (
                        <img
                          src={getArtwork(track.artwork_url, "t67x67") || ""}
                          alt=""
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                          <Music2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium truncate">{track.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {track.user.username}
                        </p>
                      </div>
                      <Heart className="h-4 w-4 text-[#FF5500]" />
                    </button>
                  ))
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
};
