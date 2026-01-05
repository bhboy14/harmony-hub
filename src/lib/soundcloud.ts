// src/lib/soundcloud.ts

const SC_API_BASE = "https://api.soundcloud.com";

export const soundCloudHeaders = () => {
  const token = localStorage.getItem("SC_OAUTH_TOKEN");
  return {
    Authorization: `OAuth ${token}`,
    "Content-Type": "application/json",
  };
};

/**
 * Helper to make authenticated requests to SoundCloud
 */
export const fetchSoundCloud = async (endpoint: string) => {
  // Ensure endpoint starts with /
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const headers = soundCloudHeaders();

  if (!headers.Authorization.includes("OAuth")) {
    console.warn("SoundCloud Token missing. Make sure App.tsx has initialized it.");
  }

  try {
    const response = await fetch(`${SC_API_BASE}${path}`, {
      method: "GET",
      headers: headers,
    });

    if (!response.ok) {
      console.error(`SoundCloud API Error: ${response.statusText}`);
      throw new Error(response.statusText);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching from SoundCloud:", error);
    return null;
  }
};

/**
 * Helper to get the Stream URL for a track
 */
export const getStreamUrl = async (trackUrl: string) => {
  const token = localStorage.getItem("SC_OAUTH_TOKEN");
  if (!token) return trackUrl;

  // Append the token to the stream URL so the audio element can play it
  const separator = trackUrl.includes("?") ? "&" : "?";
  return `${trackUrl}${separator}oauth_token=${token}`;
};
