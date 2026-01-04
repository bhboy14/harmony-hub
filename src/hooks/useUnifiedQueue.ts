import { useState, useCallback } from "react";
import { AudioSource } from "@/contexts/UnifiedAudioContext";

export interface QueueTrack {
  id: string;
  queueId: string; // Unique ID for queue position
  title: string;
  artist: string;
  albumArt?: string;
  duration: number; // in ms
  source: AudioSource;
  // Source-specific data
  externalId?: string;
  url?: string;
  fileHandle?: any;
}

export const useUnifiedQueue = () => {
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [history, setHistory] = useState<QueueTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');

  const generateQueueId = () => `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addToQueue = useCallback((track: Omit<QueueTrack, 'queueId'>) => {
    const queueTrack: QueueTrack = {
      ...track,
      queueId: generateQueueId(),
    };
    setQueue(prev => [...prev, queueTrack]);
    return queueTrack;
  }, []);

  const addMultipleToQueue = useCallback((tracks: Omit<QueueTrack, 'queueId'>[]) => {
    const queueTracks: QueueTrack[] = tracks.map(track => ({
      ...track,
      queueId: generateQueueId(),
    }));
    setQueue(prev => [...prev, ...queueTracks]);
    return queueTracks;
  }, []);

  const playNext = useCallback((track: Omit<QueueTrack, 'queueId'>) => {
    const queueTrack: QueueTrack = {
      ...track,
      queueId: generateQueueId(),
    };
    setQueue(prev => {
      const newQueue = [...prev];
      newQueue.splice(currentIndex + 1, 0, queueTrack);
      return newQueue;
    });
    return queueTrack;
  }, [currentIndex]);

  const removeFromQueue = useCallback((queueId: string) => {
    setQueue(prev => {
      const index = prev.findIndex(t => t.queueId === queueId);
      if (index === -1) return prev;
      
      const newQueue = prev.filter(t => t.queueId !== queueId);
      
      // Adjust current index if needed
      if (index < currentIndex) {
        setCurrentIndex(i => i - 1);
      } else if (index === currentIndex && newQueue.length > 0) {
        // If removing current track, don't change index (next track slides in)
      }
      
      return newQueue;
    });
  }, [currentIndex]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentIndex(-1);
    setHistory([]);
  }, []);

  const clearUpcoming = useCallback(() => {
    setQueue(prev => prev.slice(0, currentIndex + 1));
  }, [currentIndex]);

  const moveInQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue(prev => {
      const newQueue = [...prev];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      
      // Adjust current index if needed
      if (fromIndex === currentIndex) {
        setCurrentIndex(toIndex);
      } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
        setCurrentIndex(i => i - 1);
      } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
        setCurrentIndex(i => i + 1);
      }
      
      return newQueue;
    });
  }, [currentIndex]);

  const playTrackAtIndex = useCallback((index: number) => {
    if (index >= 0 && index < queue.length) {
      // Add current to history
      if (currentIndex >= 0 && queue[currentIndex]) {
        setHistory(prev => [...prev, queue[currentIndex]]);
      }
      setCurrentIndex(index);
      return queue[index];
    }
    return null;
  }, [queue, currentIndex]);

  const getNextTrack = useCallback((): QueueTrack | null => {
    if (queue.length === 0) return null;

    if (repeat === 'one') {
      return queue[currentIndex] || null;
    }

    let nextIndex = currentIndex + 1;

    if (shuffle) {
      // Get remaining tracks after current
      const remainingIndices = queue
        .map((_, i) => i)
        .filter(i => i > currentIndex);
      
      if (remainingIndices.length > 0) {
        nextIndex = remainingIndices[Math.floor(Math.random() * remainingIndices.length)];
      } else if (repeat === 'all') {
        nextIndex = Math.floor(Math.random() * queue.length);
      } else {
        return null;
      }
    } else {
      if (nextIndex >= queue.length) {
        if (repeat === 'all') {
          nextIndex = 0;
        } else {
          return null;
        }
      }
    }

    return queue[nextIndex] || null;
  }, [queue, currentIndex, shuffle, repeat]);

  const getPreviousTrack = useCallback((): QueueTrack | null => {
    // Check history first
    if (history.length > 0) {
      return history[history.length - 1];
    }

    if (queue.length === 0 || currentIndex <= 0) {
      if (repeat === 'all' && queue.length > 0) {
        return queue[queue.length - 1];
      }
      return null;
    }

    return queue[currentIndex - 1];
  }, [queue, currentIndex, history, repeat]);

  const goToNext = useCallback((): QueueTrack | null => {
    const nextTrack = getNextTrack();
    if (nextTrack) {
      // Add current to history
      if (currentIndex >= 0 && queue[currentIndex]) {
        setHistory(prev => [...prev.slice(-50), queue[currentIndex]]); // Keep last 50
      }
      
      const nextIndex = queue.findIndex(t => t.queueId === nextTrack.queueId);
      setCurrentIndex(nextIndex);
    }
    return nextTrack;
  }, [getNextTrack, queue, currentIndex]);

  const goToPrevious = useCallback((): QueueTrack | null => {
    // If history exists, pop from history
    if (history.length > 0) {
      const prevTrack = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      
      // Insert at current position
      setQueue(prev => {
        const newQueue = [...prev];
        newQueue.splice(currentIndex, 0, prevTrack);
        return newQueue;
      });
      
      return prevTrack;
    }

    // Otherwise go to previous in queue
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      return queue[currentIndex - 1];
    }

    // Wrap if repeat all
    if (repeat === 'all' && queue.length > 0) {
      setCurrentIndex(queue.length - 1);
      return queue[queue.length - 1];
    }

    return null;
  }, [history, currentIndex, queue, repeat]);

  const toggleShuffle = useCallback(() => {
    setShuffle(prev => !prev);
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeat(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const setNowPlaying = useCallback((track: Omit<QueueTrack, 'queueId'>) => {
    const queueTrack: QueueTrack = {
      ...track,
      queueId: generateQueueId(),
    };
    
    // Add to history if there's a current track
    if (currentIndex >= 0 && queue[currentIndex]) {
      setHistory(prev => [...prev.slice(-50), queue[currentIndex]]);
    }
    
    // Insert at beginning or replace
    setQueue(prev => {
      if (prev.length === 0) {
        return [queueTrack];
      }
      // Insert after current position
      const newQueue = [...prev];
      newQueue.splice(currentIndex + 1, 0, queueTrack);
      return newQueue;
    });
    
    setCurrentIndex(prev => prev + 1);
    return queueTrack;
  }, [queue, currentIndex]);

  const currentTrack = queue[currentIndex] || null;
  const upcomingTracks = queue.slice(currentIndex + 1);
  const hasNext = currentIndex < queue.length - 1 || repeat === 'all';
  const hasPrevious = currentIndex > 0 || history.length > 0 || repeat === 'all';

  return {
    queue,
    history,
    currentTrack,
    currentIndex,
    upcomingTracks,
    shuffle,
    repeat,
    hasNext,
    hasPrevious,
    addToQueue,
    addMultipleToQueue,
    playNext,
    removeFromQueue,
    clearQueue,
    clearUpcoming,
    moveInQueue,
    playTrackAtIndex,
    goToNext,
    goToPrevious,
    toggleShuffle,
    toggleRepeat,
    setNowPlaying,
  };
};

