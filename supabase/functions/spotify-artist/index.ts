import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, artistName, artistId } = await req.json();
    console.log('Spotify Artist action:', action, artistName || artistId);

    // Get user's Spotify token
    const { data: tokenData, error: tokenError } = await supabase
      .from('spotify_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Spotify not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = tokenData.access_token;

    if (action === 'search_artist') {
      // Search for artist by name
      const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`;
      const searchResponse = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!searchResponse.ok) {
        const errText = await searchResponse.text();
        console.error('Spotify search error:', errText);
        return new Response(JSON.stringify({ error: 'Failed to search artist' }), {
          status: searchResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const searchData = await searchResponse.json();
      const artist = searchData.artists?.items?.[0];

      if (!artist) {
        return new Response(JSON.stringify({ artist: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get full artist details
      const artistUrl = `https://api.spotify.com/v1/artists/${artist.id}`;
      const artistResponse = await fetch(artistUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      const artistData = await artistResponse.json();

      return new Response(JSON.stringify({
        artist: {
          spotify_id: artistData.id,
          name: artistData.name,
          genres: artistData.genres || [],
          popularity: artistData.popularity,
          followers: artistData.followers?.total || 0,
          profile_image: artistData.images?.[0]?.url || null,
          // Spotify API doesn't provide biography directly - would need additional scraping
          biography: null,
          banner_url: artistData.images?.[0]?.url || null, // Use large image as banner
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'get_artist') {
      // Get artist by Spotify ID
      const artistUrl = `https://api.spotify.com/v1/artists/${artistId}`;
      const artistResponse = await fetch(artistUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!artistResponse.ok) {
        return new Response(JSON.stringify({ error: 'Artist not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const artistData = await artistResponse.json();

      return new Response(JSON.stringify({
        artist: {
          spotify_id: artistData.id,
          name: artistData.name,
          genres: artistData.genres || [],
          popularity: artistData.popularity,
          followers: artistData.followers?.total || 0,
          profile_image: artistData.images?.[0]?.url || null,
          biography: null,
          banner_url: artistData.images?.[0]?.url || null,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'get_top_tracks') {
      // Get artist's top tracks
      const topTracksUrl = `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`;
      const topTracksResponse = await fetch(topTracksUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!topTracksResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to get top tracks' }), {
          status: topTracksResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const topTracksData = await topTracksResponse.json();

      return new Response(JSON.stringify({
        tracks: topTracksData.tracks.map((track: any) => ({
          id: track.id,
          name: track.name,
          uri: track.uri,
          duration_ms: track.duration_ms,
          album: {
            name: track.album.name,
            images: track.album.images,
          },
        }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'search_artwork') {
      // Search for track artwork by title and artist
      const { title, artist } = await req.json();
      const query = artist ? `track:${title} artist:${artist}` : `track:${title}`;
      const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!searchResponse.ok) {
        return new Response(JSON.stringify({ artwork: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const searchData = await searchResponse.json();
      const track = searchData.tracks?.items?.[0];

      return new Response(JSON.stringify({
        artwork: track?.album?.images?.[0]?.url || null,
        matchedTrack: track ? {
          spotify_id: track.id,
          spotify_uri: track.uri,
          title: track.name,
          artist: track.artists.map((a: any) => a.name).join(', '),
        } : null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: unknown) {
    console.error('Error in spotify-artist function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
