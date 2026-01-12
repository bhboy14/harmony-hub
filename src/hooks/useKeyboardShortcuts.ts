import { useEffect, useCallback, useRef } from "react";
import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  seekAmount?: number; // in ms
}

export const useKeyboardShortcuts = (options: UseKeyboardShortcutsOptions = {}) => {
  const { enabled = true, seekAmount = 5000 } = options;
  const unified = useUnifiedAudio();
  const lastActionRef = useRef<number>(0);
  const debounceMs = 150; // Prevent rapid-fire actions

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    const now = Date.now();
    if (now - lastActionRef.current < debounceMs) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        lastActionRef.current = now;
        if (unified.isPlaying) {
          unified.pause();
        } else {
          unified.play();
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        lastActionRef.current = now;
        const newProgressLeft = Math.max(0, unified.progress - seekAmount);
        unified.seek(newProgressLeft);
        break;

      case 'ArrowRight':
        e.preventDefault();
        lastActionRef.current = now;
        const newProgressRight = Math.min(unified.duration, unified.progress + seekAmount);
        unified.seek(newProgressRight);
        break;

      case 'ArrowUp':
        if (e.shiftKey) {
          e.preventDefault();
          lastActionRef.current = now;
          unified.previous();
        }
        break;

      case 'ArrowDown':
        if (e.shiftKey) {
          e.preventDefault();
          lastActionRef.current = now;
          unified.next();
        }
        break;

      case 'KeyM':
        e.preventDefault();
        lastActionRef.current = now;
        unified.toggleMute();
        break;

      case 'KeyS':
        if (e.shiftKey) {
          e.preventDefault();
          lastActionRef.current = now;
          unified.toggleShuffle();
        }
        break;

      case 'KeyR':
        if (e.shiftKey) {
          e.preventDefault();
          lastActionRef.current = now;
          unified.toggleRepeat();
        }
        break;
    }
  }, [unified, seekAmount]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  return {
    shortcuts: [
      { key: 'Space', description: 'Play / Pause' },
      { key: '←', description: 'Seek backward 5s' },
      { key: '→', description: 'Seek forward 5s' },
      { key: 'Shift + ↑', description: 'Previous track' },
      { key: 'Shift + ↓', description: 'Next track' },
      { key: 'M', description: 'Mute / Unmute' },
      { key: 'Shift + S', description: 'Toggle shuffle' },
      { key: 'Shift + R', description: 'Toggle repeat' },
    ],
  };
};
