import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export interface CachedPrayerTimes {
  times: Array<{
    name: string;
    arabicName: string;
    time: string;
  }>;
  location: {
    country: string;
    city: string;
  };
  date: string; // YYYY-MM-DD format
  cachedAt: number;
}

const PRAYER_TIMES_CACHE_KEY = 'offline_prayer_times';
const OFFLINE_STATUS_KEY = 'offline_mode_active';

export const useOfflineSupport = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cachedPrayerTimes, setCachedPrayerTimes] = useState<CachedPrayerTimes | null>(null);
  const { toast } = useToast();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Back Online",
        description: "Connected to the internet. Syncing data...",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Offline Mode",
        description: "Using cached data. Some features may be limited.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Load cached prayer times on mount
  useEffect(() => {
    const cached = localStorage.getItem(PRAYER_TIMES_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CachedPrayerTimes;
        setCachedPrayerTimes(parsed);
      } catch {
        // Invalid cache, ignore
      }
    }
  }, []);

  // Cache prayer times
  const cachePrayerTimes = useCallback((
    times: Array<{ name: string; arabicName: string; time: string }>,
    location: { country: string; city: string }
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const cacheData: CachedPrayerTimes = {
      times,
      location,
      date: today,
      cachedAt: Date.now(),
    };
    localStorage.setItem(PRAYER_TIMES_CACHE_KEY, JSON.stringify(cacheData));
    setCachedPrayerTimes(cacheData);
  }, []);

  // Get cached prayer times for today
  const getCachedPrayerTimes = useCallback((): CachedPrayerTimes | null => {
    const cached = localStorage.getItem(PRAYER_TIMES_CACHE_KEY);
    if (!cached) return null;

    try {
      const parsed = JSON.parse(cached) as CachedPrayerTimes;
      const today = new Date().toISOString().split('T')[0];
      
      // Check if cache is for today
      if (parsed.date === today) {
        return parsed;
      }
      
      // Cache is stale but still return it if offline
      if (!navigator.onLine) {
        return parsed;
      }
      
      return null;
    } catch {
      return null;
    }
  }, []);

  // Check if prayer times cache is stale
  const isPrayerTimesCacheStale = useCallback((): boolean => {
    const cached = getCachedPrayerTimes();
    if (!cached) return true;
    
    const today = new Date().toISOString().split('T')[0];
    return cached.date !== today;
  }, [getCachedPrayerTimes]);

  // Clear all cached data
  const clearCache = useCallback(() => {
    localStorage.removeItem(PRAYER_TIMES_CACHE_KEY);
    setCachedPrayerTimes(null);
    toast({
      title: "Cache Cleared",
      description: "All offline data has been cleared",
    });
  }, [toast]);

  return {
    isOnline,
    cachedPrayerTimes,
    cachePrayerTimes,
    getCachedPrayerTimes,
    isPrayerTimesCacheStale,
    clearCache,
  };
};

// IndexedDB for caching audio files metadata
const AUDIO_CACHE_DB = 'OfflineAudioCache';
const AUDIO_CACHE_VERSION = 1;
const AUDIO_METADATA_STORE = 'audioMetadata';

interface CachedAudioMetadata {
  id: string;
  title: string;
  artist: string;
  duration: string;
  albumArt?: string;
  cachedAt: number;
}

const openAudioCacheDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUDIO_CACHE_DB, AUDIO_CACHE_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(AUDIO_METADATA_STORE)) {
        const store = db.createObjectStore(AUDIO_METADATA_STORE, { keyPath: 'id' });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
  });
};

export const cacheAudioMetadata = async (metadata: CachedAudioMetadata): Promise<void> => {
  try {
    const db = await openAudioCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_METADATA_STORE, 'readwrite');
      const store = tx.objectStore(AUDIO_METADATA_STORE);
      const request = store.put({ ...metadata, cachedAt: Date.now() });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error('Failed to cache audio metadata:', err);
  }
};

export const getCachedAudioMetadata = async (): Promise<CachedAudioMetadata[]> => {
  try {
    const db = await openAudioCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_METADATA_STORE, 'readonly');
      const store = tx.objectStore(AUDIO_METADATA_STORE);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (err) {
    console.error('Failed to get cached audio metadata:', err);
    return [];
  }
};

export const clearAudioCache = async (): Promise<void> => {
  try {
    const db = await openAudioCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_METADATA_STORE, 'readwrite');
      const store = tx.objectStore(AUDIO_METADATA_STORE);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error('Failed to clear audio cache:', err);
  }
};
