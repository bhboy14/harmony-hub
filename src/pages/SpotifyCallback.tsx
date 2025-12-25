import { useEffect } from "react";

const SpotifyCallback = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (code) {
      // Send code to parent window
      if (window.opener) {
        window.opener.postMessage({ type: "spotify-callback", code }, window.location.origin);
        window.close();
      }
    } else if (error) {
      if (window.opener) {
        window.opener.postMessage({ type: "spotify-callback", error }, window.location.origin);
        window.close();
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Connecting to Spotify...</p>
      </div>
    </div>
  );
};

export default SpotifyCallback;
