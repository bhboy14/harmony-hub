import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function safeParseResponse(response: Response): Promise<any> {
  if (response.status === 204) return { success: true };
  const text = await response.text();
  if (!text) return { success: response.ok };
  try {
    return JSON.parse(text);
  } catch {
    if (!response.ok) throw new Error(`Spotify API error: ${response.status}`);
    return { success: true };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { action, accessToken, deviceId, uri, uris, position, volume, query, type } = await req.json();
    if (!accessToken) throw new Error("Access token required");

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    let response;
    // OFFICIAL SPOTIFY API ENDPOINT
    const BASE_URL = "https://api.spotify.com/v1/me/player";

    switch (action) {
      case "get_devices":
        response = await fetch(`${BASE_URL}/devices`, { headers });
        break;

      case "get_playback":
        response = await fetch(`${BASE_URL}`, { headers });
        break;

      case "play": {
        const playBody: any = {};

        // Spotify track URIs must be sent as `uris`, not `context_uri`
        if (Array.isArray(uris) && uris.length > 0) playBody.uris = uris;
        if (uri) {
          if (typeof uri === "string" && uri.startsWith("spotify:track:")) {
            playBody.uris = [uri];
          } else {
            playBody.context_uri = uri;
          }
        }
        if (position !== undefined) playBody.position_ms = position;

        response = await fetch(`${BASE_URL}/play${deviceId ? `?device_id=${deviceId}` : ""}`, {
          method: "PUT",
          headers,
          body: Object.keys(playBody).length > 0 ? JSON.stringify(playBody) : undefined,
        });
        break;
      }

      case "pause":
        response = await fetch(`${BASE_URL}/pause${deviceId ? `?device_id=${deviceId}` : ""}`, {
          method: "PUT",
          headers,
        });
        break;

      case "seek":
        // Logic to handle the progress bar interaction
        response = await fetch(`${BASE_URL}/seek?position_ms=${position}${deviceId ? `&device_id=${deviceId}` : ""}`, {
          method: "PUT",
          headers,
        });
        break;

      case "next":
        response = await fetch(`${BASE_URL}/next`, { method: "POST", headers });
        break;

      case "previous":
        response = await fetch(`${BASE_URL}/previous`, { method: "POST", headers });
        break;

      case "volume":
        response = await fetch(`${BASE_URL}/volume?volume_percent=${volume}`, {
          method: "PUT",
          headers,
        });
        break;

      case "transfer":
        response = await fetch(`${BASE_URL}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ device_ids: [deviceId], play: true }),
        });
        break;

      case "search":
        response = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type || "track"}&limit=20`,
          { headers },
        );
        break;

      case "get_playlists":
        response = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", { headers });
        break;

      case "get_saved_tracks":
        response = await fetch("https://api.spotify.com/v1/me/tracks?limit=50", { headers });
        break;

      case "get_recently_played":
        response = await fetch(`${BASE_URL}/recently-played?limit=20`, { headers });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const data = await safeParseResponse(response);

    // Propagate Spotify API errors to the client so UI can show a proper message
    if (!response.ok) {
      const message = data?.error?.message || data?.message || `Spotify API error: ${response.status}`;
      throw new Error(`Player command failed: ${message}`);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Spotify player error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
