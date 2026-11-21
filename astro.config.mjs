import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";

const EXCLUDED_SITEMAP_PATHS = [
  "/create-project/",
  "/api/",
  "/404",
  "/crear-proyecto",
  "/soluciones",
  "/para-quien",
  "/demostraciones",
  "/como-trabajamos",
  "/estudio",
  "/contacto",
  "/nosotros",
  "/servicios",
  "/casos",
  "/diagnostico",
  "/our-services",
  "/cl",
  "/industrias",
  "/politicas"
];

// Stable content revision date — update deliberately when public content changes (never auto-bump per build)
const CONTENT_LASTMOD = "2026-11-20T00:00:00.000Z";

export default defineConfig({
  site: "https://www.enix.studio",
  trailingSlash: "always",
  output: "static",
  adapter: vercel(),
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        if (page.includes("?")) return false;
        const { pathname } = new URL(page);
        return !EXCLUDED_SITEMAP_PATHS.some(
          (excluded) => pathname === excluded || pathname.startsWith(excluded)
        );
      },
      serialize(item) {
        return {
          ...item,
          lastmod: CONTENT_LASTMOD
        };
      }
    })
  ],
  redirects: {
    // Redirecciones 301 directas (1 salto) desde slugs en español y rutas legacy de v1
    "/crear-proyecto": { status: 301, destination: "/create-project/" },
    "/soluciones": { status: 301, destination: "/solutions/" },
    "/soluciones/sitios-web": { status: 301, destination: "/solutions/websites/" },
    "/soluciones/aplicaciones": { status: 301, destination: "/solutions/applications/" },
    "/soluciones/sistemas": { status: 301, destination: "/solutions/management-systems/" },
    "/soluciones/plataformas": { status: 301, destination: "/solutions/platforms/" },
    "/soluciones/automatizaciones": { status: 301, destination: "/solutions/automations/" },
    "/soluciones/inteligencia-artificial": { status: 301, destination: "/solutions/ai-solutions/" },
    "/para-quien/emprendedores": { status: 301, destination: "/for/entrepreneurs/" },
    "/para-quien/empresas": { status: 301, destination: "/for/businesses/" },
    "/demostraciones": { status: 301, destination: "/demos/" },
    "/demostraciones/reservas": { status: 301, destination: "/demos/bookings/" },
    "/demostraciones/gestion-de-pedidos": { status: 301, destination: "/demos/order-management/" },
    "/demostraciones/automatizacion": { status: 301, destination: "/demos/automation/" },
    "/como-trabajamos": { status: 301, destination: "/how-we-work/" },
    "/estudio": { status: 301, destination: "/studio/" },
    "/contacto": { status: 301, destination: "/contact/" },
    "/nosotros": { status: 301, destination: "/studio/" },
    "/politica-de-privacidad": { status: 301, destination: "/privacy/" },
    "/diagnostico": { status: 301, destination: "/create-project/" },
    "/our-services": { status: 301, destination: "/solutions/" },
    "/servicios": { status: 301, destination: "/solutions/" },
    "/servicios/catalogo": { status: 301, destination: "/solutions/" },
    "/servicios/diseno-y-desarrollo-web": { status: 301, destination: "/solutions/websites/" },
    "/servicios/desarrollo-web": { status: 301, destination: "/solutions/websites/" },
    "/servicios/diseno-ui-ux": { status: 301, destination: "/solutions/websites/" },
    "/servicios/landing-pages": { status: 301, destination: "/solutions/websites/" },
    "/servicios/ecommerce-y-catalogos": { status: 301, destination: "/solutions/websites/" },
    "/servicios/plataformas-e-integraciones": { status: 301, destination: "/solutions/platforms/" },
    "/servicios/automatizacion-ia": { status: 301, destination: "/solutions/automations/" },
    "/servicios/branding": { status: 301, destination: "/marketing/brand-design/" },
    "/servicios/estrategia-y-marca": { status: 301, destination: "/marketing/brand-design/" },
    "/servicios/seo": { status: 301, destination: "/marketing/seo-local/" },
    "/servicios/publicidad-digital": { status: 301, destination: "/marketing/digital-advertising/" },
    "/servicios/marketing-digital": { status: 301, destination: "/marketing/" },
    "/servicios/marketing-y-evolucion": { status: 301, destination: "/marketing/" },
    "/servicios/mantenimiento-web": { status: 301, destination: "/solutions/websites/" },
    "/servicios/analitica-conversion": { status: 301, destination: "/marketing/analytics-cro/" }
  },
  compressHTML: true,
  build: {
    inlineStylesheets: "auto"
  }
});
