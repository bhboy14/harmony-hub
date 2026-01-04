import { useState, useEffect } from "react";
import { X, Music, Users, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Artist } from "@/hooks/useMasterTracks";

interface ArtistProfileProps {
  artist: Artist | null;
  isLoading?: boolean;
  onClose: () => void;
  onPlayTrack?: (trackUri: string) => void;
}

export const ArtistProfile = ({ artist, isLoading, onClose, onPlayTrack }: ArtistProfileProps) => {
  if (!artist && !isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-background border-l border-border shadow-xl">
        {/* Header with banner */}
        <div className="relative h-48 overflow-hidden">
          {artist?.bannerUrl ? (
            <img 
              src={artist.bannerUrl} 
              alt={artist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary" />
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 bg-background/50 backdrop-blur-sm hover:bg-background/80"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
          
          {/* Artist info overlay */}
          <div className="absolute bottom-4 left-6 right-6 flex items-end gap-4">
            {artist?.profileImage && (
              <img 
                src={artist.profileImage} 
                alt={artist.name}
                className="w-24 h-24 rounded-full border-4 border-background shadow-lg"
              />
            )}
            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-3xl font-bold text-foreground drop-shadow-lg truncate">
                {isLoading ? 'Loading...' : artist?.name}
              </h2>
              {artist && (
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  {artist.followers !== null && (
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {artist.followers.toLocaleString()} followers
                    </span>
                  )}
                  {artist.popularity !== null && (
                    <span>Popularity: {artist.popularity}%</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-12rem)]">
          <div className="p-6 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : artist ? (
              <>
                {/* Genres */}
                {artist.genres.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      Genres
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {artist.genres.map((genre, idx) => (
                        <Badge key={idx} variant="secondary" className="capitalize">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Biography */}
                {artist.biography && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      About
                    </h3>
                    <p className="text-foreground/80 leading-relaxed">
                      {artist.biography}
                    </p>
                  </div>
                )}

                {/* Spotify Link */}
                {artist.spotifyId && (
                  <div>
                    <a
                      href={`https://open.spotify.com/artist/${artist.spotifyId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[#1DB954] hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View on Spotify
                    </a>
                  </div>
                )}

                {/* Placeholder for top tracks - would need additional API call */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    In Your Library
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Tracks from this artist will be shown here when you have them in your library.
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Artist not found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
