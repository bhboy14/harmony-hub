import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to safely parse response - handles non-JSON and empty responses
async function safeParseResponse(response: Response): Promise<any> {
  if (response.status === 204) {
    return { success: true };
  }

  const text = await response.text();
  if (!text) {
    return { success: response.ok };
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error("Non-JSON response:", text.substring(0, 100));
    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status} - ${text.substring(0, 100)}`);
    }
    return { success: true, raw: text };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication (this function is configured with verify_jwt=false,
    // so we must validate the bearer token ourselves)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.log("Authentication failed:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, accessToken, deviceId, uri, uris, position, volume, query, type } =
      await req.json();

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
        data = await safeParseResponse(response);
        break;

      case "get_playback":
        console.log("Getting playback state");
        response = await fetch("https://api.spotify.com/v1/me/player", { headers });
        data = response.status === 204 ? null : await safeParseResponse(response);
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
        data = await safeParseResponse(response);
        break;

      case "pause":
        console.log("Pausing playback");
        response = await fetch("https://api.spotify.com/v1/me/player/pause", {
          method: "PUT",
          headers,
        });
        data = await safeParseResponse(response);
        break;

      case "next":
        console.log("Skipping to next track");
        response = await fetch("https://api.spotify.com/v1/me/player/next", {
          method: "POST",
          headers,
        });
        data = await safeParseResponse(response);
        break;

      case "previous":
        console.log("Going to previous track");
        response = await fetch("https://api.spotify.com/v1/me/player/previous", {
          method: "POST",
          headers,
        });
        data = await safeParseResponse(response);
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
        data = await safeParseResponse(response);
        break;

      case "search":
        console.log("Searching for", query, "type", type);
        response = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type || "track"}&limit=20`,
          { headers }
        );
        data = await safeParseResponse(response);
        break;

      case "get_playlists":
        console.log("Getting user playlists");
        response = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", { headers });
        data = await safeParseResponse(response);
        break;

      case "get_saved_tracks":
        console.log("Getting saved tracks");
        response = await fetch("https://api.spotify.com/v1/me/tracks?limit=50", { headers });
        data = await safeParseResponse(response);
        break;

      case "transfer":
        console.log("Transferring playback to device", deviceId);
        response = await fetch("https://api.spotify.com/v1/me/player", {
          method: "PUT",
          headers,
          body: JSON.stringify({ device_ids: [deviceId], play: true }),
        });
        data = await safeParseResponse(response);
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
