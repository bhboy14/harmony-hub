import { Button } from "@/components/ui/button";
import { RecentlyPlayed } from "./RecentlyPlayed";

// Define generic interface for data to avoid type errors
interface SpotifyData {
  id: string;
  name: string;
  artist: string;
  image?: string;
  albumArt?: string;
  playedAt?: string;
}

interface HomeContentProps {
  recentTracks?: SpotifyData[]; // Use the generic type
  topMixes?: SpotifyData[];
}

export function HomeContent({ recentTracks = [], topMixes = [] }: HomeContentProps) {
  return (
    // MAIN CONTAINER
    // flex-1: Fills the remaining space between sidebars
    // h-full: Takes full height
    // overflow-y-auto: Enables VERTICAL scrolling for this section only
    // min-w-0: Prevents the content from pushing the sidebars off-screen
    <div className="flex-1 h-full overflow-y-auto bg-black/95 p-6 min-w-0">
      {/* HERO / CTA SECTION */}
      <div className="mb-8 rounded-xl bg-gradient-to-br from-green-900/50 to-black p-8 text-center border border-white/10">
        <h1 className="mb-2 text-3xl font-bold text-white">Connect to Spotify</h1>
        <p className="mb-6 text-gray-400">Link your Spotify account to see your playlists and play music</p>
        <Button className="rounded-full bg-[#1DB954] px-8 py-6 text-lg font-bold text-black hover:bg-[#1ed760]">
          Connect Spotify
        </Button>
      </div>

      {/* SECTIONS WRAPPER */}
      <div className="space-y-10">
        {/* RECENTLY PLAYED SECTION */}
        {/* The RecentlyPlayed component already contains the Grid logic */}
        <section>
          <RecentlyPlayed
            recentTracks={recentTracks.map((track) => ({
              id: track.id,
              title: track.name || "Unknown Title",
              artist: track.artist,
              coverUrl: track.image || track.albumArt || "/placeholder.svg",
              playedAt: track.playedAt,
            }))}
          />
        </section>

        {/* TOP MIXES SECTION */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold tracking-tight text-white">Your top mixes</h2>
            <span className="text-xs font-bold tracking-widest text-gray-400 uppercase hover:underline cursor-pointer">
              Show All
            </span>
          </div>

          {/* GRID LAYOUT for Mixes */}
          {/* This ensures items wrap to the next line instead of stretching sideways */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-6">
            {topMixes.length > 0
              ? topMixes.map((mix) => (
                  <div
                    key={mix.id}
                    className="group relative rounded-md bg-[#181818] p-4 transition-all duration-300 hover:bg-[#282828] cursor-pointer"
                  >
                    <div className="relative mb-4 aspect-square overflow-hidden rounded-md shadow-lg">
                      <img
                        src={
                          mix.image ||
                          mix.albumArt ||
                          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop"
                        }
                        alt={mix.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <h3 className="mb-1 truncate font-bold text-white">{mix.name}</h3>
                    <p className="line-clamp-2 text-sm text-gray-400">{mix.artist}</p>
                  </div>
                ))
              : // Placeholder items if no data
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-[260px] rounded-md bg-[#181818] animate-pulse" />
                ))}
          </div>
        </section>
      </div>

      {/* Spacer for bottom player bar */}
      <div className="h-24" />
    </div>
  );
}
