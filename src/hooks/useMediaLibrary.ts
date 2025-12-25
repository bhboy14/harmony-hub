import { useState } from "react";

export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  source: "local" | "streaming";
  albumArt?: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

const sampleTracks: Track[] = [
  { id: "1", title: "Surah Al-Fatiha", artist: "Mishary Rashid", duration: "1:05", source: "local" },
  { id: "2", title: "Surah Al-Baqarah", artist: "Abdul Rahman Al-Sudais", duration: "2:15:30", source: "local" },
  { id: "3", title: "Surah Yasin", artist: "Saad Al-Ghamdi", duration: "24:15", source: "streaming" },
  { id: "4", title: "Surah Ar-Rahman", artist: "Mishary Rashid", duration: "12:45", source: "streaming" },
  { id: "5", title: "Surah Al-Mulk", artist: "Abdul Basit", duration: "8:30", source: "local" },
  { id: "6", title: "Morning Adhkar", artist: "Various", duration: "15:00", source: "local" },
  { id: "7", title: "Evening Adhkar", artist: "Various", duration: "14:30", source: "streaming" },
];

export const useMediaLibrary = () => {
  const [tracks, setTracks] = useState<Track[]>(sampleTracks);
  const [playlists, setPlaylists] = useState<Playlist[]>([
    { id: "1", name: "Azan Collection", tracks: [] },
    { id: "2", name: "Quran Recitations", tracks: sampleTracks.slice(0, 5) },
    { id: "3", name: "Daily Adhkar", tracks: sampleTracks.slice(5) },
  ]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(75);

  const playTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const pauseTrack = () => setIsPlaying(false);
  const resumeTrack = () => setIsPlaying(true);

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
  };
};
