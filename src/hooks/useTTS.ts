import { useState, useEffect, useCallback, useRef } from "react";

interface UseTTSOptions {
  defaultVoice?: string;
  defaultRate?: number;
  defaultPitch?: number;
  defaultVolume?: number;
}

export interface TTSVoice {
  id: string;
  name: string;
  lang: string;
  default: boolean;
  localService: boolean;
}

export const useTTS = (options: UseTTSOptions = {}) => {
  const {
    defaultVoice,
    defaultRate = 1,
    defaultPitch = 1,
    defaultVolume = 1,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(defaultVoice || null);
  const [rate, setRate] = useState(defaultRate);
  const [pitch, setPitch] = useState(defaultPitch);
  const [volume, setVolume] = useState(defaultVolume);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check support and load voices
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const loadVoices = () => {
      const availableVoices = synth.getVoices();
      const mappedVoices: TTSVoice[] = availableVoices.map((voice) => ({
        id: voice.voiceURI,
        name: voice.name,
        lang: voice.lang,
        default: voice.default,
        localService: voice.localService,
      }));
      setVoices(mappedVoices);

      // Auto-select default voice
      if (!selectedVoice && mappedVoices.length > 0) {
        const defaultV = mappedVoices.find((v) => v.default) || mappedVoices[0];
        setSelectedVoice(defaultV.id);
      }
    };

    // Load voices (some browsers require the event)
    loadVoices();
    synth.onvoiceschanged = loadVoices;

    return () => {
      synth.onvoiceschanged = null;
    };
  }, [selectedVoice]);

  // Speak text
  const speak = useCallback(
    (text: string, options?: { voice?: string; rate?: number; pitch?: number; volume?: number }) => {
      if (!isSupported) return;

      const synth = window.speechSynthesis;

      // Cancel any ongoing speech
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set voice
      const voiceId = options?.voice || selectedVoice;
      if (voiceId) {
        const voice = synth.getVoices().find((v) => v.voiceURI === voiceId);
        if (voice) {
          utterance.voice = voice;
        }
      }

      // Set properties
      utterance.rate = options?.rate ?? rate;
      utterance.pitch = options?.pitch ?? pitch;
      utterance.volume = options?.volume ?? volume;

      // Event handlers
      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };

      utterance.onerror = (event) => {
        console.error("[TTS] Error:", event.error);
        setIsSpeaking(false);
        setIsPaused(false);
      };

      utterance.onpause = () => {
        setIsPaused(true);
      };

      utterance.onresume = () => {
        setIsPaused(false);
      };

      utteranceRef.current = utterance;
      synth.speak(utterance);
    },
    [isSupported, selectedVoice, rate, pitch, volume]
  );

  // Pause speech
  const pause = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.pause();
  }, [isSupported]);

  // Resume speech
  const resume = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.resume();
  }, [isSupported]);

  // Cancel speech
  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [isSupported]);

  // Announce track change (helper for audio integration)
  const announceTrack = useCallback(
    (title: string, artist: string) => {
      if (!isSupported) return;
      speak(`Now playing: ${title} by ${artist}`);
    },
    [isSupported, speak]
  );

  // Announce time (for prayer times or general announcements)
  const announceTime = useCallback(
    (label: string, time: string) => {
      if (!isSupported) return;
      speak(`${label} at ${time}`);
    },
    [isSupported, speak]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return {
    isSupported,
    isSpeaking,
    isPaused,
    voices,
    selectedVoice,
    rate,
    pitch,
    volume,
    setSelectedVoice,
    setRate,
    setPitch,
    setVolume,
    speak,
    pause,
    resume,
    cancel,
    announceTrack,
    announceTime,
  };
};
