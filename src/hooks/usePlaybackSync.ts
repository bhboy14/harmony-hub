import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RealtimeChannel } from "@supabase/supabase-js";
import type { AudioSource, UnifiedTrack } from "@/contexts/UnifiedAudioContext";

interface SyncState {
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  trackId: string | null;
  trackTitle: string | null;
  trackArtist: string | null;
  trackAlbumArt: string | null;
  activeSource: AudioSource;
  lastAction: 'play' | 'pause' | 'seek' | 'track_change' | null;
  updatedAt: Date;
}

interface UsePlaybackSyncOptions {
  enabled?: boolean;
  onRemoteStateChange?: (state: SyncState, action: string) => void;
}

// Generate a unique session ID for this browser tab
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('playback_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('playback_session_id', sessionId);
  }
  return sessionId;
};

export const usePlaybackSync = (options: UsePlaybackSyncOptions = {}) => {
  const { enabled = true, onRemoteStateChange } = options;
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [connectedDevices, setConnectedDevices] = useState(0);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const sessionId = useRef(getSessionId());
  const ignoreNextUpdateRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Broadcast state change to all connected devices
  const broadcastState = useCallback(async (
    isPlaying: boolean,
    progressMs: number,
    durationMs: number,
    track: UnifiedTrack | null,
    activeSource: AudioSource,
    action: 'play' | 'pause' | 'seek' | 'track_change'
  ) => {
    if (!enabled || !user) return;

    // Debounce rapid updates (especially seek)
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        ignoreNextUpdateRef.current = true;
        
        const syncData = {
          session_id: sessionId.current,
          user_id: user.id,
          is_playing: isPlaying,
          progress_ms: progressMs,
          duration_ms: durationMs,
          track_id: track?.id || null,
          track_title: track?.title || null,
          track_artist: track?.artist || null,
          track_album_art: track?.albumArt || null,
          active_source: activeSource,
          last_action: action,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('playback_sync')
          .upsert(syncData, { onConflict: 'session_id' });

        if (error) {
          console.error('[PlaybackSync] Error broadcasting state:', error);
        } else {
          setLastSyncTime(new Date());
        }
      } catch (err) {
        console.error('[PlaybackSync] Error:', err);
      }
    }, action === 'seek' ? 200 : 50); // Longer debounce for seek
  }, [enabled, user]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!enabled || !user) return;

    const channel = supabase
      .channel(`playback_sync_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playback_sync',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Ignore our own updates
          if ((payload.new as any)?.session_id === sessionId.current) {
            return;
          }

          // Ignore if we just sent an update (to prevent echo)
          if (ignoreNextUpdateRef.current) {
            ignoreNextUpdateRef.current = false;
            return;
          }

          const data = payload.new as any;
          if (data && onRemoteStateChange) {
            const state: SyncState = {
              isPlaying: data.is_playing,
              progressMs: data.progress_ms,
              durationMs: data.duration_ms,
              trackId: data.track_id,
              trackTitle: data.track_title,
              trackArtist: data.track_artist,
              trackAlbumArt: data.track_album_art,
              activeSource: data.active_source as AudioSource,
              lastAction: data.last_action,
              updatedAt: new Date(data.updated_at),
            };
            
            console.log('[PlaybackSync] Remote state change:', data.last_action, state);
            onRemoteStateChange(state, data.last_action);
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setConnectedDevices(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsSyncing(true);
          await channel.track({ session_id: sessionId.current, user_id: user.id });
          console.log('[PlaybackSync] Subscribed to realtime sync');
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setIsSyncing(false);
    };
  }, [enabled, user, onRemoteStateChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    isSyncing,
    lastSyncTime,
    connectedDevices,
    sessionId: sessionId.current,
    broadcastState,
  };
};
