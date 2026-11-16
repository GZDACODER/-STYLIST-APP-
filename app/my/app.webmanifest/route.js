// The home screen app for clients: adding My Pros to a phone's home screen
// opens /my full screen, like an app.
export function GET() {
  return Response.json(
    {
      name: "My Pros",
      short_name: "My Pros",
      description: "Your appointments with every pro you book on Clientele.",
      start_url: "/my",
      scope: "/",
      display: "standalone",
      background_color: "#F5F1EA",
      theme_color: "#F5F1EA",
      icons: [
        { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } }
  );
}
