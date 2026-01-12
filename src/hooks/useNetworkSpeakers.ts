import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export interface NetworkSpeaker {
  id: string;
  name: string;
  type: 'airplay' | 'chromecast' | 'dlna' | 'sonos' | 'unknown';
  ipAddress?: string;
  port?: number;
  isConnected: boolean;
  isAvailable: boolean;
  lastSeen: Date;
}

interface UseNetworkSpeakersOptions {
  enabled?: boolean;
  scanInterval?: number; // ms
}

// Note: True mDNS/Bonjour discovery is not available in browsers due to security restrictions.
// This hook provides a simulated discovery experience with manual IP input fallback.
// For real mDNS discovery, a native app or server-side component would be required.

export const useNetworkSpeakers = (options: UseNetworkSpeakersOptions = {}) => {
  const { enabled = true, scanInterval = 30000 } = options;
  const { toast } = useToast();
  
  const [speakers, setSpeakers] = useState<NetworkSpeaker[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const storageKey = 'network_speakers';

  // Load saved speakers from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSpeakers(parsed.map((s: any) => ({
          ...s,
          lastSeen: new Date(s.lastSeen),
          isConnected: false, // Reset connection state on load
        })));
      }
    } catch (err) {
      console.error('[NetworkSpeakers] Failed to load saved speakers:', err);
    }
  }, []);

  // Save speakers to localStorage
  const saveSpeakers = useCallback((speakerList: NetworkSpeaker[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(speakerList));
    } catch (err) {
      console.error('[NetworkSpeakers] Failed to save speakers:', err);
    }
  }, []);

  // Simulate network scan (in real implementation, this would use WebRTC or a server endpoint)
  const scanNetwork = useCallback(async () => {
    if (isScanning) return;
    
    setIsScanning(true);
    console.log('[NetworkSpeakers] Starting network scan...');

    try {
      // In a real implementation, we would:
      // 1. Use WebRTC to discover local network topology
      // 2. Ping known mDNS/Bonjour ports
      // 3. Query a backend service that performs actual mDNS discovery

      // For now, we'll just update the lastSeen time of existing speakers
      // and check if they're still reachable (simulated)
      
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate scan time

      setSpeakers(prev => {
        const updated = prev.map(speaker => ({
          ...speaker,
          isAvailable: Math.random() > 0.2, // 80% chance still available (simulated)
          lastSeen: speaker.isAvailable ? new Date() : speaker.lastSeen,
        }));
        saveSpeakers(updated);
        return updated;
      });

      setLastScanTime(new Date());
      console.log('[NetworkSpeakers] Scan complete');
    } catch (err) {
      console.error('[NetworkSpeakers] Scan failed:', err);
      toast({
        title: "Network Scan Failed",
        description: "Could not scan for speakers on your network",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, saveSpeakers, toast]);

  // Add a speaker manually by IP address
  const addSpeakerManually = useCallback(async (
    name: string,
    ipAddress: string,
    port: number = 7000,
    type: NetworkSpeaker['type'] = 'unknown'
  ) => {
    const newSpeaker: NetworkSpeaker = {
      id: `manual_${ipAddress}_${port}`,
      name,
      type,
      ipAddress,
      port,
      isConnected: false,
      isAvailable: true,
      lastSeen: new Date(),
    };

    setSpeakers(prev => {
      // Check if already exists
      if (prev.some(s => s.ipAddress === ipAddress && s.port === port)) {
        toast({
          title: "Speaker Already Added",
          description: `${name} is already in your speaker list`,
        });
        return prev;
      }
      
      const updated = [...prev, newSpeaker];
      saveSpeakers(updated);
      return updated;
    });

    toast({
      title: "Speaker Added",
      description: `${name} has been added to your speakers`,
    });

    return newSpeaker;
  }, [saveSpeakers, toast]);

  // Remove a speaker
  const removeSpeaker = useCallback((speakerId: string) => {
    setSpeakers(prev => {
      const updated = prev.filter(s => s.id !== speakerId);
      saveSpeakers(updated);
      return updated;
    });
  }, [saveSpeakers]);

  // Connect to a speaker (placeholder - would need actual implementation)
  const connectToSpeaker = useCallback(async (speakerId: string) => {
    const speaker = speakers.find(s => s.id === speakerId);
    if (!speaker) return false;

    console.log('[NetworkSpeakers] Connecting to:', speaker.name);

    // Simulate connection attempt
    await new Promise(resolve => setTimeout(resolve, 1000));

    setSpeakers(prev => prev.map(s => 
      s.id === speakerId 
        ? { ...s, isConnected: true }
        : s
    ));

    toast({
      title: "Connected",
      description: `Now connected to ${speaker.name}`,
    });

    return true;
  }, [speakers, toast]);

  // Disconnect from a speaker
  const disconnectFromSpeaker = useCallback((speakerId: string) => {
    setSpeakers(prev => prev.map(s => 
      s.id === speakerId 
        ? { ...s, isConnected: false }
        : s
    ));
  }, []);

  // Auto-scan on interval
  useEffect(() => {
    if (!enabled) return;

    // Initial scan
    scanNetwork();

    // Set up interval
    scanIntervalRef.current = setInterval(scanNetwork, scanInterval);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [enabled, scanInterval, scanNetwork]);

  return {
    speakers,
    isScanning,
    lastScanTime,
    scanNetwork,
    addSpeakerManually,
    removeSpeaker,
    connectToSpeaker,
    disconnectFromSpeaker,
  };
};
