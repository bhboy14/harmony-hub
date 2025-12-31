/* eslint-disable @typescript-eslint/no-explicit-any */
interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: 'ready', callback: (data: { device_id: string }) => void): boolean;
  addListener(event: 'not_ready', callback: (data: { device_id: string }) => void): boolean;
  addListener(event: 'player_state_changed', callback: (state: SpotifyPlaybackSDKState | null) => void): boolean;
  addListener(event: 'initialization_error', callback: (error: { message: string }) => void): boolean;
  addListener(event: 'authentication_error', callback: (error: { message: string }) => void): boolean;
  addListener(event: 'account_error', callback: (error: { message: string }) => void): boolean;
  addListener(event: 'playback_error', callback: (error: { message: string }) => void): boolean;
  removeListener(event: string, callback?: any): boolean;
  getCurrentState(): Promise<SpotifyPlaybackSDKState | null>;
  setName(name: string): Promise<void>;
  getVolume(): Promise<number>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(position_ms: number): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
  activateElement(): Promise<void>;
}

interface SpotifyPlaybackSDKState {
  context: {
    uri: string;
    metadata: Record<string, unknown>;
  };
  disallows: {
    pausing: boolean;
    peeking_next: boolean;
    peeking_prev: boolean;
    resuming: boolean;
    seeking: boolean;
    skipping_next: boolean;
    skipping_prev: boolean;
  };
  duration: number;
  paused: boolean;
  position: number;
  repeat_mode: number;
  shuffle: boolean;
  track_window: {
    current_track: SpotifySDKTrack;
    previous_tracks: SpotifySDKTrack[];
    next_tracks: SpotifySDKTrack[];
  };
}

interface SpotifySDKTrack {
  uri: string;
  id: string;
  type: string;
  media_type: string;
  name: string;
  is_playable: boolean;
  album: {
    uri: string;
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  artists: { uri: string; name: string }[];
  duration_ms: number;
}

interface SpotifyPlayerInit {
  name: string;
  getOAuthToken: (callback: (token: string) => void) => void;
  volume?: number;
}

interface SpotifySDK {
  Player: new (options: SpotifyPlayerInit) => SpotifyPlayer;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: SpotifySDK;
  }
}

export {};
