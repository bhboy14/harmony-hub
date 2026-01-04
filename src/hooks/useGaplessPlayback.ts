import { useRef, useCallback, useEffect } from "react";
import { QueueTrack } from "./useUnifiedQueue";

const PREFETCH_THRESHOLD_MS = 10000; // Start prefetch when 10s remaining

interface GaplessPlaybackOptions {
  currentTrack: QueueTrack | null;
  nextTrack: QueueTrack | null;
  progress: number;
  duration: number;
  isPlaying: boolean;
  activeSource: string | null;
  onNextReady: (audioElement: HTMLAudioElement) => void;
}

export const useGaplessPlayback = ({
  currentTrack,
  nextTrack,
  progress,
  duration,
  isPlaying,
  activeSource,
  onNextReady,
}: GaplessPlaybackOptions) => {
  const prefetchAudioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchedTrackIdRef = useRef<string | null>(null);
  const isPrefetchingRef = useRef(false);

  // Initialize prefetch audio element
  useEffect(() => {
    if (!prefetchAudioRef.current) {
      prefetchAudioRef.current = new Audio();
      prefetchAudioRef.current.preload = 'auto';
      prefetchAudioRef.current.volume = 0; // Silent until swap
    }

    return () => {
      if (prefetchAudioRef.current) {
        prefetchAudioRef.current.pause();
        prefetchAudioRef.current.src = '';
        prefetchAudioRef.current = null;
      }
    };
  }, []);

  // Calculate remaining time
  const remainingMs = duration - progress;
  const shouldPrefetch = 
    isPlaying && 
    duration > 0 && 
    remainingMs <= PREFETCH_THRESHOLD_MS && 
    remainingMs > 0 &&
    nextTrack &&
    (activeSource === 'local' || activeSource === 'soundcloud');

  // Prefetch next track when threshold is reached
  useEffect(() => {
    if (!shouldPrefetch || !nextTrack || !prefetchAudioRef.current) return;
    
    // Only prefetch local/soundcloud tracks (ones with direct URLs)
    if (nextTrack.source !== 'local' && nextTrack.source !== 'soundcloud') return;
    
    // Don't re-prefetch the same track
    if (prefetchedTrackIdRef.current === nextTrack.queueId) return;
    
    // Don't start if already prefetching
    if (isPrefetchingRef.current) return;

    const prefetchNext = async () => {
      if (!nextTrack.url || !prefetchAudioRef.current) return;
      
      isPrefetchingRef.current = true;
      prefetchedTrackIdRef.current = nextTrack.queueId;
      
      console.log('[Gapless] Prefetching next track:', nextTrack.title);
      
      const audio = prefetchAudioRef.current;
      
      // Set up the audio element
      audio.src = nextTrack.url;
      audio.currentTime = 0;
      
      // Wait for it to be ready to play
      audio.load();
      
      const handleCanPlayThrough = () => {
        console.log('[Gapless] Next track buffered and ready:', nextTrack.title);
        isPrefetchingRef.current = false;
        onNextReady(audio);
        audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        audio.removeEventListener('error', handleError);
      };
      
      const handleError = () => {
        console.warn('[Gapless] Failed to prefetch:', nextTrack.title);
        isPrefetchingRef.current = false;
        prefetchedTrackIdRef.current = null;
        audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        audio.removeEventListener('error', handleError);
      };
      
      audio.addEventListener('canplaythrough', handleCanPlayThrough);
      audio.addEventListener('error', handleError);
    };

    prefetchNext();
  }, [shouldPrefetch, nextTrack, onNextReady]);

  // Reset when current track changes
  useEffect(() => {
    if (currentTrack) {
      // Only reset if the new track isn't the one we prefetched
      if (prefetchedTrackIdRef.current !== currentTrack.queueId) {
        prefetchedTrackIdRef.current = null;
        isPrefetchingRef.current = false;
      }
    }
  }, [currentTrack?.queueId]);

  // Swap to prefetched audio element for gapless transition
  const swapToPrefetched = useCallback((targetVolume: number): HTMLAudioElement | null => {
    if (!prefetchAudioRef.current || !prefetchedTrackIdRef.current) {
      return null;
    }
    
    const audio = prefetchAudioRef.current;
    audio.volume = targetVolume;
    
    console.log('[Gapless] Swapping to prefetched audio');
    
    // Create a new prefetch element for the next-next track
    prefetchAudioRef.current = new Audio();
    prefetchAudioRef.current.preload = 'auto';
    prefetchAudioRef.current.volume = 0;
    
    prefetchedTrackIdRef.current = null;
    isPrefetchingRef.current = false;
    
    return audio;
  }, []);

  const getPrefetchedAudio = useCallback((): HTMLAudioElement | null => {
    return prefetchAudioRef.current;
  }, []);

  const isPrefetched = useCallback((trackQueueId: string): boolean => {
    return prefetchedTrackIdRef.current === trackQueueId;
  }, []);

  return {
    swapToPrefetched,
    getPrefetchedAudio,
    isPrefetched,
    isPrefetching: isPrefetchingRef.current,
    prefetchedTrackId: prefetchedTrackIdRef.current,
  };
};
