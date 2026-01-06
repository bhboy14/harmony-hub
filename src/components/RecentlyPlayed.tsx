import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

// Interface matching your data structure
interface Track {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  playedAt?: string;
}

// Mock data to ensure the component renders immediately
const MOCK_RECENT_TRACKS: Track[] = [
  {
    id: "1",
    title: "Unravel",
    artist: "Issam Alnajjar",
    coverUrl: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&h=300&fit=crop",
    playedAt: "10:00",
  },
  {
    id: "2",
    title: "Daily Mix 1",
    artist: "Made for you",
    coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
    playedAt: "11:00",
  },
  {
    id: "3",
    title: "Top Hits",
    artist: "Global",
    coverUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
    playedAt: "12:00",
  },
  {
    id: "4",
    title: "Prayer Times",
    artist: "Daily",
    coverUrl: "https://images.unsplash.com/photo-1519638399535-1b036603ac77?w=300&h=300&fit=crop",
    playedAt: "13:00",
  },
];

interface RecentlyPlayedProps {
  recentTracks?: Track[];
}

export function RecentlyPlayed({ recentTracks = MOCK_RECENT_TRACKS }: RecentlyPlayedProps) {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Recently Played</h2>
      </div>
      /* Changed scrollbar-hide to no-scrollbar to match your index.css */
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 max-h-[500px] overflow-y-auto no-scrollbar">
        {recentTracks.slice(0, 12).map((track) => (
          <Card
            // Fixed: Props are now correctly placed inside the Card component
            key={`${track.id}-${track.playedAt || "default"}`}
            className="spotify-card group cursor-pointer relative overflow-hidden border-0 bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
          >
            <CardContent className="p-4">
              <div className="relative aspect-square overflow-hidden rounded-md">
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute bottom-2 right-2 translate-y-1/4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-black shadow-lg hover:scale-105">
                    <Play className="h-5 w-5 fill-current ml-1" />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-start p-4 pt-0">
              <h3 className="font-semibold text-foreground truncate w-full">{track.title}</h3>
              <p className="text-sm text-muted-foreground truncate w-full">{track.artist}</p>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
