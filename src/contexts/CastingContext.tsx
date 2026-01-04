import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export type CastingProtocol = 'chromecast' | 'airplay' | null;

export interface CastDevice {
  id: string;
  name: string;
  protocol: CastingProtocol;
  isPaired?: boolean;
  stereoRole?: 'left' | 'right' | null;
  volume?: number;
}

export interface AirPlaySettings {
  encryption: boolean;
  jitterBufferMs: number;
  enableLateJoining: boolean;
  ignoreDeviceVolume: boolean;
  alacCompression: boolean;
}

export interface MultiRoomState {
  enabled: boolean;
  devices: CastDevice[];
  stereoPairs: { left: string; right: string; name: string }[];
  syncTimestamp: number;
}

export interface CastingState {
  isAvailable: boolean;
  isCasting: boolean;
  currentDevice: CastDevice | null;
  airplaySettings: AirPlaySettings;
  multiRoom: MultiRoomState;
  pairingInProgress: boolean;
  pairingPin: string;
}

interface CastingContextType extends CastingState {
  isCastingSupported: boolean;
  isAirPlaySupported: boolean;
  isChromecastSupported: boolean;
  startChromecast: () => Promise<boolean>;
  startAirPlay: (audioElement?: HTMLAudioElement) => boolean;
  castMedia: (url: string, title: string, artist?: string, albumArt?: string) => Promise<boolean>;
  castControl: (action: 'play' | 'pause' | 'stop' | 'seek', seekTime?: number) => void;
  stopCasting: () => void;
  setAudioElement: (element: HTMLAudioElement | null) => void;
  // Settings
  updateAirPlaySettings: (settings: Partial<AirPlaySettings>) => void;
  // Multi-room
  addDeviceToMultiRoom: (device: CastDevice) => void;
  removeDeviceFromMultiRoom: (deviceId: string) => void;
  createStereoPair: (leftDeviceId: string, rightDeviceId: string, name: string) => void;
  removeStereoPair: (pairIndex: number) => void;
  setDeviceVolume: (deviceId: string, volume: number) => void;
  // Pairing
  startPairing: (device: CastDevice) => void;
  submitPairingPin: (pin: string) => Promise<boolean>;
  cancelPairing: () => void;
}

// Cast SDK type declarations
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

interface LoadRequest {
  autoplay: boolean;
  currentTime: number;
}

const DEFAULT_AIRPLAY_SETTINGS: AirPlaySettings = {
  encryption: true,
  jitterBufferMs: 1000,
  enableLateJoining: true,
  ignoreDeviceVolume: false,
  alacCompression: true,
};

const STORAGE_KEY = 'casting-settings';

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
  
  // Load persisted settings
  const loadPersistedSettings = (): Partial<CastingState> => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          airplaySettings: { ...DEFAULT_AIRPLAY_SETTINGS, ...parsed.airplaySettings },
          multiRoom: parsed.multiRoom || { enabled: false, devices: [], stereoPairs: [], syncTimestamp: 0 },
        };
      }
    } catch (e) {
      console.warn('Failed to load casting settings:', e);
    }
    return {};
  };

  const persistedSettings = loadPersistedSettings();

  const [state, setState] = useState<CastingState>({
    isAvailable: false,
    isCasting: false,
    currentDevice: null,
    airplaySettings: persistedSettings.airplaySettings || DEFAULT_AIRPLAY_SETTINGS,
    multiRoom: persistedSettings.multiRoom || { enabled: false, devices: [], stereoPairs: [], syncTimestamp: 0 },
    pairingInProgress: false,
    pairingPin: '',
  });
  
  const castContextRef = useRef<CastContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const pairingDeviceRef = useRef<CastDevice | null>(null);

  // Persist settings on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        airplaySettings: state.airplaySettings,
        multiRoom: state.multiRoom,
      }));
    } catch (e) {
      console.warn('Failed to persist casting settings:', e);
    }
  }, [state.airplaySettings, state.multiRoom]);

  // Check for AirPlay support (Safari only)
  const checkAirPlaySupport = useCallback(() => {
    const audio = document.createElement('audio');
    return !!(audio as any).webkitShowPlaybackTargetPicker;
  }, []);

  // Check for Chromecast support
  const checkChromecastSupport = useCallback(() => {
    return /chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent);
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
    const existingScript = document.querySelector('script[src*="cast_sender.js"]');
    if (existingScript) {
      if (window.cast?.framework) {
        initializeCastApi();
      }
      return;
    }

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

  // Update AirPlay settings
  const updateAirPlaySettings = useCallback((settings: Partial<AirPlaySettings>) => {
    setState(prev => ({
      ...prev,
      airplaySettings: { ...prev.airplaySettings, ...settings },
    }));
    toast({
      title: "Settings Updated",
      description: "AirPlay settings have been saved",
    });
  }, [toast]);

  // Multi-room: Add device
  const addDeviceToMultiRoom = useCallback((device: CastDevice) => {
    setState(prev => {
      if (prev.multiRoom.devices.some(d => d.id === device.id)) {
        return prev;
      }
      return {
        ...prev,
        multiRoom: {
          ...prev.multiRoom,
          enabled: true,
          devices: [...prev.multiRoom.devices, { ...device, volume: 100 }],
          syncTimestamp: Date.now(),
        },
      };
    });
    toast({
      title: "Device Added",
      description: `${device.name} added to multi-room group`,
    });
  }, [toast]);

  // Multi-room: Remove device
  const removeDeviceFromMultiRoom = useCallback((deviceId: string) => {
    setState(prev => {
      const newDevices = prev.multiRoom.devices.filter(d => d.id !== deviceId);
      const newStereoPairs = prev.multiRoom.stereoPairs.filter(
        p => p.left !== deviceId && p.right !== deviceId
      );
      return {
        ...prev,
        multiRoom: {
          ...prev.multiRoom,
          enabled: newDevices.length > 0,
          devices: newDevices,
          stereoPairs: newStereoPairs,
          syncTimestamp: Date.now(),
        },
      };
    });
  }, []);

  // Multi-room: Create stereo pair
  const createStereoPair = useCallback((leftDeviceId: string, rightDeviceId: string, name: string) => {
    setState(prev => {
      // Mark devices with stereo roles
      const updatedDevices = prev.multiRoom.devices.map(d => {
        if (d.id === leftDeviceId) return { ...d, stereoRole: 'left' as const };
        if (d.id === rightDeviceId) return { ...d, stereoRole: 'right' as const };
        return d;
      });

      return {
        ...prev,
        multiRoom: {
          ...prev.multiRoom,
          devices: updatedDevices,
          stereoPairs: [...prev.multiRoom.stereoPairs, { left: leftDeviceId, right: rightDeviceId, name }],
          syncTimestamp: Date.now(),
        },
      };
    });
    toast({
      title: "Stereo Pair Created",
      description: `${name} is now a stereo pair`,
    });
  }, [toast]);

  // Multi-room: Remove stereo pair
  const removeStereoPair = useCallback((pairIndex: number) => {
    setState(prev => {
      const pair = prev.multiRoom.stereoPairs[pairIndex];
      if (!pair) return prev;

      // Remove stereo roles from devices
      const updatedDevices = prev.multiRoom.devices.map(d => {
        if (d.id === pair.left || d.id === pair.right) {
          return { ...d, stereoRole: null };
        }
        return d;
      });

      return {
        ...prev,
        multiRoom: {
          ...prev.multiRoom,
          devices: updatedDevices,
          stereoPairs: prev.multiRoom.stereoPairs.filter((_, i) => i !== pairIndex),
          syncTimestamp: Date.now(),
        },
      };
    });
  }, []);

  // Set device volume
  const setDeviceVolume = useCallback((deviceId: string, volume: number) => {
    setState(prev => ({
      ...prev,
      multiRoom: {
        ...prev.multiRoom,
        devices: prev.multiRoom.devices.map(d =>
          d.id === deviceId ? { ...d, volume } : d
        ),
      },
    }));
  }, []);

  // Pairing: Start
  const startPairing = useCallback((device: CastDevice) => {
    pairingDeviceRef.current = device;
    setState(prev => ({
      ...prev,
      pairingInProgress: true,
      pairingPin: '',
    }));
  }, []);

  // Pairing: Submit PIN
  const submitPairingPin = useCallback(async (pin: string): Promise<boolean> => {
    const device = pairingDeviceRef.current;
    if (!device) return false;

    setState(prev => ({ ...prev, pairingPin: pin }));

    // Simulate PIN validation (in real implementation, this would communicate with the device)
    // For AirPlay devices like Apple TV, PIN is entered on the device screen
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mark device as paired
    setState(prev => ({
      ...prev,
      pairingInProgress: false,
      pairingPin: '',
      multiRoom: {
        ...prev.multiRoom,
        devices: prev.multiRoom.devices.map(d =>
          d.id === device.id ? { ...d, isPaired: true } : d
        ),
      },
    }));

    pairingDeviceRef.current = null;

    toast({
      title: "Pairing Complete",
      description: `Successfully paired with ${device.name}`,
    });

    return true;
  }, [toast]);

  // Pairing: Cancel
  const cancelPairing = useCallback(() => {
    pairingDeviceRef.current = null;
    setState(prev => ({
      ...prev,
      pairingInProgress: false,
      pairingPin: '',
    }));
  }, []);

  const isAirPlaySupported = checkAirPlaySupport();
  const isChromecastSupported = checkChromecastSupport();
  const isCastingSupported = state.isAvailable || isAirPlaySupported || isChromecastSupported;

  const value: CastingContextType = {
    ...state,
    isCastingSupported,
    isAirPlaySupported,
    isChromecastSupported,
    startChromecast,
    startAirPlay,
    castMedia,
    castControl,
    stopCasting,
    setAudioElement,
    updateAirPlaySettings,
    addDeviceToMultiRoom,
    removeDeviceFromMultiRoom,
    createStereoPair,
    removeStereoPair,
    setDeviceVolume,
    startPairing,
    submitPairingPin,
    cancelPairing,
  };

  return (
    <CastingContext.Provider value={value}>
      {children}
    </CastingContext.Provider>
  );
};
