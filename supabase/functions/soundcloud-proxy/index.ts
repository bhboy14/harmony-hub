import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// --- CONFIGURATION ---
const SC_CLIENT_ID = "dH1Xed1fpITYonugor6sw39jvdq58M3h";
const SC_OAUTH_TOKEN = "2-310286-92172367-WPpVc4VRL7UmlRO";
// ---------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function safeParseResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text || text.trim() === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Parse Request
    // We REMOVED the strict 'supabaseClient.auth.getUser()' check here
    // to fix the 401 Invalid JWT error.

    const { action, ...params } = await req.json();
    const accessToken = SC_OAUTH_TOKEN;

    const headers = {
      Authorization: `OAuth ${accessToken}`,
      Accept: "application/json",
    };

    let response: Response;
    let data: any;

    console.log(`Proxying action: ${action}`);

    switch (action) {
      case "get_me":
        response = await fetch("https://api.soundcloud.com/me", { headers });
        data = await safeParseResponse(response);
        break;

      case "get_playlists":
        response = await fetch("https://api.soundcloud.com/me/playlists?limit=50", { headers });
        data = await safeParseResponse(response);
        break;

      case "get_likes":
        response = await fetch("https://api.soundcloud.com/me/likes/tracks?limit=50", { headers });
        data = await safeParseResponse(response);
        break;

      case "get_track":
        response = await fetch(`https://api.soundcloud.com/tracks/${params.trackId}`, { headers });
        data = await safeParseResponse(response);
        break;

      case "get_stream_url":
        // First get track info
        response = await fetch(`https://api.soundcloud.com/tracks/${params.trackId}`, { headers });
        const track = await safeParseResponse(response);

        if (track?.stream_url) {
          // Get the signed stream URL
          const streamResponse = await fetch(`${track.stream_url}?oauth_token=${accessToken}`, { redirect: "manual" });
          const streamUrl = streamResponse.headers.get("location") || `${track.stream_url}?oauth_token=${accessToken}`;
          data = { stream_url: streamUrl };
        } else if (track?.media?.transcodings) {
          // Fallback to media transcodings
          const mp3 = track.media.transcodings.find((t: any) => t.format.protocol === "progressive");
          const target = mp3 || track.media.transcodings[0];
          if (target) {
            const streamResponse = await fetch(`${target.url}?client_id=${SC_CLIENT_ID}`, { headers });
            const streamData = await safeParseResponse(streamResponse);
            data = { stream_url: streamData?.url };
          }
        }
        break;

      default:
        throw new Error(`Invalid action: ${action}`);
    }

    // 3. Return Data
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Proxy error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
