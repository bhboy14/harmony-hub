-- Create a table to store realtime playback sync state
CREATE TABLE public.playback_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_playing BOOLEAN NOT NULL DEFAULT false,
  progress_ms BIGINT NOT NULL DEFAULT 0,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  track_id TEXT,
  track_title TEXT,
  track_artist TEXT,
  track_album_art TEXT,
  active_source TEXT,
  last_action TEXT, -- 'play', 'pause', 'seek', 'track_change'
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.playback_sync ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read/write their own sync state
CREATE POLICY "Users can manage their own playback sync"
ON public.playback_sync
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy for users to read any session (for multi-device sync)
CREATE POLICY "Users can read all playback sync"
ON public.playback_sync
FOR SELECT
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_playback_sync_user_id ON public.playback_sync(user_id);
CREATE INDEX idx_playback_sync_session_id ON public.playback_sync(session_id);

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.playback_sync;