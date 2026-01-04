import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function safeParseResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text || text.trim() === "") {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.log("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    // Fetch user's SoundCloud token from database (token never touches client)
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('user_api_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('provider', 'soundcloud')
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.log("No SoundCloud token found for user");
      return new Response(
        JSON.stringify({ error: "Not connected to SoundCloud" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenData.access_token;
    const { action, ...params } = await req.json();

    const headers = {
      Authorization: `OAuth ${accessToken}`,
      Accept: "application/json",
    };

    let response: Response;
    let data: any;

    switch (action) {
      case "get_me":
        console.log("Getting current user");
        response = await fetch("https://api.soundcloud.com/me", { headers });
        data = await safeParseResponse(response);
        break;

      case "get_playlists":
        console.log("Getting user playlists");
        response = await fetch("https://api.soundcloud.com/me/playlists?limit=50", { headers });
        data = await safeParseResponse(response);
        break;

      case "get_likes":
        console.log("Getting liked tracks");
        response = await fetch("https://api.soundcloud.com/me/likes?limit=50", { headers });
        data = await safeParseResponse(response);
        break;

      case "get_tracks":
        console.log("Getting user tracks");
        response = await fetch("https://api.soundcloud.com/me/tracks?limit=50", { headers });
        data = await safeParseResponse(response);
        break;

      case "get_stream":
        console.log("Getting stream");
        response = await fetch("https://api.soundcloud.com/me/activities?limit=50", { headers });
        data = await safeParseResponse(response);
        break;

      case "get_playlist_tracks":
        console.log("Getting playlist tracks:", params.playlistId);
        response = await fetch(`https://api.soundcloud.com/playlists/${params.playlistId}`, { headers });
        data = await safeParseResponse(response);
        break;

      case "search":
        console.log("Searching tracks:", params.query);
        const searchUrl = new URL("https://api.soundcloud.com/tracks");
        searchUrl.searchParams.append("q", params.query);
        searchUrl.searchParams.append("limit", "30");
        response = await fetch(searchUrl.toString(), { headers });
        data = await safeParseResponse(response);
        break;

      case "get_track":
        console.log("Getting track:", params.trackId);
        response = await fetch(`https://api.soundcloud.com/tracks/${params.trackId}`, { headers });
        data = await safeParseResponse(response);
        break;

      case "get_stream_url":
        console.log("Getting stream URL for track:", params.trackId);
        // First get the track to get stream info
        response = await fetch(`https://api.soundcloud.com/tracks/${params.trackId}`, { headers });
        const track = await safeParseResponse(response);
        
        if (track?.stream_url) {
          // Get the actual stream URL
          const streamResponse = await fetch(`${track.stream_url}?oauth_token=${accessToken}`, {
            redirect: "manual",
          });
          const streamUrl = streamResponse.headers.get("location") || `${track.stream_url}?oauth_token=${accessToken}`;
          data = { stream_url: streamUrl };
        } else if (track?.media?.transcodings) {
          // Use media transcodings for newer API
          const mp3Transcoding = track.media.transcodings.find(
            (t: any) => t.format.protocol === "progressive" && t.format.mime_type === "audio/mpeg"
          ) || track.media.transcodings[0];
          
          if (mp3Transcoding) {
            const streamResponse = await fetch(`${mp3Transcoding.url}?client_id=${Deno.env.get("SOUNDCLOUD_CLIENT_ID")}`, { headers });
            const streamData = await safeParseResponse(streamResponse);
            data = { stream_url: streamData?.url };
          }
        }
        break;

      case "get_recently_played":
        console.log("Getting recently played (from stream)");
        response = await fetch("https://api.soundcloud.com/me/play-history?limit=20", { headers });
        data = await safeParseResponse(response);
        break;

      default:
        throw new Error(`Invalid action: ${action}`);
    }

    if (response! && !response.ok) {
      const errorData = data || { error: "Unknown error" };
      console.error("SoundCloud API error:", errorData);
      throw new Error(errorData.error || errorData.errors?.[0]?.error_message || "API request failed");
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("SoundCloud proxy error:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
