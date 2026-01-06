import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// --- MUSIC ASSISTANT APPROACH: Fixed credentials ---
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse Request - no JWT validation needed for Music Assistant approach
    const body = await req.json();
    const { action, ...params } = body;

    console.log("SoundCloud Proxy - Action:", action);

    // Headers for SoundCloud V1 API
    const headers = {
      Authorization: `OAuth ${SC_OAUTH_TOKEN}`,
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

      // --- V2 ENDPOINTS (Music Assistant Approach for Streaming) ---
      case "get_stream_url":
      case "get_stream":
        console.log("Starting V2 Stream Resolution...");
        const { trackUrl, trackId } = params;
        
        // Build the track URL if only trackId is provided
        const urlToResolve = trackUrl || `https://soundcloud.com/tracks/${trackId}`;
        
        if (!urlToResolve && !trackId) {
          throw new Error("trackUrl or trackId is required");
        }

        // For stream by ID, use the V2 API directly
        if (trackId && !trackUrl) {
          const trackApiUrl = `https://api-v2.soundcloud.com/tracks/${trackId}?client_id=${SC_CLIENT_ID}`;
          const trackResp = await fetch(trackApiUrl);
          
          if (!trackResp.ok) {
            throw new Error(`Failed to get track: ${trackResp.statusText}`);
          }
          
          const trackInfo = await trackResp.json();
          const transcodings = trackInfo.media?.transcodings || [];
          
          const streamCandidate =
            transcodings.find((t: any) => t.format.protocol === "progressive") ||
            transcodings.find((t: any) => t.format.protocol === "hls") ||
            transcodings[0];

          if (!streamCandidate) {
            throw new Error("No streamable URL found");
          }

          const streamUrlWithClient = `${streamCandidate.url}?client_id=${SC_CLIENT_ID}`;
          const finalStreamResp = await fetch(streamUrlWithClient);
          const finalStreamData = await finalStreamResp.json();

          data = {
            stream_url: finalStreamData.url,
            title: trackInfo.title,
            artwork: trackInfo.artwork_url,
            duration: trackInfo.duration,
          };
        } else {
          // Resolve from URL
          const resolveUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(urlToResolve)}&client_id=${SC_CLIENT_ID}`;
          const resolveResp = await fetch(resolveUrl);

          if (!resolveResp.ok) {
            throw new Error(`Failed to resolve track: ${resolveResp.statusText}`);
          }

          const trackData = await resolveResp.json();
          const transcodings = trackData.media?.transcodings || [];

          const streamCandidate =
            transcodings.find((t: any) => t.format.protocol === "progressive") ||
            transcodings.find((t: any) => t.format.protocol === "hls") ||
            transcodings[0];

          if (!streamCandidate) {
            throw new Error("No streamable URL found in track metadata");
          }

          const streamUrlWithClient = `${streamCandidate.url}?client_id=${SC_CLIENT_ID}`;
          const finalStreamResp = await fetch(streamUrlWithClient);
          const finalStreamData = await finalStreamResp.json();

          data = {
            stream_url: finalStreamData.url,
            streamUrl: finalStreamData.url,
            title: trackData.title,
            artwork: trackData.artwork_url,
            duration: trackData.duration,
          };
        }
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
