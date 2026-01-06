import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

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

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const extractMetadata = async (file: File): Promise<{ title: string; artist: string; duration: string }> => {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.src = url;
    
    audio.addEventListener('loadedmetadata', () => {
      const duration = formatDuration(audio.duration);
      URL.revokeObjectURL(url);
      
      // Parse title and artist from filename
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
  
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

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
      setIsScanning(true);
      revokeObjectUrls();
      
      toast({
        title: "Scanning folder",
        description: `Scanning "${dirHandle.name}" for audio files...`,
      });
      
      const foundTracks = await scanDirectory(dirHandle);
      
      setTracks(foundTracks);
      setIsScanning(false);
      
      toast({
        title: "Scan Complete",
        description: `Found ${foundTracks.length} audio files`,
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
  }, [scanDirectory, toast]);

  const rescanFolder = useCallback(async () => {
    if (!directoryHandleRef.current) {
      toast({
        title: "No folder selected",
        description: "Please select a folder first",
        variant: "destructive"
      });
      return;
    }

    setIsScanning(true);
    revokeObjectUrls();
    
    try {
      // Try to rescan - permission may need to be re-requested
      const foundTracks = await scanDirectory(directoryHandleRef.current);
      setTracks(foundTracks);
      
      toast({
        title: "Rescan Complete",
        description: `Found ${foundTracks.length} audio files`,
      });
    } catch (err) {
      console.error('Rescan error:', err);
      toast({
        title: "Rescan Failed",
        description: "Could not rescan folder. Please select it again.",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  }, [scanDirectory, toast]);

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
    // New local library features
    selectFolder,
    rescanFolder,
    isScanning,
    folderName,
    isFileSystemSupported,
  };
};