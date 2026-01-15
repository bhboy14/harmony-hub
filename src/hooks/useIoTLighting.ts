import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Web Bluetooth types (not in standard lib)
declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: any): Promise<any>;
    };
  }
}

interface LightDevice {
  id: string;
  name: string;
  type: "bluetooth" | "midi";
  connected: boolean;
  device?: any; // BluetoothDevice or MIDIOutput
}

interface LightingPreset {
  name: string;
  color: { h: number; s: number; l: number };
  brightness: number;
  effect: "solid" | "pulse" | "fade" | "visualizer";
}

const LIGHTING_PRESETS: Record<string, LightingPreset> = {
  preAzan: {
    name: "Pre-Azan",
    color: { h: 35, s: 90, l: 50 }, // Warm amber
    brightness: 30,
    effect: "fade",
  },
  azan: {
    name: "Azan",
    color: { h: 45, s: 80, l: 40 }, // Golden
    brightness: 50,
    effect: "pulse",
  },
  djSet: {
    name: "DJ Set",
    color: { h: 280, s: 100, l: 50 }, // Purple
    brightness: 100,
    effect: "visualizer",
  },
  relaxed: {
    name: "Relaxed",
    color: { h: 200, s: 60, l: 30 }, // Cool blue
    brightness: 40,
    effect: "solid",
  },
  focus: {
    name: "Focus",
    color: { h: 180, s: 40, l: 60 }, // Cyan
    brightness: 70,
    effect: "solid",
  },
};

const IOT_SETTINGS_KEY = "iot_lighting_settings";

interface IoTSettings {
  enabled: boolean;
  autoSync: boolean;
  visualizerEnabled: boolean;
  preAzanFadeMinutes: number;
  savedDevices: string[];
}

export const useIoTLighting = () => {
  const { toast } = useToast();
  const [devices, setDevices] = useState<LightDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<string | null>(null);
  const [settings, setSettings] = useState<IoTSettings>(() => {
    const saved = localStorage.getItem(IOT_SETTINGS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {
          enabled: false,
          autoSync: true,
          visualizerEnabled: true,
          preAzanFadeMinutes: 2,
          savedDevices: [],
        };
      }
    }
    return {
      enabled: false,
      autoSync: true,
      visualizerEnabled: true,
      preAzanFadeMinutes: 2,
      savedDevices: [],
    };
  });

  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const visualizerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(IOT_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Check if Bluetooth is available
  const isBluetoothSupported = useCallback(() => {
    return "bluetooth" in navigator;
  }, []);

  // Check if Web MIDI is available
  const isMidiSupported = useCallback(() => {
    return "requestMIDIAccess" in navigator;
  }, []);

  // Scan for Bluetooth devices
  const scanBluetoothDevices = useCallback(async () => {
    if (!isBluetoothSupported()) {
      toast({
        title: "Bluetooth Not Available",
        description: "Your browser doesn't support Web Bluetooth",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    
    try {
      // Request Bluetooth device with common smart light services
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "0000ffe5-0000-1000-8000-00805f9b34fb", // Common LED service
          "0000ff00-0000-1000-8000-00805f9b34fb", // Alternative LED service
        ],
      });

      const newDevice: LightDevice = {
        id: device.id,
        name: device.name || "Unknown Light",
        type: "bluetooth",
        connected: false,
        device,
      };

      setDevices((prev) => {
        const exists = prev.find((d) => d.id === device.id);
        if (exists) return prev;
        return [...prev, newDevice];
      });

      toast({
        title: "Device Found",
        description: `Found: ${device.name || "Unknown Light"}`,
      });
    } catch (error: any) {
      if (error.name !== "NotFoundError") {
        console.error("Bluetooth scan error:", error);
        toast({
          title: "Scan Failed",
          description: error.message || "Could not scan for devices",
          variant: "destructive",
        });
      }
    } finally {
      setIsScanning(false);
    }
  }, [isBluetoothSupported, toast]);

  // Initialize MIDI access
  const initializeMidi = useCallback(async () => {
    if (!isMidiSupported()) {
      toast({
        title: "MIDI Not Available",
        description: "Your browser doesn't support Web MIDI",
        variant: "destructive",
      });
      return;
    }

    try {
      const access = await (navigator as any).requestMIDIAccess();
      midiAccessRef.current = access;

      // Listen for MIDI device connections
      access.onstatechange = (event: any) => {
        const port = event.port;
        if (port.type === "output") {
          if (port.state === "connected") {
            const newDevice: LightDevice = {
              id: port.id,
              name: port.name || "MIDI Light Controller",
              type: "midi",
              connected: true,
              device: port,
            };
            setDevices((prev) => {
              const exists = prev.find((d) => d.id === port.id);
              if (exists) return prev;
              return [...prev, newDevice];
            });
          } else if (port.state === "disconnected") {
            setDevices((prev) => prev.filter((d) => d.id !== port.id));
          }
        }
      };

      // Add existing outputs
      const outputs = access.outputs.values();
      for (const output of outputs) {
        const device: LightDevice = {
          id: output.id,
          name: output.name || "MIDI Controller",
          type: "midi",
          connected: true,
          device: output,
        };
        setDevices((prev) => {
          const exists = prev.find((d) => d.id === output.id);
          if (exists) return prev;
          return [...prev, device];
        });
      }

      toast({
        title: "MIDI Initialized",
        description: "MIDI access granted",
      });
    } catch (error: any) {
      console.error("MIDI init error:", error);
      toast({
        title: "MIDI Failed",
        description: error.message || "Could not access MIDI devices",
        variant: "destructive",
      });
    }
  }, [isMidiSupported, toast]);

  // Connect to a Bluetooth device
  const connectDevice = useCallback(async (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId);
    if (!device || device.type !== "bluetooth" || !device.device) return;

    try {
      const btDevice = device.device;
      await btDevice.gatt?.connect();
      
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId ? { ...d, connected: true } : d
        )
      );

      toast({
        title: "Connected",
        description: `Connected to ${device.name}`,
      });
    } catch (error: any) {
      console.error("Bluetooth connect error:", error);
      toast({
        title: "Connection Failed",
        description: error.message || "Could not connect to device",
        variant: "destructive",
      });
    }
  }, [devices, toast]);

  // Disconnect a device
  const disconnectDevice = useCallback(async (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;

    if (device.type === "bluetooth" && device.device) {
      device.device.gatt?.disconnect();
    }

    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId ? { ...d, connected: false } : d
      )
    );
  }, [devices]);

  // Send color to connected devices
  const sendColorToDevices = useCallback(async (
    color: { h: number; s: number; l: number },
    brightness: number
  ) => {
    const connectedDevices = devices.filter((d) => d.connected);
    
    for (const device of connectedDevices) {
      if (device.type === "bluetooth") {
        // Send via Bluetooth characteristic
        // This would need device-specific implementation
        console.log(`[IoT] Sending to ${device.name}:`, { color, brightness });
      } else if (device.type === "midi") {
        const output = device.device as MIDIOutput;
        if (output) {
          // Send MIDI control change messages for RGB
          // Channel 1, CC 1-3 for RGB, CC 4 for brightness
          const r = Math.round((color.h / 360) * 127);
          const g = Math.round((color.s / 100) * 127);
          const b = Math.round((color.l / 100) * 127);
          const br = Math.round((brightness / 100) * 127);
          
          output.send([0xB0, 1, r]); // Red
          output.send([0xB0, 2, g]); // Green
          output.send([0xB0, 3, b]); // Blue
          output.send([0xB0, 4, br]); // Brightness
        }
      }
    }
  }, [devices]);

  // Apply a lighting preset
  const applyPreset = useCallback(async (presetName: string) => {
    const preset = LIGHTING_PRESETS[presetName];
    if (!preset) return;

    setCurrentPreset(presetName);
    await sendColorToDevices(preset.color, preset.brightness);

    // Handle special effects
    if (preset.effect === "pulse") {
      // Implement pulsing effect
      let increasing = false;
      let currentBrightness = preset.brightness;
      
      visualizerIntervalRef.current = setInterval(() => {
        if (increasing) {
          currentBrightness += 5;
          if (currentBrightness >= preset.brightness) increasing = false;
        } else {
          currentBrightness -= 5;
          if (currentBrightness <= preset.brightness * 0.3) increasing = true;
        }
        sendColorToDevices(preset.color, currentBrightness);
      }, 100);
    }
  }, [sendColorToDevices]);

  // Stop current effect
  const stopEffect = useCallback(() => {
    if (visualizerIntervalRef.current) {
      clearInterval(visualizerIntervalRef.current);
      visualizerIntervalRef.current = null;
    }
    setCurrentPreset(null);
  }, []);

  // Sync lighting with audio visualizer data
  const syncWithVisualizer = useCallback((frequencyData: Uint8Array) => {
    if (!settings.visualizerEnabled) return;
    
    // Calculate average frequency for color
    const avg = frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length;
    const bass = frequencyData.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const treble = frequencyData.slice(-10).reduce((a, b) => a + b, 0) / 10;
    
    // Map audio to HSL color
    const hue = (bass / 255) * 360;
    const saturation = 70 + (treble / 255) * 30;
    const lightness = 30 + (avg / 255) * 40;
    const brightness = 50 + (avg / 255) * 50;
    
    sendColorToDevices(
      { h: hue, s: saturation, l: lightness },
      brightness
    );
  }, [settings.visualizerEnabled, sendColorToDevices]);

  // Trigger pre-Azan fade
  const triggerPreAzanFade = useCallback(() => {
    applyPreset("preAzan");
    toast({
      title: "Pre-Azan Lighting",
      description: "Lights transitioning to prayer mode",
    });
  }, [applyPreset, toast]);

  // Trigger Azan lighting
  const triggerAzanLighting = useCallback(() => {
    stopEffect(); // Stop any current effect
    applyPreset("azan");
  }, [applyPreset, stopEffect]);

  // Reset to normal lighting
  const resetLighting = useCallback(() => {
    stopEffect();
    sendColorToDevices({ h: 0, s: 0, l: 100 }, 70); // White at 70%
    setCurrentPreset(null);
  }, [stopEffect, sendColorToDevices]);

  // Update settings
  const updateSettings = useCallback((updates: Partial<IoTSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (visualizerIntervalRef.current) {
        clearInterval(visualizerIntervalRef.current);
      }
    };
  }, []);

  return {
    devices,
    isScanning,
    currentPreset,
    settings,
    presets: LIGHTING_PRESETS,
    isBluetoothSupported,
    isMidiSupported,
    scanBluetoothDevices,
    initializeMidi,
    connectDevice,
    disconnectDevice,
    sendColorToDevices,
    applyPreset,
    stopEffect,
    syncWithVisualizer,
    triggerPreAzanFade,
    triggerAzanLighting,
    resetLighting,
    updateSettings,
  };
};
