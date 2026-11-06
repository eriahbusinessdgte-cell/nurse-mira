import type { MetadataRoute } from "next";

// Lets students "Add to Home Screen": the app opens full-screen with the Nurse Mira icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nurse Mira",
    short_name: "Nurse Mira",
    description: "AI study companion for Filipino nursing students",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f7fb",
    theme_color: "#2148c0",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
