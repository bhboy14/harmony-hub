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
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      // First request permission to get accurate labels
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop tracks immediately - we just needed permission
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);

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

      // Set default if not already set
      if (!currentDeviceId && audioInputs.length > 0) {
        const defaultDevice = audioInputs.find((d) => d.isDefault) || audioInputs[0];
        setCurrentDeviceId(defaultDevice.deviceId);
      }
    } catch (err: any) {
      console.error("[RecordingDevices] Error fetching devices:", err);
      if (err.name === "NotAllowedError") {
        setHasPermission(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentDeviceId]);

  // Initial fetch
  useEffect(() => {
    fetchDevices();

    // Listen for device changes
    const handleDeviceChange = () => {
      fetchDevices();
    };
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [fetchDevices]);

  // Select a device
  const selectDevice = useCallback((deviceId: string) => {
    setCurrentDeviceId(deviceId);
  }, []);

  // Request permission
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
