import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://www.enix.studio",
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    sitemap({
      changefreq: "weekly",
      priority: 0.8,
      filter: (page) =>
        !page.includes("?") &&
        !page.includes("/api/") &&
        !page.includes("/404") &&
        !page.includes("/politicas/") &&
        !page.includes("/diagnostico") &&
        !page.includes("/demo") &&
        !page.includes("/draft") &&
        !page.includes("/prueba"),
    }),
  ],
  redirects: {
    "/our-services": {
      status: 301,
      destination: "/#capabilities",
    },
    "/diagnostico": {
      status: 301,
      destination: "/#contact",
    },
    "/servicios/catalogo": {
      status: 301,
      destination: "/#capabilities",
    },
  },


  output: "server",
  adapter: vercel(),
  compressHTML: true,
  build: {
    inlineStylesheets: "auto",
  },
});
