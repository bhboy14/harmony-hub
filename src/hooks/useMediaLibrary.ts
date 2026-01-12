import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import * as musicMetadata from "music-metadata-browser";

export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  source: "local" | "streaming";
  albumArt?: string;
  fileHandle?: any;
  url?: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

// Check if File System Access API is supported
const isFileSystemSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

declare global {
  interface Window {
    showDirectoryPicker: (options?: { mode?: string }) => Promise<any>;
  }
}

const DB_NAME = 'MusicLibraryDB';
const DB_VERSION = 1;
const STORE_NAME = 'folderHandles';

// IndexedDB helpers for persisting folder handle
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const saveFolderHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(handle, 'savedFolder');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const loadFolderHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get('savedFolder');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch {
    return null;
  }
};

const clearFolderHandle = async (): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete('savedFolder');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch {
    // ignore
  }
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const extractMetadata = async (file: File): Promise<{ title: string; artist: string; duration: string; albumArt?: string }> => {
  try {
    const metadata = await musicMetadata.parseBlob(file, { duration: true });
    const { common, format } = metadata;
    
    // Extract album art
    let albumArt: string | undefined;
    const picture = common.picture?.[0];
    if (picture?.data && picture.format) {
      const base64 = btoa(Array.from(picture.data).map(byte => String.fromCharCode(byte)).join(''));
      let mimeType = picture.format;
      if (!mimeType.startsWith('image/')) mimeType = `image/${mimeType}`;
      albumArt = `data:${mimeType};base64,${base64}`;
    }

    const duration = format.duration ? formatDuration(format.duration) : "0:00";
    const title = common.title || file.name.replace(/\.[^/.]+$/, "");
    const artist = common.artist || common.albumartist || "Unknown Artist";

    return { title, artist, duration, albumArt };
  } catch (err) {
    console.warn('[MediaLibrary] Metadata extraction failed, using fallback:', err);
    // Fallback to basic extraction
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      audio.src = url;
      
      audio.addEventListener('loadedmetadata', () => {
        const duration = formatDuration(audio.duration);
        URL.revokeObjectURL(url);
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        const parts = nameWithoutExt.split(' - ');
        const artist = parts.length > 1 ? parts[0].trim() : "Unknown Artist";
        const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : nameWithoutExt;
        resolve({ title, artist, duration });
      });
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        resolve({ title: nameWithoutExt, artist: "Unknown", duration: "0:00" });
      });
    });
  }
};

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'];

export const useMediaLibrary = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([
    { id: "1", name: "Favorites", tracks: [] },
    { id: "2", name: "Background Music", tracks: [] },
    { id: "3", name: "Announcements", tracks: [] },
  ]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(75);
  const [isScanning, setIsScanning] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [hasSavedFolder, setHasSavedFolder] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [newFilesCount, setNewFilesCount] = useState(0);
  
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const watchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTrackCountRef = useRef<number>(0);

  // Object URLs created for local files must be revoked to avoid memory leaks.
  const objectUrlsRef = useRef<string[]>([]);
  const revokeObjectUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
    objectUrlsRef.current = [];
  }, []);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.addEventListener('ended', () => setIsPlaying(false));
    audioRef.current.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      toast({
        title: "Playback Error",
        description: "Could not play this track",
        variant: "destructive"
      });
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      revokeObjectUrls();
    };
  }, [toast, revokeObjectUrls]);

  // Load saved folder on mount
  useEffect(() => {
    const loadSavedFolder = async () => {
      if (!isFileSystemSupported) return;
      
      const savedHandle = await loadFolderHandle();
      if (savedHandle) {
        directoryHandleRef.current = savedHandle;
        setFolderName(savedHandle.name);
        setHasSavedFolder(true);
        setNeedsPermission(true);
      }
    };
    loadSavedFolder();
  }, []);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  const scanDirectory = useCallback(async (
    dirHandle: any,
    basePath = ""
  ): Promise<Track[]> => {
    const foundTracks: Track[] = [];
    
    // Use async iterator for directory entries
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === 'file') {
        const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
        if (AUDIO_EXTENSIONS.includes(ext)) {
          try {
            const file = await entry.getFile();
            const metadata = await extractMetadata(file);

            // Pre-generate a stable object URL so playback can start immediately on click
            // (avoids async/await chains that can trip autoplay policies).
            const url = URL.createObjectURL(file);
            objectUrlsRef.current.push(url);
            
            foundTracks.push({
              id: `${basePath}/${name}`.replace(/^\//, ''),
              title: metadata.title,
              artist: metadata.artist,
              duration: metadata.duration,
              source: "local",
              fileHandle: entry,
              url,
              albumArt: metadata.albumArt,
            });
          } catch (err) {
            console.error(`Error reading ${name}:`, err);
          }
        }
      } else if (entry.kind === 'directory') {
        const subTracks = await scanDirectory(entry, `${basePath}/${name}`);
        foundTracks.push(...subTracks);
      }
    }
    
    return foundTracks;
  }, []);

  // Request permission for saved folder and scan
  const requestPermissionAndScan = useCallback(async () => {
    if (!directoryHandleRef.current) return false;
    
    try {
      // Request permission
      const permissionStatus = await (directoryHandleRef.current as any).requestPermission({ mode: 'read' });
      
      if (permissionStatus !== 'granted') {
        toast({
          title: "Permission Denied",
          description: "Please grant access to your music folder",
          variant: "destructive"
        });
        return false;
      }
      
      setNeedsPermission(false);
      setIsScanning(true);
      revokeObjectUrls();
      
      toast({
        title: "Scanning folder",
        description: `Scanning "${directoryHandleRef.current.name}" for audio files...`,
      });
      
      const foundTracks = await scanDirectory(directoryHandleRef.current);
      setTracks(foundTracks);
      setIsScanning(false);
      
      toast({
        title: "Scan Complete",
        description: `Found ${foundTracks.length} audio files`,
      });
      
      return true;
    } catch (err) {
      console.error('Permission/scan error:', err);
      setIsScanning(false);
      setNeedsPermission(true);
      return false;
    }
  }, [scanDirectory, toast, revokeObjectUrls]);

  const selectFolder = useCallback(async () => {
    if (!isFileSystemSupported) {
      toast({
        title: "Not Supported",
        description: "Your browser doesn't support folder access. Try Chrome or Edge.",
        variant: "destructive"
      });
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read'
      });
      
      directoryHandleRef.current = dirHandle;
      setFolderName(dirHandle.name);
      setHasSavedFolder(true);
      setNeedsPermission(false);
      setIsScanning(true);
      revokeObjectUrls();
      
      // Save the folder handle for persistence
      await saveFolderHandle(dirHandle);
      
      toast({
        title: "Scanning folder",
        description: `Scanning "${dirHandle.name}" for audio files...`,
      });
      
      const foundTracks = await scanDirectory(dirHandle);
      
      setTracks(foundTracks);
      setIsScanning(false);
      
      toast({
        title: "Folder Saved",
        description: `Found ${foundTracks.length} audio files. This folder will be remembered.`,
      });
    } catch (err: any) {
      setIsScanning(false);
      if (err.name !== 'AbortError') {
        console.error('Folder selection error:', err);
        toast({
          title: "Error",
          description: "Could not access the folder",
          variant: "destructive"
        });
      }
    }
  }, [scanDirectory, toast, revokeObjectUrls]);

  const rescanFolder = useCallback(async () => {
    if (!directoryHandleRef.current) {
      toast({
        title: "No folder selected",
        description: "Please select a folder first",
        variant: "destructive"
      });
      return;
    }

    // Check if we need permission first
    if (needsPermission) {
      const granted = await requestPermissionAndScan();
      if (!granted) return;
      return;
    }

    setIsScanning(true);
    revokeObjectUrls();
    
    try {
      const foundTracks = await scanDirectory(directoryHandleRef.current);
      setTracks(foundTracks);
      
      toast({
        title: "Rescan Complete",
        description: `Found ${foundTracks.length} audio files`,
      });
    } catch (err) {
      console.error('Rescan error:', err);
      // Permission might have been revoked
      setNeedsPermission(true);
      toast({
        title: "Permission Required",
        description: "Please grant access to rescan the folder",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  }, [scanDirectory, toast, revokeObjectUrls, needsPermission, requestPermissionAndScan]);

  const clearSavedFolder = useCallback(async () => {
    await clearFolderHandle();
    directoryHandleRef.current = null;
    setFolderName(null);
    setHasSavedFolder(false);
    setNeedsPermission(false);
    revokeObjectUrls();
    setTracks([]);
    toast({
      title: "Folder Cleared",
      description: "Saved folder has been removed",
    });
  }, [toast, revokeObjectUrls]);

  // File watcher - poll directory for new files
  const startWatching = useCallback((intervalMs: number = 30000) => {
    if (!directoryHandleRef.current || needsPermission) return;
    
    // Clear any existing interval
    if (watchIntervalRef.current) {
      clearInterval(watchIntervalRef.current);
    }
    
    setIsWatching(true);
    lastTrackCountRef.current = tracks.length;
    
    watchIntervalRef.current = setInterval(async () => {
      if (!directoryHandleRef.current || needsPermission) {
        stopWatching();
        return;
      }
      
      try {
        // Quick count of files without full metadata extraction
        let fileCount = 0;
        const countFiles = async (dirHandle: FileSystemDirectoryHandle): Promise<number> => {
          let count = 0;
          for await (const [name, entry] of (dirHandle as any).entries()) {
            if (entry.kind === 'file') {
              const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
              if (AUDIO_EXTENSIONS.includes(ext)) {
                count++;
              }
            } else if (entry.kind === 'directory') {
              count += await countFiles(entry);
            }
          }
          return count;
        };
        
        fileCount = await countFiles(directoryHandleRef.current);
        
        const diff = fileCount - lastTrackCountRef.current;
        if (diff > 0) {
          setNewFilesCount(diff);
          toast({
            title: "New files detected!",
            description: `${diff} new audio file${diff > 1 ? 's' : ''} found. Click Rescan to update library.`,
          });
        } else if (diff < 0) {
          setNewFilesCount(0);
          toast({
            title: "Files removed",
            description: `${Math.abs(diff)} file${Math.abs(diff) > 1 ? 's were' : ' was'} removed. Click Rescan to update library.`,
          });
        }
        
        lastTrackCountRef.current = fileCount;
      } catch (err) {
        console.error('Watch error:', err);
        // Permission might have been revoked
        setNeedsPermission(true);
        stopWatching();
      }
    }, intervalMs);
  }, [needsPermission, tracks.length, toast]);
  
  const stopWatching = useCallback(() => {
    if (watchIntervalRef.current) {
      clearInterval(watchIntervalRef.current);
      watchIntervalRef.current = null;
    }
    setIsWatching(false);
    setNewFilesCount(0);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIntervalRef.current) {
        clearInterval(watchIntervalRef.current);
      }
    };
  }, []);
  
  // Auto-start watching after successful scan
  useEffect(() => {
    if (tracks.length > 0 && !needsPermission && hasSavedFolder && !isWatching) {
      lastTrackCountRef.current = tracks.length;
      startWatching();
    }
  }, [tracks.length, needsPermission, hasSavedFolder, isWatching, startWatching]);

  const playTrack = useCallback(async (track: Track) => {
    if (!audioRef.current) return;
    
    try {
      // Stop current playback
      audioRef.current.pause();
      
      if (track.fileHandle) {
        const file = await track.fileHandle.getFile();
        const url = URL.createObjectURL(file);
        audioRef.current.src = url;
      } else if (track.url) {
        audioRef.current.src = track.url;
      } else {
        throw new Error('No audio source');
      }
      
      await audioRef.current.play();
      setCurrentTrack(track);
      setIsPlaying(true);
    } catch (err) {
      console.error('Play error:', err);
      toast({
        title: "Playback Error",
        description: "Could not play this track",
        variant: "destructive"
      });
    }
  }, [toast]);

  const pauseTrack = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const resumeTrack = useCallback(async () => {
    if (audioRef.current && currentTrack) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('Resume error:', err);
      }
    }
  }, [currentTrack]);

  const localTracks = tracks.filter((t) => t.source === "local");
  const streamingTracks = tracks.filter((t) => t.source === "streaming");

  return {
    tracks,
    localTracks,
    streamingTracks,
    playlists,
    currentTrack,
    isPlaying,
    volume,
    setVolume,
    playTrack,
    pauseTrack,
    resumeTrack,
    setTracks,
    setPlaylists,
    // Local library features
    selectFolder,
    rescanFolder,
    clearSavedFolder,
    requestPermissionAndScan,
    isScanning,
    folderName,
    hasSavedFolder,
    needsPermission,
    isFileSystemSupported,
    // File watching
    isWatching,
    newFilesCount,
    startWatching,
    stopWatching,
  };
};