import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Logística Hogareño",
    short_name: "Logística",
    description: "Sistema de gestión logística de depósito",
    start_url: "/control-general",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#060b18",
    theme_color: "#060b18",
    lang: "es",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
