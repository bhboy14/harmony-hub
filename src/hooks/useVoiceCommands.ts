import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface VoiceCommandsOptions {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onMute?: () => void;
  onSearch?: (query: string) => void;
  enabled?: boolean;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const useVoiceCommands = (options: VoiceCommandsOptions) => {
  const {
    onPlay,
    onPause,
    onNext,
    onPrevious,
    onVolumeUp,
    onVolumeDown,
    onMute,
    onSearch,
    enabled = true,
  } = options;

  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  // Process voice command
  const processCommand = useCallback((text: string) => {
    const lowerText = text.toLowerCase().trim();
    console.log('[Voice] Processing command:', lowerText);

    // Play commands
    if (lowerText.includes('play') && !lowerText.includes('playlist')) {
      if (lowerText.includes('play ') && lowerText.length > 5) {
        // Search command: "play [song name]"
        const searchQuery = lowerText.replace(/^play\s+/, '');
        if (searchQuery && onSearch) {
          setLastCommand(`Search: ${searchQuery}`);
          onSearch(searchQuery);
          return true;
        }
      }
      setLastCommand('Play');
      onPlay?.();
      return true;
    }

    // Pause/Stop commands
    if (lowerText.includes('pause') || lowerText.includes('stop')) {
      setLastCommand('Pause');
      onPause?.();
      return true;
    }

    // Next track commands
    if (lowerText.includes('next') || lowerText.includes('skip')) {
      setLastCommand('Next');
      onNext?.();
      return true;
    }

    // Previous track commands
    if (lowerText.includes('previous') || lowerText.includes('back') || lowerText.includes('go back')) {
      setLastCommand('Previous');
      onPrevious?.();
      return true;
    }

    // Volume up commands
    if (lowerText.includes('volume up') || lowerText.includes('louder') || lowerText.includes('turn up')) {
      setLastCommand('Volume Up');
      onVolumeUp?.();
      return true;
    }

    // Volume down commands
    if (lowerText.includes('volume down') || lowerText.includes('quieter') || lowerText.includes('turn down')) {
      setLastCommand('Volume Down');
      onVolumeDown?.();
      return true;
    }

    // Mute commands
    if (lowerText.includes('mute') || lowerText.includes('silence')) {
      setLastCommand('Mute');
      onMute?.();
      return true;
    }

    return false;
  }, [onPlay, onPause, onNext, onPrevious, onVolumeUp, onVolumeDown, onMute, onSearch]);

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported || !enabled) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        console.log('[Voice] Started listening');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        setTranscript(interimTranscript || finalTranscript);

        if (finalTranscript) {
          const recognized = processCommand(finalTranscript);
          if (recognized) {
            toast({
              title: "Voice Command",
              description: `Recognized: "${finalTranscript}"`,
            });
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('[Voice] Error:', event.error);
        if (event.error === 'not-allowed') {
          toast({
            title: "Microphone Access Denied",
            description: "Please allow microphone access to use voice commands",
            variant: "destructive",
          });
          setIsListening(false);
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          // Auto-restart on other errors
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          restartTimeoutRef.current = setTimeout(() => {
            if (isListening) {
              startListening();
            }
          }, 1000);
        }
      };

      recognition.onend = () => {
        // Auto-restart if still supposed to be listening
        if (isListening && enabled) {
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          restartTimeoutRef.current = setTimeout(() => {
            if (recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch {
                // Ignore - already started
              }
            }
          }, 100);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error('[Voice] Failed to start:', err);
      toast({
        title: "Voice Commands Unavailable",
        description: "Could not start voice recognition",
        variant: "destructive",
      });
    }
  }, [isSupported, enabled, isListening, processCommand, toast]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    setIsListening(false);
    setTranscript("");
    console.log('[Voice] Stopped listening');
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    lastCommand,
    startListening,
    stopListening,
    toggleListening,
  };
};
