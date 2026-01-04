import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export type CastingProtocol = 'chromecast' | 'airplay' | null;

export interface CastDevice {
  id: string;
  name: string;
  protocol: CastingProtocol;
}

export interface CastingState {
  isAvailable: boolean;
  isCasting: boolean;
  currentDevice: CastDevice | null;
}

interface CastingContextType extends CastingState {
  isCastingSupported: boolean;
  startChromecast: () => Promise<boolean>;
  startAirPlay: (audioElement?: HTMLAudioElement) => boolean;
  castMedia: (url: string, title: string, artist?: string, albumArt?: string) => Promise<boolean>;
  castControl: (action: 'play' | 'pause' | 'stop' | 'seek', seekTime?: number) => void;
  stopCasting: () => void;
  setAudioElement: (element: HTMLAudioElement | null) => void;
}

// Use types from useCasting hook - Cast SDK globals are declared there
interface CastContext {
  setOptions(options: { receiverApplicationId: string; autoJoinPolicy: string }): void;
  requestSession(): Promise<void>;
  getCurrentSession(): CastSession | null;
  getCastState(): string;
  addEventListener(type: string, handler: (event: any) => void): void;
  removeEventListener(type: string, handler: (event: any) => void): void;
}

interface CastSession {
  getSessionObj(): { receiver: { friendlyName: string } };
  getMediaSession(): MediaSession | null;
  loadMedia(request: LoadRequest): Promise<void>;
  endSession(stopCasting: boolean): void;
}

interface MediaSession {
  play(request?: any): void;
  pause(request?: any): void;
  seek(request: any): void;
  stop(request?: any): void;
}

interface MediaInfo {
  metadata: GenericMediaMetadata;
  streamType: string;
}

interface GenericMediaMetadata {
  title: string;
  subtitle: string;
  images: { url: string }[];
}

interface LoadRequest {
  autoplay: boolean;
  currentTime: number;
}

const CastingContext = createContext<CastingContextType | null>(null);

export const useCasting = () => {
  const context = useContext(CastingContext);
  if (!context) {
    throw new Error('useCasting must be used within a CastingProvider');
  }
  return context;
};

export const CastingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [state, setState] = useState<CastingState>({
    isAvailable: false,
    isCasting: false,
    currentDevice: null,
  });
  
  const castContextRef = useRef<CastContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Check for AirPlay support (Safari only)
  const checkAirPlaySupport = useCallback(() => {
    const audio = document.createElement('audio');
    return !!(audio as any).webkitShowPlaybackTargetPicker;
  }, []);

  // Initialize Google Cast SDK
  const initializeCastApi = useCallback(() => {
    if (!window.chrome?.cast) {
      console.log('Cast SDK not loaded yet');
      return;
    }

    const castContext = window.cast?.framework.CastContext.getInstance();
    if (!castContext) return;

    castContext.setOptions({
      receiverApplicationId: 'CC1AD845', // Default media receiver
      autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    });

    castContextRef.current = castContext;

    // Listen for cast state changes
    castContext.addEventListener(
      window.cast!.framework.CastContextEventType.CAST_STATE_CHANGED,
      (event: any) => {
        console.log('Cast state changed:', event.castState);
        const isConnected = event.castState === window.cast!.framework.CastState.CONNECTED;
        
        setState(prev => ({
          ...prev,
          isAvailable: true,
          isCasting: isConnected,
          currentDevice: isConnected ? {
            id: 'chromecast',
            name: castContext.getCurrentSession()?.getSessionObj()?.receiver?.friendlyName || 'Chromecast',
            protocol: 'chromecast',
          } : null,
        }));
      }
    );

    setState(prev => ({ ...prev, isAvailable: true }));
    console.log('Cast API initialized');
  }, []);

  // Load Cast SDK on mount
  useEffect(() => {
    // Check if script already exists
    const existingScript = document.querySelector('script[src*="cast_sender.js"]');
    if (existingScript) {
      if (window.cast?.framework) {
        initializeCastApi();
      }
      return;
    }

    // Load Google Cast SDK
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    script.async = true;
    document.body.appendChild(script);

    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) {
        initializeCastApi();
      }
    };

    return () => {
      delete window.__onGCastApiAvailable;
    };
  }, [initializeCastApi]);

  // Start casting to Chromecast
  const startChromecast = useCallback(async (): Promise<boolean> => {
    if (!castContextRef.current) {
      toast({
        title: "Cast Unavailable",
        description: "Chromecast is not available. Make sure you're using Chrome.",
        variant: "destructive",
      });
      return false;
    }

    try {
      await castContextRef.current.requestSession();
      toast({
        title: "Connected",
        description: "Now casting to Chromecast",
      });
      return true;
    } catch (error) {
      console.error('Failed to start Chromecast session:', error);
      toast({
        title: "Connection Failed",
        description: "Could not connect to Chromecast",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Start casting to AirPlay (Safari only)
  const startAirPlay = useCallback((audioElement?: HTMLAudioElement): boolean => {
    const element = audioElement || audioElementRef.current;
    if (!element) {
      toast({
        title: "No Audio",
        description: "No audio is currently playing",
        variant: "destructive",
      });
      return false;
    }

    if (!(element as any).webkitShowPlaybackTargetPicker) {
      toast({
        title: "AirPlay Unavailable",
        description: "AirPlay is only available in Safari",
        variant: "destructive",
      });
      return false;
    }

    try {
      (element as any).webkitShowPlaybackTargetPicker();
      return true;
    } catch (error) {
      console.error('Failed to show AirPlay picker:', error);
      return false;
    }
  }, [toast]);

  // Cast media to Chromecast
  const castMedia = useCallback(async (
    url: string,
    title: string,
    artist?: string,
    albumArt?: string,
    contentType: string = 'audio/mpeg'
  ): Promise<boolean> => {
    const session = castContextRef.current?.getCurrentSession();
    if (!session) {
      console.error('No active cast session');
      return false;
    }

    try {
      const mediaInfo = new window.chrome!.cast!.media.MediaInfo(url, contentType);
      mediaInfo.metadata = new window.chrome!.cast!.media.GenericMediaMetadata();
      mediaInfo.metadata.title = title;
      mediaInfo.metadata.subtitle = artist || '';
      if (albumArt) {
        mediaInfo.metadata.images = [{ url: albumArt }];
      }
      mediaInfo.streamType = 'BUFFERED';

      const request = new window.chrome!.cast!.media.LoadRequest(mediaInfo);
      request.autoplay = true;
      request.currentTime = 0;

      await session.loadMedia(request);
      console.log('Media loaded to Chromecast');
      return true;
    } catch (error) {
      console.error('Failed to cast media:', error);
      toast({
        title: "Cast Failed",
        description: "Could not cast media to device",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Control cast playback
  const castControl = useCallback((action: 'play' | 'pause' | 'stop' | 'seek', seekTime?: number) => {
    const session = castContextRef.current?.getCurrentSession();
    const mediaSession = session?.getMediaSession();
    
    if (!mediaSession) {
      console.warn('No active media session');
      return;
    }

    switch (action) {
      case 'play':
        mediaSession.play();
        break;
      case 'pause':
        mediaSession.pause();
        break;
      case 'stop':
        mediaSession.stop();
        break;
      case 'seek':
        if (seekTime !== undefined) {
          mediaSession.seek({ currentTime: seekTime });
        }
        break;
    }
  }, []);

  // Stop casting
  const stopCasting = useCallback(() => {
    const session = castContextRef.current?.getCurrentSession();
    if (session) {
      session.endSession(true);
    }
    setState(prev => ({
      ...prev,
      isCasting: false,
      currentDevice: null,
    }));
  }, []);

  // Set audio element reference for AirPlay
  const setAudioElement = useCallback((element: HTMLAudioElement | null) => {
    audioElementRef.current = element;
    
    if (element && checkAirPlaySupport()) {
      // Listen for AirPlay target changes
      (element as any).addEventListener('webkitplaybacktargetavailabilitychanged', (event: any) => {
        setState(prev => ({
          ...prev,
          isAvailable: prev.isAvailable || event.availability === 'available',
        }));
      });

      (element as any).addEventListener('webkitcurrentplaybacktargetiswirelesschanged', () => {
        const isWireless = (element as any).webkitCurrentPlaybackTargetIsWireless;
        setState(prev => ({
          ...prev,
          isCasting: isWireless,
          currentDevice: isWireless ? {
            id: 'airplay',
            name: 'AirPlay Device',
            protocol: 'airplay',
          } : null,
        }));
      });
    }
  }, [checkAirPlaySupport]);

  // Check if browser supports any casting
  const isCastingSupported = state.isAvailable || checkAirPlaySupport() || 
    (/chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent)) ||
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  const value: CastingContextType = {
    ...state,
    isCastingSupported,
    startChromecast,
    startAirPlay,
    castMedia,
    castControl,
    stopCasting,
    setAudioElement,
  };

  return (
    <CastingContext.Provider value={value}>
      {children}
    </CastingContext.Provider>
  );
};
