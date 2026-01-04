import { useState, useEffect } from "react";

interface ExtractedColors {
  primary: string;
  secondary: string;
  vibrant: string;
}

const DEFAULT_COLORS: ExtractedColors = {
  primary: "160, 40%, 20%",
  secondary: "160, 30%, 15%",
  vibrant: "160, 50%, 25%",
};

export const useColorExtractor = (imageUrl: string | null | undefined) => {
  const [colors, setColors] = useState<ExtractedColors>(DEFAULT_COLORS);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setColors(DEFAULT_COLORS);
      return;
    }

    const extractColors = async () => {
      setIsLoading(true);
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          
          if (!ctx) {
            setColors(DEFAULT_COLORS);
            setIsLoading(false);
            return;
          }

          // Sample a small area for performance
          const sampleSize = 10;
          canvas.width = sampleSize;
          canvas.height = sampleSize;
          ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

          const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
          const pixels = imageData.data;

          // Calculate average color with weighted sampling
          let r = 0, g = 0, b = 0;
          let count = 0;

          for (let i = 0; i < pixels.length; i += 4) {
            // Skip very dark or very light pixels
            const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
            if (brightness > 20 && brightness < 240) {
              r += pixels[i];
              g += pixels[i + 1];
              b += pixels[i + 2];
              count++;
            }
          }

          if (count === 0) {
            setColors(DEFAULT_COLORS);
            setIsLoading(false);
            return;
          }

          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);

          // Convert to HSL
          const hsl = rgbToHsl(r, g, b);
          
          setColors({
            primary: `${hsl.h}, ${Math.min(hsl.s + 10, 100)}%, ${Math.max(hsl.l - 15, 10)}%`,
            secondary: `${hsl.h}, ${Math.max(hsl.s - 10, 20)}%, ${Math.max(hsl.l - 25, 5)}%`,
            vibrant: `${hsl.h}, ${Math.min(hsl.s + 20, 100)}%, ${Math.min(hsl.l + 5, 50)}%`,
          });
          setIsLoading(false);
        };

        img.onerror = () => {
          setColors(DEFAULT_COLORS);
          setIsLoading(false);
        };

        img.src = imageUrl;
      } catch {
        setColors(DEFAULT_COLORS);
        setIsLoading(false);
      }
    };

    extractColors();
  }, [imageUrl]);

  return { colors, isLoading };
};

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}
