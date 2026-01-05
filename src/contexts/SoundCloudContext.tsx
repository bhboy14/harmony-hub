import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchSoundCloud } from "@/lib/soundcloud"; // Use the lib file we made
import { useToast } from "@/hooks/use-toast";

interface SoundCloudContextType {
  isConnected: boolean;
  isConnecting: boolean;
  userProfile: any | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const SoundCloudContext = createContext<SoundCloudContextType | undefined>(undefined);

export const SoundCloudProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true); // Start as true to prevent flash of login screen
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const initializeAuth = async () => {
      // 1. CHECK LOCAL STORAGE (The hardcoded keys from App.tsx)
      const token = localStorage.getItem("SC_OAUTH_TOKEN");

      if (token) {
        console.log("SoundCloudContext: Found hardcoded token, auto-authenticating...");
        try {
          // Verify token works by fetching profile
          const profile = await fetchSoundCloud("/me");

          if (profile && !profile.errors) {
            setUserProfile(profile);
            setIsConnected(true);
            console.log("SoundCloudContext: Auto-authentication successful!");
          } else {
            console.warn("SoundCloudContext: Token appears invalid or expired.");
            setIsConnected(false);
          }
        } catch (error) {
          console.error("SoundCloudContext: Auto-auth failed", error);
          setIsConnected(false);
        }
      } else {
        console.log("SoundCloudContext: No token found in storage.");
        setIsConnected(false);
      }

      setIsConnecting(false);
    };

    initializeAuth();
  }, []);

  const connect = async () => {
    // This is now a fallback if auto-auth fails
    setIsConnecting(true);
    try {
      const token = localStorage.getItem("SC_OAUTH_TOKEN");
      if (!token) throw new Error("Credentials missing in App.tsx");

      const profile = await fetchSoundCloud("/me");
      if (profile) {
        setUserProfile(profile);
        setIsConnected(true);
        toast({ title: "Connected to SoundCloud" });
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Could not connect with provided credentials.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    // Optional: Decide if you want "disconnect" to actually wipe the hardcoded keys
    // For now, we just reset state, but a refresh will auto-login again.
    setUserProfile(null);
    setIsConnected(false);
    toast({ title: "Disconnected" });
  };

  return (
    <SoundCloudContext.Provider value={{ isConnected, isConnecting, userProfile, connect, disconnect }}>
      {children}
    </SoundCloudContext.Provider>
  );
};

export const useSoundCloud = () => {
  const context = useContext(SoundCloudContext);
  if (context === undefined) {
    throw new Error("useSoundCloud must be used within a SoundCloudProvider");
  }
  return context;
};
