import { useRef, useEffect, useCallback, useState } from "react";
import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";

interface AudioVisualizerProps {
  className?: string;
  barCount?: number;
  minHeight?: number;
  maxHeight?: number;
  colorStart?: string;
  colorEnd?: string;
}

export const AudioVisualizer = ({
  className = "",
  barCount = 32,
  minHeight = 4,
  maxHeight = 100,
  colorStart = "hsl(var(--primary))",
  colorEnd = "hsl(var(--primary) / 0.3)",
}: AudioVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { localAudioRef, isPlaying, activeSource } = useUnifiedAudio();

  // Connect to audio element when available
  const connectToAudio = useCallback(() => {
    const audioElement = localAudioRef?.current;
    
    if (!audioElement || isConnected) return;

    try {
      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;

      // Create analyser if needed
      if (!analyserRef.current) {
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = 128;
        analyserRef.current.smoothingTimeConstant = 0.8;
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
      }

      // Only create source once per audio element
      if (!sourceRef.current) {
        try {
          sourceRef.current = audioContext.createMediaElementSource(audioElement);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContext.destination);
          setIsConnected(true);
          console.log('[AudioVisualizer] Connected to audio element');
        } catch (e) {
          // Element might already be connected
          console.warn('[AudioVisualizer] Could not connect source:', e);
        }
      }
    } catch (e) {
      console.warn('[AudioVisualizer] Error connecting to audio:', e);
    }
  }, [localAudioRef, isConnected]);

  // Try to connect when playing starts
  useEffect(() => {
    if (isPlaying && activeSource === 'local' && !isConnected) {
      // Small delay to ensure audio element is ready
      const timer = setTimeout(() => {
        connectToAudio();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, activeSource, isConnected, connectToAudio]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!canvas || !ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      const analyser = analyserRef.current;
      const dataArray = dataArrayRef.current;

      if (analyser && dataArray && isPlaying && activeSource === 'local') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (analyser as any).getByteFrequencyData(dataArray);

        const barWidth = width / barCount;
        const gap = 2;
        const usableWidth = barWidth - gap;

        // Create gradient
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, colorEnd);
        gradient.addColorStop(1, colorStart);
        ctx.fillStyle = gradient;

        for (let i = 0; i < barCount; i++) {
          // Sample from frequency data
          const dataIndex = Math.floor((i / barCount) * dataArray.length);
          const value = dataArray[dataIndex] || 0;
          
          // Map value (0-255) to height
          const barHeight = Math.max(minHeight, (value / 255) * maxHeight);
          
          const x = i * barWidth + gap / 2;
          const y = height - barHeight;

          // Draw rounded bar
          ctx.beginPath();
          ctx.roundRect(x, y, usableWidth, barHeight, 2);
          ctx.fill();
        }
      } else {
        // Draw idle state (minimal bars)
        const barWidth = width / barCount;
        const gap = 2;
        const usableWidth = barWidth - gap;

        ctx.fillStyle = colorEnd;

        for (let i = 0; i < barCount; i++) {
          const x = i * barWidth + gap / 2;
          const y = height - minHeight;

          ctx.beginPath();
          ctx.roundRect(x, y, usableWidth, minHeight, 1);
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [barCount, minHeight, maxHeight, colorStart, colorEnd, isPlaying, activeSource]);

  // Resume audio context if suspended
  useEffect(() => {
    if (isPlaying && audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, [isPlaying]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
      }
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: 'block' }}
    />
  );
};

// Simpler visualizer that doesn't require audio context connection
// Uses random data synced to play state for visual effect
export const SimpleAudioVisualizer = ({
  className = "",
  barCount = 24,
  isActive = false,
}: {
  className?: string;
  barCount?: number;
  isActive?: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const barsRef = useRef<number[]>(Array(barCount).fill(0.1));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!canvas || !ctx) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const width = rect.width;
      const height = rect.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      const barWidth = width / barCount;
      const gap = 2;
      const usableWidth = barWidth - gap;

      // Update bar values
      for (let i = 0; i < barCount; i++) {
        if (isActive) {
          // Smooth random movement
          const target = 0.2 + Math.random() * 0.8;
          barsRef.current[i] += (target - barsRef.current[i]) * 0.15;
        } else {
          // Decay to minimum
          barsRef.current[i] += (0.1 - barsRef.current[i]) * 0.1;
        }
      }

      // Create gradient
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, 'hsla(var(--primary), 0.2)');
      gradient.addColorStop(0.5, 'hsla(var(--primary), 0.5)');
      gradient.addColorStop(1, 'hsl(var(--primary))');
      ctx.fillStyle = gradient;

      for (let i = 0; i < barCount; i++) {
        const barHeight = Math.max(4, barsRef.current[i] * height * 0.8);
        const x = i * barWidth + gap / 2;
        const y = height - barHeight;

        ctx.beginPath();
        ctx.roundRect(x, y, usableWidth, barHeight, 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [barCount, isActive]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: 'block' }}
    />
  );
};
