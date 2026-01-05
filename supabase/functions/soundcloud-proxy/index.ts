import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CONFIGURATION ---
const SC_CLIENT_ID = "dH1Xed1fpITYonugor6sw39jvdq58M3h";
const SC_OAUTH_TOKEN = "OAuth 2-310286-92172367-WPpVc4VRL7UmlRO";
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- AUTHENTICATION ---
    // (Disabled for easier testing, similar to Music Assistant's internal proxy)
    /* const authHeader = req.headers.get("Authorization");
    if (!authHeader) { throw new Error("Unauthorized"); }
    // ... Supabase Auth Logic would go here ...
    */

    // Parse Request
    const { action, accessToken, ...params } = await req.json();

    // Use provided token or fallback
    const tokenToUse = accessToken || SC_OAUTH_TOKEN;

    // Headers for V2 API often just need the Client ID appended to the URL,
    // but we keep OAuth header for V1 endpoints (likes/playlists).
    const headers = {
      Authorization: `OAuth ${tokenToUse}`,
      Accept: "application/json",
    };

    let response: Response;
    let data: any;

    switch (action) {
      // --- V1 ENDPOINTS (Standard User Data) ---
      case "get_me":
        response = await fetch("https://api.soundcloud.com/me", { headers });
        data = await safeParseResponse(response);
        break;

      case "get_playlists":
        response = await fetch("https://api.soundcloud.com/me/playlists?limit=50", { headers });
        data = await safeParseResponse(response);
        break;

      case "get_likes":
        response = await fetch("https://api.soundcloud.com/me/likes?limit=50", { headers });
        data = await safeParseResponse(response);
        break;

      // --- V2 ENDPOINT (Music Assistant Approach for Streaming) ---
      case "get_stream":
        console.log("Starting V2 Stream Resolution...");
        const { trackUrl } = params;
        if (!trackUrl) throw new Error("trackUrl is required");

        // STEP 1: Resolve the Web URL to a Track Object using V2 API
        // Note: V2 uses 'api-v2.soundcloud.com'
        const resolveUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(trackUrl)}&client_id=${SC_CLIENT_ID}`;
        const resolveResp = await fetch(resolveUrl);

        if (!resolveResp.ok) {
          throw new Error(`Failed to resolve track: ${resolveResp.statusText}`);
        }

        const trackData = await resolveResp.json();

        // STEP 2: Find the best transcoding (Stream format)
        // We look for 'progressive' (standard MP3) or 'hls' (streaming)
        const transcodings = trackData.media?.transcodings || [];

        // Priority: Progressive (MP3) -> HLS -> First available
        const streamCandidate =
          transcodings.find((t: any) => t.format.protocol === "progressive") ||
          transcodings.find((t: any) => t.format.protocol === "hls") ||
          transcodings[0];

        if (!streamCandidate) {
          throw new Error("No streamable URL found in track metadata");
        }

        // STEP 3: Get the final playback URL
        // The transcoding URL requires the client_id to be attached again
        const streamUrlWithClient = `${streamCandidate.url}?client_id=${SC_CLIENT_ID}`;
        const finalStreamResp = await fetch(streamUrlWithClient);
        const finalStreamData = await finalStreamResp.json();

        // The actual playable link is inside the 'url' property
        data = {
          streamUrl: finalStreamData.url,
          title: trackData.title,
          artwork: trackData.artwork_url,
          duration: trackData.duration,
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Return the result
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Proxy Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
