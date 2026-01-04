-- Master Tracks table to group tracks across platforms
CREATE TABLE public.master_tracks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  canonical_title text NOT NULL,
  canonical_artist text,
  primary_album_art text,
  genre text,
  decade text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.master_tracks ENABLE ROW LEVEL SECURITY;

-- RLS policies for master_tracks
CREATE POLICY "Users can view own master tracks"
ON public.master_tracks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own master tracks"
ON public.master_tracks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own master tracks"
ON public.master_tracks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own master tracks"
ON public.master_tracks FOR DELETE
USING (auth.uid() = user_id);

-- Add master_track_id to tracks table
ALTER TABLE public.tracks 
ADD COLUMN master_track_id uuid REFERENCES public.master_tracks(id) ON DELETE SET NULL;

-- Artist Profiles table
CREATE TABLE public.artists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  spotify_id text UNIQUE,
  biography text,
  banner_url text,
  profile_image text,
  genres text[],
  popularity integer,
  followers integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Artists are shared across users (public read)
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view artists"
ON public.artists FOR SELECT
USING (true);

-- Only authenticated users can insert/update artists
CREATE POLICY "Authenticated users can insert artists"
ON public.artists FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update artists"
ON public.artists FOR UPDATE
USING (auth.role() = 'authenticated');

-- Trigger for updated_at on master_tracks
CREATE TRIGGER update_master_tracks_updated_at
BEFORE UPDATE ON public.master_tracks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Trigger for updated_at on artists
CREATE TRIGGER update_artists_updated_at
BEFORE UPDATE ON public.artists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();