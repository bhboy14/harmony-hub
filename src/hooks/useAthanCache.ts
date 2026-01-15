import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const ATHAN_CACHE_NAME = "athan-audio-cache-v1";
const ATHAN_SETTINGS_KEY = "athan_cache_settings";

interface AthanCacheSettings {
  cachedFiles: {
    name: string;
    url: string;
    size: number;
    cachedAt: number;
  }[];
  defaultAthanCached: boolean;
  customAthanCached: boolean;
}

const DEFAULT_SETTINGS: AthanCacheSettings = {
  cachedFiles: [],
  defaultAthanCached: false,
  customAthanCached: false,
};

export const useAthanCache = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AthanCacheSettings>(() => {
    const saved = localStorage.getItem(ATHAN_SETTINGS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });
  const [isCaching, setIsCaching] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(ATHAN_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Calculate cache size on mount
  useEffect(() => {
    calculateCacheSize();
  }, []);

  const calculateCacheSize = async () => {
    if (!("caches" in window)) return;
    
    try {
      const cache = await caches.open(ATHAN_CACHE_NAME);
      const keys = await cache.keys();
      let totalSize = 0;
      
      for (const key of keys) {
        const response = await cache.match(key);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
      
      setCacheSize(totalSize);
    } catch (error) {
      console.error("Failed to calculate cache size:", error);
    }
  };

  // Cache the default Athan audio file
  const cacheDefaultAthan = useCallback(async () => {
    if (!("caches" in window)) {
      toast({
        title: "Cache Not Supported",
        description: "Your browser doesn't support offline caching",
        variant: "destructive",
      });
      return false;
    }

    setIsCaching(true);
    
    try {
      const cache = await caches.open(ATHAN_CACHE_NAME);
      const defaultUrl = "/audio/azan-default.mp3";
      
      // Fetch and cache the file
      const response = await fetch(defaultUrl);
      if (!response.ok) throw new Error("Failed to fetch default Athan");
      
      const blob = await response.blob();
      await cache.put(defaultUrl, new Response(blob, {
        headers: { "Content-Type": "audio/mpeg" },
      }));
      
      setSettings((prev) => ({
        ...prev,
        defaultAthanCached: true,
        cachedFiles: [
          ...prev.cachedFiles.filter((f) => f.url !== defaultUrl),
          {
            name: "Default Athan",
            url: defaultUrl,
            size: blob.size,
            cachedAt: Date.now(),
          },
        ],
      }));
      
      await calculateCacheSize();
      
      toast({
        title: "Athan Cached",
        description: "Default Athan audio is now available offline",
      });
      
      return true;
    } catch (error) {
      console.error("Failed to cache default Athan:", error);
      toast({
        title: "Caching Failed",
        description: "Could not cache the default Athan audio",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsCaching(false);
    }
  }, [toast]);

  // Cache a custom Athan file
  const cacheCustomAthan = useCallback(async (file: File, url: string) => {
    if (!("caches" in window)) return false;

    setIsCaching(true);
    
    try {
      const cache = await caches.open(ATHAN_CACHE_NAME);
      
      // Store the file blob
      await cache.put(url, new Response(file, {
        headers: { "Content-Type": file.type || "audio/mpeg" },
      }));
      
      setSettings((prev) => ({
        ...prev,
        customAthanCached: true,
        cachedFiles: [
          ...prev.cachedFiles.filter((f) => f.name !== file.name),
          {
            name: file.name,
            url,
            size: file.size,
            cachedAt: Date.now(),
          },
        ],
      }));
      
      await calculateCacheSize();
      
      toast({
        title: "Custom Athan Cached",
        description: `"${file.name}" is now available offline`,
      });
      
      return true;
    } catch (error) {
      console.error("Failed to cache custom Athan:", error);
      return false;
    } finally {
      setIsCaching(false);
    }
  }, [toast]);

  // Get cached Athan audio (returns blob URL or original URL)
  const getCachedAthan = useCallback(async (url: string): Promise<string> => {
    if (!("caches" in window)) return url;
    
    try {
      const cache = await caches.open(ATHAN_CACHE_NAME);
      const response = await cache.match(url);
      
      if (response) {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }
      
      return url;
    } catch {
      return url;
    }
  }, []);

  // Check if a specific Athan URL is cached
  const isAthanCached = useCallback(async (url: string): Promise<boolean> => {
    if (!("caches" in window)) return false;
    
    try {
      const cache = await caches.open(ATHAN_CACHE_NAME);
      const response = await cache.match(url);
      return !!response;
    } catch {
      return false;
    }
  }, []);

  // Clear all cached Athan files
  const clearAthanCache = useCallback(async () => {
    if (!("caches" in window)) return;
    
    try {
      await caches.delete(ATHAN_CACHE_NAME);
      setSettings(DEFAULT_SETTINGS);
      setCacheSize(0);
      
      toast({
        title: "Cache Cleared",
        description: "All cached Athan files have been removed",
      });
    } catch (error) {
      console.error("Failed to clear Athan cache:", error);
    }
  }, [toast]);

  // Cache all prayer announcement audio files
  const cacheAnnouncementAudio = useCallback(async (
    announcements: Record<string, string | null>
  ) => {
    if (!("caches" in window)) return;
    
    setIsCaching(true);
    
    try {
      const cache = await caches.open(ATHAN_CACHE_NAME);
      
      for (const [prayer, url] of Object.entries(announcements)) {
        if (url) {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(`announcement-${prayer}`, response);
            }
          } catch {
            console.warn(`Failed to cache announcement for ${prayer}`);
          }
        }
      }
      
      await calculateCacheSize();
      
      toast({
        title: "Announcements Cached",
        description: "Prayer announcements are available offline",
      });
    } catch (error) {
      console.error("Failed to cache announcements:", error);
    } finally {
      setIsCaching(false);
    }
  }, [toast]);

  // Auto-cache default Athan on first load
  useEffect(() => {
    if (!settings.defaultAthanCached && "caches" in window) {
      cacheDefaultAthan();
    }
  }, []);

  return {
    settings,
    isCaching,
    cacheSize,
    cacheDefaultAthan,
    cacheCustomAthan,
    getCachedAthan,
    isAthanCached,
    clearAthanCache,
    cacheAnnouncementAudio,
    formatCacheSize: (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    },
  };
};
