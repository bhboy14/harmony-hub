import { supabase } from "@/integrations/supabase/client";

// This file now talks to your Supabase Edge Function to avoid CORS errors.

/**
 * Helper to make authenticated requests via the Supabase Proxy
 */
export const fetchSoundCloud = async (endpoint: string) => {
  let action = "";
  const params: any = {};

  // 1. Map the endpoint URL to the specific Proxy Action
  if (endpoint === "/me") {
    action = "get_me";
  } else if (endpoint === "/me/playlists") {
    action = "get_playlists";
  } else if (endpoint === "/me/likes/tracks") {
    action = "get_likes";
  } else if (endpoint.startsWith("/tracks/")) {
    action = "get_track";
    // Extract ID from string "/tracks/12345"
    const parts = endpoint.split("/");
    if (parts[2]) params.trackId = parts[2];
  } else {
    console.warn("Unknown SoundCloud endpoint:", endpoint);
    return null;
  }

  try {
    // 2. Call the Supabase Edge Function
    // Ensure your function in Supabase is named 'soundcloud-proxy'
    const { data, error } = await supabase.functions.invoke("soundcloud-proxy", {
      body: { action, ...params },
    });

    if (error) {
      console.error("Supabase Proxy Error:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Network Error:", err);
    return null;
  }
};

/**
 * Helper to get the Stream URL via Proxy
 */
export const getStreamUrl = async (trackUrl: string) => {
  // trackUrl usually looks like "https://api.soundcloud.com/tracks/123456/stream"
  // We need to extract the ID to ask the proxy for a signed link.

  // Regex to find the track ID
  const match = trackUrl.match(/tracks\/(\d+)/);
  const trackId = match ? match[1] : null;

  if (!trackId) {
    console.error("Could not extract Track ID from URL:", trackUrl);
    return trackUrl;
  }

  try {
    const { data, error } = await supabase.functions.invoke("soundcloud-proxy", {
      body: {
        action: "get_stream_url",
        trackId: trackId,
      },
    });

    if (error || !data?.stream_url) {
      console.error("Failed to get stream URL from proxy", error);
      return trackUrl;
    }

    return data.stream_url;
  } catch (e) {
    console.error("Error getting stream URL:", e);
    return trackUrl;
  }
};
