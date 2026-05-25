import type { MetadataRoute } from "next";

import { copy } from "@/lib/copy";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: copy.app.name,
    short_name: copy.app.name,
    description: copy.app.description,
    start_url: "/app",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
