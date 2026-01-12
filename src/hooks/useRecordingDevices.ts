import { useState, useEffect, useCallback } from "react";

export interface RecordingDevice {
  deviceId: string;
  label: string;
  kind: "audioinput" | "videoinput";
  isDefault: boolean;
}

export const useRecordingDevices = () => {
  const [devices, setDevices] = useState<RecordingDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Enumerate devices WITHOUT requesting permission
  const enumerateDevicesPassively = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices
        .filter((d) => d.kind === "audioinput" && d.deviceId)
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${index + 1}`,
          kind: d.kind as "audioinput",
          isDefault: d.deviceId === "default",
        }));

      // Check if we have labels (indicates permission was granted)
      const hasLabels = audioInputs.some(d => d.label && !d.label.startsWith('Microphone'));
      if (hasLabels) {
        setHasPermission(true);
      }

      setDevices(audioInputs);

      // Set default if not already set
      if (!currentDeviceId && audioInputs.length > 0) {
        const defaultDevice = audioInputs.find((d) => d.isDefault) || audioInputs[0];
        setCurrentDeviceId(defaultDevice.deviceId);
      }
    } catch (err) {
      console.warn("[RecordingDevices] Error enumerating devices:", err);
    }
  }, [currentDeviceId]);

  // Fetch devices WITH permission (only call this after user gesture)
  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      // Check if we already have permission
      const wasUnlocked = sessionStorage.getItem('stationUnlocked') === 'true';
      
      if (wasUnlocked || hasPermission) {
        // We should have permission, try to enumerate with labels
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices
          .filter((d) => d.kind === "audioinput" && d.deviceId)
          .map((d, index) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${index + 1}`,
            kind: d.kind as "audioinput",
            isDefault: d.deviceId === "default",
          }));

        setDevices(audioInputs);
        setHasPermission(true);

        if (!currentDeviceId && audioInputs.length > 0) {
          const defaultDevice = audioInputs.find((d) => d.isDefault) || audioInputs[0];
          setCurrentDeviceId(defaultDevice.deviceId);
        }
      } else {
        // Just enumerate without permission
        await enumerateDevicesPassively();
      }
    } catch (err: any) {
      console.error("[RecordingDevices] Error fetching devices:", err);
      if (err.name === "NotAllowedError") {
        setHasPermission(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentDeviceId, hasPermission, enumerateDevicesPassively]);

  // Initial passive enumeration (NO permission prompt)
  useEffect(() => {
    enumerateDevicesPassively();

    // Listen for device changes
    const handleDeviceChange = () => {
      enumerateDevicesPassively();
    };
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [enumerateDevicesPassively]);

  // Select a device
  const selectDevice = useCallback((deviceId: string) => {
    setCurrentDeviceId(deviceId);
  }, []);

  // Request permission (only call from user gesture!)
  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
      await fetchDevices();
      return true;
    } catch (err) {
      console.error("[RecordingDevices] Permission denied:", err);
      setHasPermission(false);
      return false;
    }
  }, [fetchDevices]);

  return {
    devices,
    currentDeviceId,
    isLoading,
    hasPermission,
    selectDevice,
    refresh: fetchDevices,
    requestPermission,
  };
};
