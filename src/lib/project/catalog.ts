import { solutions } from "../../content/solutions.ts";
import { marketingServices } from "../../content/marketing.ts";

export interface UnifiedServiceItem {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  area: "development" | "marketing" | "brand";
  areaLabel: string;
  href: string;
  starterPrompt: string;
  category: string;
  previewType: string;
}

/**
 * Interleaved order of all 13 services (6 Development + 6 Marketing + 1 Branding).
 * First desktop viewport (3 cards) intentionally mixes development and marketing:
 * 1. Sitios web  2. Publicidad digital  3. Sistemas de gestión
 */
const INTERLEAVED_ORDER: Array<{ kind: "solution" | "marketing"; slug: string }> = [
  { kind: "solution", slug: "websites" },
  { kind: "marketing", slug: "digital-advertising" },
  { kind: "solution", slug: "management-systems" },
  { kind: "marketing", slug: "seo-local" },
  { kind: "solution", slug: "applications" },
  { kind: "marketing", slug: "digital-strategy" },
  { kind: "solution", slug: "platforms" },
  { kind: "marketing", slug: "content-social" },
  { kind: "solution", slug: "automations" },
  { kind: "marketing", slug: "email-crm-automation" },
  { kind: "solution", slug: "ai-solutions" },
  { kind: "marketing", slug: "analytics-cro" },
  { kind: "marketing", slug: "brand-design" }
];

export const UNIFIED_SERVICES: UnifiedServiceItem[] = INTERLEAVED_ORDER.map((entry) => {
  if (entry.kind === "solution") {
    const item = solutions.find((s) => s.slug === entry.slug)!;
    return {
      id: `svc-${item.slug}`,
      slug: item.slug,
      name: item.name,
      shortDescription: item.shortDescription,
      area: "development",
      areaLabel: "Desarrollo",
      href: `/solutions/${item.slug}/`,
      starterPrompt: item.starterPrompt,
      category: item.slug,
      previewType: item.previewType
    };
  }
  const item = marketingServices.find((m) => m.slug === entry.slug)!;
  return {
    id: `svc-${item.slug}`,
    slug: item.slug,
    name: item.name,
    shortDescription: item.shortDescription,
    area: item.slug === "brand-design" ? "brand" : "marketing",
    areaLabel: item.slug === "brand-design" ? "Marca" : "Marketing",
    href: `/marketing/${item.slug}/`,
    starterPrompt: item.starterPrompt,
    category: item.slug,
    previewType: item.previewType
  };
});

export interface PageContextEntry {
  pageId: string;
  pageTitle: string;
  hint: string;
  suggestedPrompt: string;
  categoryHint: string | null;
  quickPrompts: string[];
  recommendedDemo?: { label: string; href: string };
}

/**
 * Server-owned authorized page context map.
 * Used both for static contextual hints (zero AI calls on page load/navigation)
 * and for validating `pageId` on `/api/project-assistant/`.
 */
export const PAGE_CONTEXT_MAP: Record<string, PageContextEntry> = {
  "/": {
    pageId: "/",
    pageTitle: "Portada de ENIX Studio",
    hint: "¿Tienes una idea o necesidad concreta? Te ayudo a aterrizar el mejor punto de partida.",
    suggestedPrompt: "",
    categoryHint: null,
    quickPrompts: [
      "Tengo un negocio y quiero recibir reservas sin depender solo de WhatsApp.",
      "Quiero atraer más clientes con publicidad digital y una web clara.",
      "Necesito ordenar pedidos y operaciones que hoy llevamos en Excel."
    ]
  },
  "/solutions/": {
    pageId: "/solutions/",
    pageTitle: "Soluciones de desarrollo",
    hint: "¿Dudas entre web, aplicación o sistema a medida? Conversemos qué conviene para empezar.",
    suggestedPrompt: "Quiero evaluar qué tipo de solución digital conviene más para mi negocio.",
    categoryHint: null,
    quickPrompts: [
      "¿Qué me recomiendas para empezar sin sobredimensionar?",
      "Quiero combinar un sitio web con reservas o cotizaciones.",
      "Busco ordenar procesos internos con un sistema a medida."
    ]
  },
  "/solutions/websites/": {
    pageId: "/solutions/websites/",
    pageTitle: "Sitios web",
    hint: "¿Buscas renovar tu web o lanzar una nueva que genere consultas o reservas?",
    suggestedPrompt: "Quiero crear o renovar el sitio web de mi negocio para captar más consultas o reservas.",
    categoryHint: "websites",
    quickPrompts: [
      "¿Qué debería incluir una primera versión de mi sitio web?",
      "Tengo una web antigua y no genera consultas.",
      "Quiero una web con agenda de reservas y WhatsApp."
    ],
    recommendedDemo: { label: "Ver demo de reservas", href: "/demos/bookings/" }
  },
  "/solutions/applications/": {
    pageId: "/solutions/applications/",
    pageTitle: "Aplicaciones",
    hint: "¿Tienes una idea de aplicación? Te ayudo a separar lo esencial de una primera versión.",
    suggestedPrompt: "Quiero definir la primera versión de una aplicación para mis clientes o equipo.",
    categoryHint: "applications",
    quickPrompts: [
      "¿Conviene empezar con una app móvil o una aplicación web?",
      "Quiero validar una idea de servicio digital con clientes reales.",
      "Necesito una app para mi equipo en terreno."
    ],
    recommendedDemo: { label: "Ver demo de reservas", href: "/demos/bookings/" }
  },
  "/solutions/management-systems/": {
    pageId: "/solutions/management-systems/",
    pageTitle: "Sistemas de gestión",
    hint: "¿Coordinan pedidos, inventario o tareas entre Excel y WhatsApp? Veamos cómo ordenarlo.",
    suggestedPrompt: "Necesito un sistema de gestión para ordenar nuestra operación y reemplazar planillas sueltas.",
    categoryHint: "management-systems",
    quickPrompts: [
      "¿Cómo empezar a reemplazar planillas de Excel sin frenar la operación?",
      "Necesito roles para ventas, bodega y administración.",
      "Tengo técnicos en terreno que necesitan registrar trabajos desde el celular."
    ],
    recommendedDemo: { label: "Ver demo de pedidos y operación", href: "/demos/order-management/" }
  },
  "/solutions/platforms/": {
    pageId: "/solutions/platforms/",
    pageTitle: "Portales y plataformas",
    hint: "¿Necesitas un portal privado para clientes, proveedores o colaboradores?",
    suggestedPrompt: "Quiero construir un portal privado para compartir seguimiento, solicitudes y documentos.",
    categoryHint: "platforms",
    quickPrompts: [
      "Quiero un portal B2B para que mis clientes hagan pedidos y vean estados.",
      "¿Qué perfiles y permisos deberíamos definir primero?",
      "Necesito integrar el portal con nuestro sistema actual."
    ]
  },
  "/solutions/automations/": {
    pageId: "/solutions/automations/",
    pageTitle: "Automatizaciones",
    hint: "¿Qué tarea repetitiva te quita más tiempo hoy? Veamos cómo conectarla con control.",
    suggestedPrompt: "Quiero automatizar un flujo repetitivo entre formularios, correo, planillas o CRM.",
    categoryHint: "automations",
    quickPrompts: [
      "Quiero que las consultas de la web lleguen ordenadas al CRM y correo.",
      "Copiamos datos a mano entre planillas y facturación.",
      "¿Qué automatizaciones conviene implementar primero?"
    ],
    recommendedDemo: { label: "Ver demo de automatización", href: "/demos/automation/" }
  },
  "/solutions/ai-solutions/": {
    pageId: "/solutions/ai-solutions/",
    pageTitle: "Soluciones de IA",
    hint: "¿Quieres aplicar IA sobre tus documentos o procesos manteniendo control humano?",
    suggestedPrompt: "Quiero evaluar una solución de IA aplicada sobre nuestros documentos o flujo comercial.",
    categoryHint: "ai-solutions",
    quickPrompts: [
      "Queremos un asistente interno sobre nuestros manuales y catálogos.",
      "¿Cómo evitar que la IA invente información frente a clientes?",
      "Quiero clasificar solicitudes entrantes con revisión humana."
    ]
  },
  "/marketing/": {
    pageId: "/marketing/",
    pageTitle: "Marketing digital y marca",
    hint: "¿Buscas atraer más clientes, lanzar campañas o mejorar tu marca? Definamos por dónde partir.",
    suggestedPrompt: "Quiero ordenar el marketing digital de mi negocio para atraer más consultas o reservas.",
    categoryHint: "marketing",
    quickPrompts: [
      "¿Qué conviene hacer primero si tengo presupuesto acotado?",
      "Quiero hacer campañas en Google o Instagram pero no sé si mi web está lista.",
      "¿Cómo separan la inversión en anuncios de los honorarios?"
    ]
  },
  "/marketing/digital-strategy/": {
    pageId: "/marketing/digital-strategy/",
    pageTitle: "Estrategia digital",
    hint: "¿Quieres claridad sobre canales, mensajes y prioridades antes de invertir en pauta?",
    suggestedPrompt: "Quiero definir una estrategia digital clara antes de invertir en campañas o contenidos.",
    categoryHint: "digital-strategy",
    quickPrompts: [
      "¿Qué incluye un diagnóstico y estrategia digital inicial?",
      "No sé si me conviene empezar por Google Ads, Instagram o SEO.",
      "Quiero alinear mi web con mi estrategia comercial."
    ]
  },
  "/marketing/digital-advertising/": {
    pageId: "/marketing/digital-advertising/",
    pageTitle: "Publicidad digital",
    hint: "¿Evalúas invertir en Google Ads o Meta Ads? Conversemos objetivo, pauta y página de captación.",
    suggestedPrompt: "Quiero planificar campañas de publicidad digital en Google Ads o Meta Ads.",
    categoryHint: "digital-advertising",
    quickPrompts: [
      "Tengo un presupuesto mensual para anuncios y quiero saber cómo partir.",
      "Ya probé anuncios antes pero no trajeron consultas buenas.",
      "¿Necesito una página de captación aparte para las campañas?"
    ]
  },
  "/marketing/seo-local/": {
    pageId: "/marketing/seo-local/",
    pageTitle: "SEO y presencia local",
    hint: "¿Quieres aparecer mejor cuando buscan tu servicio en tu ciudad o en Google?",
    suggestedPrompt: "Quiero mejorar el SEO y la presencia local de mi negocio en buscadores.",
    categoryHint: "seo-local",
    quickPrompts: [
      "Tengo un negocio local y quiero que nos encuentren mejor en Google.",
      "¿Qué revisan primero en una auditoría SEO?",
      "Quiero combinar SEO local con una mejora de nuestra web."
    ]
  },
  "/marketing/content-social/": {
    pageId: "/marketing/content-social/",
    pageTitle: "Contenido y redes sociales",
    hint: "¿Quieres ordenar tus redes y contenidos con una línea clara y sostenible?",
    suggestedPrompt: "Quiero ordenar el contenido y las redes sociales de mi negocio.",
    categoryHint: "content-social",
    quickPrompts: [
      "Busco un acompañamiento mensual de contenido y diseño de piezas.",
      "Quiero un kit inicial de plantillas y estrategia editorial.",
      "¿Cómo coordinan contenido con campañas pagadas?"
    ]
  },
  "/marketing/email-crm-automation/": {
    pageId: "/marketing/email-crm-automation/",
    pageTitle: "Email y automatización comercial",
    hint: "¿Se enfrían consultas por falta de seguimiento? Veamos cómo ordenarlo.",
    suggestedPrompt: "Quiero implementar seguimiento por correo y automatización comercial para mis consultas.",
    categoryHint: "email-crm-automation",
    quickPrompts: [
      "Queremos responder rápido y hacer seguimiento automático a cotizaciones.",
      "¿Se puede conectar con nuestro CRM o planillas actuales?",
      "¿Es un trabajo puntual o acompañamiento mensual?"
    ]
  },
  "/marketing/analytics-cro/": {
    pageId: "/marketing/analytics-cro/",
    pageTitle: "Analítica y conversión",
    hint: "¿Recibes visitas pero pocas consultas? Podemos revisar medición y recorridos.",
    suggestedPrompt: "Quiero mejorar la medición y conversión de mi sitio web actual.",
    categoryHint: "analytics-cro",
    quickPrompts: [
      "No sabemos qué canales realmente generan consultas.",
      "Tenemos visitas pero pocos formularios o reservas completadas.",
      "¿Qué eventos conviene medir primero?"
    ]
  },
  "/marketing/brand-design/": {
    pageId: "/marketing/brand-design/",
    pageTitle: "Branding y diseño de marca",
    hint: "¿Necesitas una identidad completa o piezas puntuales para salir a comunicar?",
    suggestedPrompt: "Quiero trabajar la identidad de marca o materiales gráficos de mi negocio.",
    categoryHint: "brand-design",
    quickPrompts: [
      "Necesito renovar mi identidad visual completa antes de hacer la web.",
      "Ya tengo marca y solo necesito piezas para campañas.",
      "Quiero unificar marca, web y redes sociales."
    ]
  },
  "/demos/": {
    pageId: "/demos/",
    pageTitle: "Demostraciones interactivas",
    hint: "¿Viste algo en las demos parecido a lo que necesitas? Podemos adaptarlo a tu negocio.",
    suggestedPrompt: "Vi las demostraciones interactivas y quiero adaptar un flujo parecido a mi negocio.",
    categoryHint: null,
    quickPrompts: [
      "Quiero algo parecido a la demo de reservas para mis clientes.",
      "Necesito un tablero de pedidos como la demo de operación.",
      "Me interesa automatizar derivación de consultas."
    ]
  },
  "/demos/bookings/": {
    pageId: "/demos/bookings/",
    pageTitle: "Demo de reservas y agenda",
    hint: "¿Te serviría un flujo de reservas así adaptado a tus horarios y servicios?",
    suggestedPrompt: "Quiero adaptar un flujo de reservas en línea parecido a la demo para mi negocio.",
    categoryHint: "websites",
    quickPrompts: [
      "¿Qué se necesita para lanzar una primera versión con reservas?",
      "Quiero que confirme por WhatsApp o correo.",
      "Además de reservas, quiero atraer clientes nuevos."
    ],
    recommendedDemo: { label: "Ver demo de reservas", href: "/demos/bookings/" }
  },
  "/demos/orders/": {
    pageId: "/demos/orders/",
    pageTitle: "Demo de pedidos y operación",
    hint: "¿Tu equipo coordina pedidos o despacho con pasos parecidos a esta demo?",
    suggestedPrompt: "Quiero un sistema de gestión de pedidos y estados adaptado a nuestro equipo.",
    categoryHint: "management-systems",
    quickPrompts: [
      "Tenemos ventas, bodega y despacho trabajando en Excel.",
      "¿Se puede empezar con un módulo simple y crecer después?",
      "Necesitamos alertas y reportes exportables."
    ],
    recommendedDemo: { label: "Ver demo de pedidos", href: "/demos/orders/" }
  },
  "/demos/automations/": {
    pageId: "/demos/automations/",
    pageTitle: "Demo de automatización de solicitudes",
    hint: "¿Quieres automatizar la recepción y clasificación de consultas como en esta demo?",
    suggestedPrompt: "Quiero automatizar la recepción y seguimiento de consultas en mi negocio.",
    categoryHint: "automations",
    quickPrompts: [
      "Recibimos consultas por web y correo y tardamos en derivarlas.",
      "Queremos conectar formularios con nuestro CRM.",
      "¿Qué pasa cuando llega una solicitud incompleta?"
    ],
    recommendedDemo: { label: "Ver demo de automatización", href: "/demos/automation/" }
  },
  "/for/entrepreneurs/": {
    pageId: "/for/entrepreneurs/",
    pageTitle: "Para emprendedores y negocios",
    hint: "¿Estás impulsando tu negocio? Te ayudo a elegir una primera versión realista.",
    suggestedPrompt: "Estoy impulsando mi negocio y quiero definir una primera versión digital clara.",
    categoryHint: null,
    quickPrompts: [
      "¿Qué me recomiendas para empezar sin gastar de más?",
      "Quiero una web profesional y empezar a captar clientes.",
      "Tengo una idea de app y quiero aterrizar lo esencial."
    ]
  },
  "/for/businesses/": {
    pageId: "/for/businesses/",
    pageTitle: "Para empresas y operaciones",
    hint: "¿Buscas ordenar operación entre áreas o conectar sistemas existentes? Conversemos.",
    suggestedPrompt: "En nuestra empresa buscamos ordenar procesos, conectar sistemas o mejorar captación B2B.",
    categoryHint: "management-systems",
    quickPrompts: [
      "Tenemos varios equipos trabajando en planillas separadas.",
      "Necesitamos un portal para clientes o proveedores B2B.",
      "Queremos mejorar nuestra captación comercial y analítica."
    ]
  },
  "/how-we-work/": {
    pageId: "/how-we-work/",
    pageTitle: "Cómo trabajamos",
    hint: "¿Tienes dudas sobre etapas, entregables o cómo evaluar tu proyecto con ENIX?",
    suggestedPrompt: "Quiero entender cómo sería el proceso para evaluar y lanzar mi proyecto.",
    categoryHint: null,
    quickPrompts: [
      "¿Cómo se prepara una propuesta de alcance y plazos?",
      "¿Podemos empezar con una primera etapa acotada?",
      "Quiero armar mi ficha para pedir evaluación."
    ]
  },
  "/studio/": {
    pageId: "/studio/",
    pageTitle: "ENIX Studio",
    hint: "¿Quieres ver cómo encaja tu proyecto con el equipo de ENIX Studio?",
    suggestedPrompt: "Quiero contarte sobre mi negocio para ver cómo podemos trabajar juntos.",
    categoryHint: null,
    quickPrompts: [
      "¿Trabajan desarrollo y marketing juntos en un mismo proyecto?",
      "¿Cómo empiezo a definir mi proyecto?",
      "Quiero hablar directamente con el equipo."
    ]
  },
  "/contact/": {
    pageId: "/contact/",
    pageTitle: "Contacto",
    hint: "Si prefieres ordenar primero tu idea antes de escribir al equipo, te ayudo aquí.",
    suggestedPrompt: "Quiero ordenar los puntos clave de mi proyecto antes de enviarlo al equipo.",
    categoryHint: null,
    quickPrompts: [
      "Ayúdame a preparar un resumen claro para pedir evaluación.",
      "¿Qué información conviene incluir al cotizar?",
      "Quiero combinar web y campañas."
    ]
  }
};

export function normalizePageId(pathname: string | undefined | null): string {
  if (!pathname || typeof pathname !== "string") return "/";
  const clean = pathname.split("?")[0]?.split("#")[0]?.trim() || "/";
  const withSlash = clean.endsWith("/") ? clean : `${clean}/`;
  return PAGE_CONTEXT_MAP[withSlash] ? withSlash : "/";
}

export function getPageContext(pathname: string | undefined | null): PageContextEntry {
  const id = normalizePageId(pathname);
  return PAGE_CONTEXT_MAP[id] || PAGE_CONTEXT_MAP["/"];
}

export const ALLOWED_INTERNAL_LINKS = new Set<string>([
  "/",
  "/create-project/",
  "/solutions/",
  "/solutions/websites/",
  "/solutions/applications/",
  "/solutions/management-systems/",
  "/solutions/platforms/",
  "/solutions/automations/",
  "/solutions/ai-solutions/",
  "/marketing/",
  "/marketing/digital-strategy/",
  "/marketing/digital-advertising/",
  "/marketing/seo-local/",
  "/marketing/content-social/",
  "/marketing/email-crm-automation/",
  "/marketing/analytics-cro/",
  "/marketing/brand-design/",
  "/demos/",
  "/demos/bookings/",
  "/demos/order-management/",
  "/demos/automation/",
  "/for/entrepreneurs/",
  "/for/businesses/",
  "/how-we-work/",
  "/studio/",
  "/contact/",
  "/privacy/"
]);

export function isAllowedInternalLink(href: string): boolean {
  if (!href || typeof href !== "string") return false;
  const clean = href.split("?")[0]?.split("#")[0]?.trim() || "";
  return ALLOWED_INTERNAL_LINKS.has(clean);
}
