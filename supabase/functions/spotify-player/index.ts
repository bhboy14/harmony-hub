import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, accessToken, deviceId, uri, uris, position, volume } = await req.json();

    if (!accessToken) {
      throw new Error("Access token required");
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    let response;
    let data;

    switch (action) {
      case "get_devices":
        console.log("Getting available devices");
        response = await fetch("https://api.spotify.com/v1/me/player/devices", { headers });
        data = await response.json();
        break;

      case "get_playback":
        console.log("Getting playback state");
        response = await fetch("https://api.spotify.com/v1/me/player", { headers });
        if (response.status === 204) {
          data = null;
        } else {
          data = await response.json();
        }
        break;

      case "play":
        console.log("Starting playback", { deviceId, uri, uris });
        const playBody: any = {};
        if (uri) playBody.context_uri = uri;
        if (uris) playBody.uris = uris;
        if (position !== undefined) playBody.position_ms = position;
        
        response = await fetch(
          `https://api.spotify.com/v1/me/player/play${deviceId ? `?device_id=${deviceId}` : ""}`,
          {
            method: "PUT",
            headers,
            body: Object.keys(playBody).length > 0 ? JSON.stringify(playBody) : undefined,
          }
        );
        data = response.status === 204 ? { success: true } : await response.json();
        break;

      case "pause":
        console.log("Pausing playback");
        response = await fetch("https://api.spotify.com/v1/me/player/pause", {
          method: "PUT",
          headers,
        });
        data = response.status === 204 ? { success: true } : await response.json();
        break;

      case "next":
        console.log("Skipping to next track");
        response = await fetch("https://api.spotify.com/v1/me/player/next", {
          method: "POST",
          headers,
        });
        data = response.status === 204 ? { success: true } : await response.json();
        break;

      case "previous":
        console.log("Going to previous track");
        response = await fetch("https://api.spotify.com/v1/me/player/previous", {
          method: "POST",
          headers,
        });
        data = response.status === 204 ? { success: true } : await response.json();
        break;

      case "volume":
        console.log("Setting volume to", volume);
        response = await fetch(
          `https://api.spotify.com/v1/me/player/volume?volume_percent=${volume}`,
          {
            method: "PUT",
            headers,
          }
        );
        data = response.status === 204 ? { success: true } : await response.json();
        break;

      case "search":
        const { query, type = "track" } = await req.json();
        console.log("Searching for", query, "type", type);
        response = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=20`,
          { headers }
        );
        data = await response.json();
        break;

      case "get_playlists":
        console.log("Getting user playlists");
        response = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", { headers });
        data = await response.json();
        break;

      case "get_saved_tracks":
        console.log("Getting saved tracks");
        response = await fetch("https://api.spotify.com/v1/me/tracks?limit=50", { headers });
        data = await response.json();
        break;

      case "transfer":
        console.log("Transferring playback to device", deviceId);
        response = await fetch("https://api.spotify.com/v1/me/player", {
          method: "PUT",
          headers,
          body: JSON.stringify({ device_ids: [deviceId], play: true }),
        });
        data = response.status === 204 ? { success: true } : await response.json();
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    if (response && !response.ok && response.status !== 204) {
      console.error("Spotify API error:", data);
      throw new Error(data?.error?.message || "Spotify API error");
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Spotify player error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
