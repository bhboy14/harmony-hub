import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { action, code, redirectUri, refreshToken } = await req.json();
    const SOUNDCLOUD_CLIENT_ID = Deno.env.get("SOUNDCLOUD_CLIENT_ID");
    const SOUNDCLOUD_CLIENT_SECRET = Deno.env.get("SOUNDCLOUD_CLIENT_SECRET");

    if (!SOUNDCLOUD_CLIENT_ID || !SOUNDCLOUD_CLIENT_SECRET) {
      throw new Error("SoundCloud credentials not configured");
    }

    if (action === "exchange") {
      // Exchange authorization code for tokens
      console.log("Exchanging SoundCloud code for tokens");
      const response = await fetch("https://api.soundcloud.com/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: SOUNDCLOUD_CLIENT_ID,
          client_secret: SOUNDCLOUD_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      });

      const data = await response.json();
      console.log("Token exchange response status:", response.status);
      
      if (!response.ok) {
        console.error("Token exchange error:", data);
        throw new Error(data.error_description || data.error || "Failed to exchange code");
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refresh") {
      // Refresh access token
      console.log("Refreshing SoundCloud access token");
      const response = await fetch("https://api.soundcloud.com/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: SOUNDCLOUD_CLIENT_ID,
          client_secret: SOUNDCLOUD_CLIENT_SECRET,
          refresh_token: refreshToken,
        }),
      });

      const data = await response.json();
      console.log("Token refresh response status:", response.status);
      
      if (!response.ok) {
        console.error("Token refresh error:", data);
        throw new Error(data.error_description || data.error || "Failed to refresh token");
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_auth_url") {
      // Generate SoundCloud authorization URL - use empty scope as SoundCloud no longer allows non-expiring tokens
      const authUrl = new URL("https://api.soundcloud.com/connect");
      authUrl.searchParams.append("client_id", SOUNDCLOUD_CLIENT_ID);
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("redirect_uri", redirectUri);
      // Empty scope as per SoundCloud API requirements

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error: unknown) {
    console.error("SoundCloud auth error:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred processing your request";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
