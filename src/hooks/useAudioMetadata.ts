import { useState, useCallback } from "react";
import * as musicMetadata from "music-metadata-browser";

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string[];
  duration?: number;
  trackNumber?: number;
  albumArt?: string; // Base64 data URL
  format?: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
}

interface UseAudioMetadataResult {
  extractMetadata: (file: File) => Promise<AudioMetadata | null>;
  extractMetadataFromUrl: (url: string) => Promise<AudioMetadata | null>;
  isExtracting: boolean;
  lastError: string | null;
}

export const useAudioMetadata = (): UseAudioMetadataResult => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Convert picture data to base64 data URL
  const pictureToDataUrl = useCallback((picture: musicMetadata.IPicture): string | undefined => {
    if (!picture?.data || !picture.format) return undefined;

    try {
      // Convert Uint8Array to base64
      const base64 = btoa(
        Array.from(picture.data)
          .map(byte => String.fromCharCode(byte))
          .join('')
      );
      
      // Determine MIME type
      let mimeType = picture.format;
      if (!mimeType.startsWith('image/')) {
        mimeType = `image/${mimeType}`;
      }

      return `data:${mimeType};base64,${base64}`;
    } catch (err) {
      console.error('[AudioMetadata] Failed to convert picture:', err);
      return undefined;
    }
  }, []);

  // Extract metadata from a File object
  const extractMetadata = useCallback(async (file: File): Promise<AudioMetadata | null> => {
    setIsExtracting(true);
    setLastError(null);

    try {
      console.log('[AudioMetadata] Extracting from file:', file.name);
      
      const metadata = await musicMetadata.parseBlob(file, { duration: true });
      
      const { common, format } = metadata;
      
      // Get the first picture (usually album art)
      const albumArt = common.picture?.[0] 
        ? pictureToDataUrl(common.picture[0])
        : undefined;

      const result: AudioMetadata = {
        title: common.title || file.name.replace(/\.[^/.]+$/, ''),
        artist: common.artist || common.albumartist,
        album: common.album,
        year: common.year,
        genre: common.genre,
        duration: format.duration,
        trackNumber: common.track?.no ?? undefined,
        albumArt,
        format: format.codec,
        bitrate: format.bitrate,
        sampleRate: format.sampleRate,
        channels: format.numberOfChannels,
      };

      console.log('[AudioMetadata] Extracted:', result);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to extract metadata';
      console.error('[AudioMetadata] Error:', errorMsg);
      setLastError(errorMsg);
      return null;
    } finally {
      setIsExtracting(false);
    }
  }, [pictureToDataUrl]);

  // Extract metadata from a URL (for streaming or cached files)
  const extractMetadataFromUrl = useCallback(async (url: string): Promise<AudioMetadata | null> => {
    setIsExtracting(true);
    setLastError(null);

    try {
      console.log('[AudioMetadata] Extracting from URL:', url);
      
      // Fetch the file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const blob = await response.blob();
      const file = new File([blob], 'audio_file', { type: blob.type });
      
      return await extractMetadata(file);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to extract metadata from URL';
      console.error('[AudioMetadata] Error:', errorMsg);
      setLastError(errorMsg);
      return null;
    } finally {
      setIsExtracting(false);
    }
  }, [extractMetadata]);

  return {
    extractMetadata,
    extractMetadataFromUrl,
    isExtracting,
    lastError,
  };
};

// Helper function to extract album art from a FileSystemFileHandle
export const extractAlbumArtFromHandle = async (
  fileHandle: FileSystemFileHandle
): Promise<string | undefined> => {
  try {
    const file = await fileHandle.getFile();
    const metadata = await musicMetadata.parseBlob(file, { duration: false });
    
    const picture = metadata.common.picture?.[0];
    if (!picture?.data || !picture.format) return undefined;

    const base64 = btoa(
      Array.from(picture.data)
        .map(byte => String.fromCharCode(byte))
        .join('')
    );
    
    let mimeType = picture.format;
    if (!mimeType.startsWith('image/')) {
      mimeType = `image/${mimeType}`;
    }

    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    console.error('[extractAlbumArt] Failed:', err);
    return undefined;
  }
};
