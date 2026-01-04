-- Table to store unified music data
CREATE TABLE public.tracks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  artist text,
  album_art text,
  source text CHECK (source IN ('spotify', 'youtube', 'local')),
  external_id text, -- Spotify URI or YouTube Video ID
  local_url text,   -- Link to Supabase Storage if local
  duration_ms int,
  created_at timestamp with time zone DEFAULT now()
);

-- Table for playlists
CREATE TABLE public.playlists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  cover_art text,
  source_platform text,
  external_id text,
  created_at timestamp with time zone DEFAULT now()
);

-- Junction table for playlist tracks
CREATE TABLE public.playlist_tracks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id uuid REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE,
  position int,
  added_at timestamp with time zone DEFAULT now(),
  UNIQUE(playlist_id, track_id)
);

-- Enable RLS
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;

-- RLS policies for tracks
CREATE POLICY "Users can view own tracks" ON public.tracks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tracks" ON public.tracks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracks" ON public.tracks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracks" ON public.tracks
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for playlists
CREATE POLICY "Users can view own playlists" ON public.playlists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own playlists" ON public.playlists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own playlists" ON public.playlists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own playlists" ON public.playlists
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for playlist_tracks
CREATE POLICY "Users can view own playlist tracks" ON public.playlist_tracks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.playlists WHERE id = playlist_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert own playlist tracks" ON public.playlist_tracks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.playlists WHERE id = playlist_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete own playlist tracks" ON public.playlist_tracks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.playlists WHERE id = playlist_id AND user_id = auth.uid())
  );

-- Create storage bucket for local music files
INSERT INTO storage.buckets (id, name, public)
VALUES ('music-files', 'music-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for music files
CREATE POLICY "Users can upload own music files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'music-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own music files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'music-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public can view music files" ON storage.objects
  FOR SELECT USING (bucket_id = 'music-files');

CREATE POLICY "Users can delete own music files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'music-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );