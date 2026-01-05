import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // 1. Verify User is logged into Supabase (optional, but good practice)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized Supabase User" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 2. Parse Request
    const { action, accessToken, ...params } = await req.json();

    // 3. Use provided token OR fallback to hardcoded token
    const tokenToUse = accessToken || SC_OAUTH_TOKEN;

    if (!tokenToUse) {
      throw new Error("Access token required (none provided and no fallback found)");
    }

    const headers = {
      Authorization: `OAuth ${tokenToUse}`,
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
const response = await fetch(`https://api.soundcloud.com/resolve?url=${trackUrl}&client_id=${clientId}`);