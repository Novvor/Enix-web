import {
  CATEGORY_LABELS,
  MARKETING_CATEGORY_SLUGS,
  type AssistantTurnResponse,
  type BriefPatch,
  type ChatOption,
  type ProjectBrief,
  type ProjectStage,
  type ProjectTrack,
  type Requirement,
  deriveProvisionalTitle,
  makeRequirement
} from "./schema.ts";

export interface GuidedStep {
  id: string;
  stage: ProjectStage;
}

export const DEVELOPMENT_STEPS: GuidedStep[] = [
  { id: "category", stage: "idea" },
  { id: "users", stage: "needs" },
  { id: "process", stage: "needs" },
  { id: "essentials", stage: "priorities" },
  { id: "integrations", stage: "priorities" },
  { id: "timeline", stage: "priorities" },
  { id: "summary", stage: "summary" }
];

export const MARKETING_STEPS: GuidedStep[] = [
  { id: "mkt_offer_goal", stage: "idea" },
  { id: "mkt_audience_territory", stage: "needs" },
  { id: "mkt_assets_history", stage: "needs" },
  { id: "mkt_modality", stage: "priorities" },
  { id: "mkt_budget_dates", stage: "priorities" },
  { id: "summary", stage: "summary" }
];

export const COMBINED_STEPS: GuidedStep[] = [
  { id: "comb_scope", stage: "idea" },
  { id: "mkt_audience_territory", stage: "needs" },
  { id: "mkt_assets_history", stage: "needs" },
  { id: "comb_priorities", stage: "priorities" },
  { id: "mkt_modality", stage: "priorities" },
  { id: "mkt_budget_dates", stage: "priorities" },
  { id: "summary", stage: "summary" }
];

export function getStepsForTrack(track: ProjectTrack): GuidedStep[] {
  if (track === "marketing") return MARKETING_STEPS;
  if (track === "combined") return COMBINED_STEPS;
  return DEVELOPMENT_STEPS;
}

export const GUIDED_STEPS = DEVELOPMENT_STEPS;

const DEV_REGEX =
  /(sitio web|nueva web|p[aá]gina web|web nueva|\bweb\b|app|aplicaci[oó]n|sistema|inventario|pedidos|bodega|portal|plataforma|automatiz|integraci[oó]n|erp|crm|inteligencia artificial|\bia\b|chatbot|software)/i;

const MKT_REGEX =
  /(marketing|publicidad|campa[nñ]a|anuncios|google ads|meta ads|facebook|instagram|redes sociales|\bseo\b|posicionamiento|b[uú]squedas locales|atraer m[aá]s clientes|conseguir m[aá]s clientes|captar clientes|conseguir m[aá]s reservas|conseguir reservas|estrategia digital|branding|dise[nñ]o de marca|mejorar mi marca|identidad de marca|email marketing|conversi[oó]n|contenido editorial)/i;

const OFF_TOPIC_OR_INJECTION_REGEX =
  /(ignora (todas )?las instrucciones|ignore previous instructions|act[uú]a como|system prompt|prompt del sistema|instrucciones internas|dame una receta|receta de (cocina|pasta|torta)|escribe un poema|hazme la tarea|traduce este texto|resuelve esta ecuaci[oó]n|cu[aá]ntos habitantes|qui[eé]n gan[oó] el mundial|chiste sobre|jailbreak|dan mode|escribe c[oó]digo python para|finanzas personales|criptomonedas|apuestas)/i;

const ENIX_DOMAIN_SIGNAL_REGEX =
  /(sitio web|p[aá]gina web|\bweb\b|landing|tienda|cat[aá]logo|app|aplicaci[oó]n|sistema|inventario|pedidos|bodega|portal|plataforma|automatiz|integraci[oó]n|erp|crm|inteligencia artificial|\bia\b|chatbot|software|marketing|publicidad|campa[nñ]a|anuncios|google ads|meta ads|instagram|facebook|redes sociales|\bseo\b|posicionamiento|b[uú]squedas locales|clientes|reservas|citas|agenda|peluquer[ií]a|cafeter[ií]a|restaurante|cl[ií]nica|mantenimiento|t[eé]cnicos|excel|whatsapp|marca|branding|logo|identidad|cotiz|precio|cu[aá]nto cuesta|plazo|presupuesto|proyecto|negocio|empresa|enix)/i;

export function isOffTopicOrAbuse(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  if (!OFF_TOPIC_OR_INJECTION_REGEX.test(clean)) return false;
  // Prompt injection & code-generation abuse are ALWAYS blocked even if mixed with ENIX keywords
  if (/(ignora (todas )?las instrucciones|ignore previous instructions|system prompt|prompt del sistema|instrucciones internas|jailbreak|dan mode|act[uú]a como|escribe c[oó]digo python para)/i.test(clean)) {
    return true;
  }
  // If it's a pure off-topic request without ENIX domain signal, block it
  return !ENIX_DOMAIN_SIGNAL_REGEX.test(clean);
}

export function isMixedOffTopicRequest(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  if (/(ignora (todas )?las instrucciones|ignore previous instructions|system prompt|prompt del sistema|instrucciones internas|jailbreak|dan mode|act[uú]a como)/i.test(clean)) {
    return false;
  }
  return OFF_TOPIC_OR_INJECTION_REGEX.test(clean) && ENIX_DOMAIN_SIGNAL_REGEX.test(clean);
}

export function inferTrackFromInput(idea: string, category: string | null): ProjectTrack {
  if (category === "combined") return "combined";
  const text = idea.trim();
  const hasDev = DEV_REGEX.test(text);
  const hasMkt = MKT_REGEX.test(text);

  if (hasDev && hasMkt) return "combined";
  if (category && MARKETING_CATEGORY_SLUGS.has(category)) {
    return hasDev ? "combined" : "marketing";
  }
  if (hasMkt) return "marketing";
  return "development";
}

export function inferCategoryFromIdea(idea: string, track?: ProjectTrack): string | null {
  const text = idea.toLowerCase();
  const resolvedTrack = track || inferTrackFromInput(idea, null);

  if (resolvedTrack === "combined") return "combined";

  if (resolvedTrack === "marketing") {
    if (/(marca|branding|identidad|logo|piezas gr[aá]ficas)/.test(text)) return "brand-design";
    if (/(publicidad|google ads|meta ads|anuncios|campa[nñ]a|pauta|instagram|facebook)/.test(text)) {
      return "digital-advertising";
    }
    if (/(seo|google|org[aá]nico|b[uú]squedas locales|maps)/.test(text)) return "seo-local";
    if (/(redes|contenido|editorial|publicaciones)/.test(text)) return "content-social";
    if (/(email|correo|seguimiento|crm)/.test(text)) return "email-crm-automation";
    if (/(anal[ií]tica|conversi[oó]n|medici[oó]n|embudo)/.test(text)) return "analytics-cro";
    if (/(estrategia|atraer|captar|clientes|reservas)/.test(text)) return "digital-strategy";
    return "marketing";
  }

  // ENX-04: Prioritize explicit website intent before secondary keywords like "whatsapp" or "reservas"
  if (/(quiero|necesito|crear|hacer|dise[nñ]ar|nueva|renovar)\s+(un\s+|una\s+)?(sitio\s+|p[aá]gina\s+)?web\b|sitio web|p[aá]gina web/.test(text)) {
    return "websites";
  }
  if (/(pedido|inventario|bodega|excel|planilla|gesti[oó]n|erp|stock|despacho|ordenar la operaci|mantenimiento|t[eé]cnicos en terreno)/.test(text)) {
    return "management-systems";
  }
  if (/(\bia\b|inteligencia artificial|chatbot|asistente de ia|\brag\b|resumir documentos|manuales internos)/.test(text)) {
    return "ai-solutions";
  }
  if (/(automatiz|conectar|sincroniz|webhook|zapier|repetitiv|flujo autom)/.test(text)) {
    return "automations";
  }
  if (/(portal|clientes puedan|proveedores|distribuidores|colaboradores|b2b|intranet)/.test(text)) {
    return "platforms";
  }
  if (/(peluquer[ií]a|barber[ií]a|sal[oó]n|est[eé]tica|cursos|asesor[ií]as|poco profesional)/.test(text)) {
    return "websites";
  }
  if (/(app|aplicaci[oó]n|celular|m[oó]vil|ios|android|reservar|reserva|agenda)/.test(text)) {
    return "applications";
  }
  if (/(web|sitio|p[aá]gina|landing|tienda|cat[aá]logo|presencia digital)/.test(text)) {
    return "websites";
  }
  return null;
}

/** Extracts explicitly declared capabilities from the user's initial idea (ENX-04). */
function extractDeclaredCapabilities(idea: string): {
  requirements: Requirement[];
  integrations: Requirement[];
} {
  const text = idea.toLowerCase();
  const requirements: Requirement[] = [];
  const integrations: Requirement[] = [];

  if (/(reserva|agend|cita|hora online)/.test(text)) {
    requirements.push(makeRequirement("Reservas online integradas", "confirmed", "user", "initial", "dec"));
  }
  if (/(pago|abono|cobro|webpay|mercado pago|tarjeta)/.test(text)) {
    requirements.push(makeRequirement("Pagos o abonos en línea", "confirmed", "user", "initial", "dec"));
  }
  if (/(whatsapp|recordatorio)/.test(text)) {
    integrations.push(makeRequirement("Recordatorios o avisos por WhatsApp", "confirmed", "user", "initial", "dec"));
  }

  return { requirements, integrations };
}

/** Parses free-text timeline, ad spend, and service fees cleanly (ENX-01). */
export function parseMarketingBudgetAndDates(raw: string): {
  timeline: string | null;
  adSpend: string | null;
  serviceBudget: string | null;
} {
  // Split on sentence boundaries only (do NOT split thousands separators like "300.000")
  const sentences = raw
    .split(/(?:\.(?:\s+|$)|[!?\n]+|;\s*)/)
    .map((s) => s.trim())
    .filter(Boolean);

  let timeline: string | null = null;
  let adSpend: string | null = null;
  let serviceBudget: string | null = null;

  for (const part of sentences) {
    const low = part.toLowerCase();
    if (/(anuncio|pauta|publicidad|ads|meta|google)/.test(low) && /(presupuesto|inversi[oó]n|clp|usd|\$|mes|mensual|cotizar|definir)/.test(low)) {
      const cleaned = part.replace(/^.*?:\s*/, "").trim();
      adSpend = cleaned || part;
    } else if (/(honorario|servicio|enix|gesti[oó]n|agencia)/.test(low)) {
      const cleaned = part.replace(/^.*?:\s*/, "").trim();
      serviceBudget = cleaned || part;
    } else if (/(lanzar|empezar|iniciar|inicio|mes|meses|semana|semanas|trimestre|fecha|plazo|pr[oó]ximo)/.test(low)) {
      timeline = timeline ? `${timeline}. ${part}` : part;
    }
  }

  if (!timeline && !adSpend && !serviceBudget) {
    timeline = raw.trim();
  }

  return { timeline, adSpend, serviceBudget };
}

export function inferAudienceFromText(text: string): "entrepreneur" | "business" | "undetermined" {
  const t = text.toLowerCase();
  if (/(emprend|mi negocio|restaurante|cl[ií]nica|tienda|primera versi[oó]n|lanzar mi|proyecto personal|independiente)/.test(t)) {
    return "entrepreneur";
  }
  if (/(empresa|equipos|bodega|administraci[oó]n|gerencia|distribuidora|sucursales|erp|b2b|operaci[oó]n)/.test(t)) {
    return "business";
  }
  return "undetermined";
}

function getDomainSuggestions(category: string | null, track: ProjectTrack): Requirement[] {
  if (track === "combined") {
    return [
      makeRequirement("Desarrollo: sitio web o página de captación optimizada para móvil", "suggested", "assistant", "initial", "sug"),
      makeRequirement("Marketing: estrategia de canales, mensajes y estructura inicial de campañas", "suggested", "assistant", "initial", "sug"),
      makeRequirement("Medición: seguimiento de consultas, reservas o formularios", "suggested", "assistant", "initial", "sug"),
      makeRequirement("Automatización: derivación de contactos al correo o CRM", "suggested", "assistant", "later", "sug")
    ];
  }

  switch (category) {
    case "digital-advertising":
      return [
        makeRequirement("Estructura de campañas en Google Ads y/o Meta Ads con anuncios y segmentación", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Piezas publicitarias y mensajes orientados a la acción", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Página de captación específica para recibir el tráfico de campañas", "suggested", "assistant", "later", "sug")
      ];
    case "seo-local":
      return [
        makeRequirement("Auditoría técnica y estructura de páginas por intención de búsqueda", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Optimización de presencia local (ficha de negocio y coherencia de datos)", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Plan editorial de contenidos orgánicos", "suggested", "assistant", "later", "sug")
      ];
    case "brand-design":
      return [
        makeRequirement("Definir si se requiere identidad de marca completa o solo piezas para campaña", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Sistema visual base (paleta, tipografía y tono de mensajes)", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Kit de materiales para web y redes sociales", "suggested", "assistant", "later", "sug")
      ];
    case "marketing":
    case "digital-strategy":
    case "content-social":
    case "email-crm-automation":
    case "analytics-cro":
      return [
        makeRequirement("Diagnóstico de canales actuales, propuesta de valor y plan de acción", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Configuración de analítica y eventos de conversión clave", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Secuencia de seguimiento comercial por correo o automatización", "suggested", "assistant", "later", "sug")
      ];
    case "websites":
      return [
        makeRequirement("Páginas claras por servicio con llamado a la acción", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Formulario de contacto calificado o agenda de citas", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Blog o sección de novedades administrable", "suggested", "assistant", "later", "sug")
      ];
    case "applications":
      return [
        makeRequirement("Registro simple y perfil de usuario", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Notificaciones por correo o aviso de estado", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Panel de métricas y reportes avanzados", "suggested", "assistant", "later", "sug")
      ];
    case "management-systems":
      return [
        makeRequirement("Tablero de pedidos o inventario con estados y responsables", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Alertas de stock o pendientes críticos", "suggested", "assistant", "later", "sug"),
        makeRequirement("Exportación de reportes operativos a Excel o PDF", "suggested", "assistant", "later", "sug")
      ];
    case "platforms":
      return [
        makeRequirement("Acceso privado con permisos por tipo de usuario", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Historial de solicitudes y descarga de documentos", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Notificaciones automáticas ante cambios de estado", "suggested", "assistant", "later", "sug")
      ];
    case "automations":
      return [
        makeRequirement("Validación y clasificación automática de entradas", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Aviso inmediato a una persona si falta un dato", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Registro histórico de ejecuciones y errores", "suggested", "assistant", "later", "sug")
      ];
    case "ai-solutions":
      return [
        makeRequirement("Consulta acotada únicamente a fuentes aprobadas", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Revisión humana obligatoria antes de enviar respuestas externas", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Panel de preguntas frecuentes sin respuesta para mejorar fuentes", "suggested", "assistant", "later", "sug")
      ];
    default:
      return [
        makeRequirement("Definir el flujo principal de la primera versión", "suggested", "assistant", "initial", "sug"),
        makeRequirement("Panel administrativo básico para gestionar contenidos", "suggested", "assistant", "later", "sug")
      ];
  }
}

function getMarketingIndicatorsSuggestions(category: string | null): Requirement[] {
  if (category === "seo-local") {
    return [
      makeRequirement("Visibilidad en búsquedas locales y clics orgánicos cualificados", "suggested", "assistant", "initial", "ind"),
      makeRequirement("Consultas o llamadas iniciadas desde búsqueda orgánica", "suggested", "assistant", "initial", "ind")
    ];
  }
  return [
    makeRequirement("Consultas, reservas o solicitudes calificadas recibidas", "suggested", "assistant", "initial", "ind"),
    makeRequirement("Tasa de conversión y costo referencial por oportunidad", "suggested", "assistant", "initial", "ind")
  ];
}

export function getQuestionForStep(stepId: string, brief: ProjectBrief): {
  stage: ProjectStage;
  question: string;
  options: ChatOption[];
} {
  const cat = brief.category;

  switch (stepId) {
    // --- MARKETING & COMBINED STEPS ---
    case "mkt_offer_goal":
      return {
        stage: "idea",
        question: "¿Qué ofrece tu negocio y cuál es el resultado comercial principal que quieres conseguir?",
        options: [
          { id: "mg-1", label: "Conseguir más reservas o citas", value: "Conseguir más reservas o citas directas" },
          { id: "mg-2", label: "Generar consultas y cotizaciones", value: "Generar consultas y cotizaciones calificadas" },
          { id: "mg-3", label: "Aumentar ventas online o en tienda", value: "Aumentar ventas online o tráfico a tienda" },
          { id: "mg-4", label: "Posicionar o renovar mi marca", value: "Renovar imagen de marca y presencia digital" },
          { id: "mg-skip", label: "Por definir", value: "__unknown__", kind: "neutral" }
        ]
      };

    case "comb_scope":
      return {
        stage: "idea",
        question: "Veo que combinas desarrollo y marketing. ¿Cuál es el objetivo comercial principal que deben lograr juntos?",
        options: [
          { id: "cs-1", label: "Nueva web + captación de consultas", value: "Lanzar web nueva y captar consultas calificadas con estrategia y campañas" },
          { id: "cs-2", label: "Web o app + conseguir reservas", value: "Facilitar reservas en línea y atraer clientes con publicidad y SEO local" },
          { id: "cs-3", label: "Renovar marca + web + contenido", value: "Renovar marca, construir web clara y ordenar contenido comercial" },
          { id: "cs-skip", label: "Por definir", value: "__unknown__", kind: "neutral" }
        ]
      };

    case "mkt_audience_territory":
      return {
        stage: "needs",
        question: "¿A qué público buscas llegar y en qué ciudad, región o país operas?",
        options: [
          { id: "ma-1", label: "Clientes locales en mi ciudad", value: "Clientes finales en zona local / ciudad específica" },
          { id: "ma-2", label: "Todo el país (B2C)", value: "Clientes particulares a nivel nacional" },
          { id: "ma-3", label: "Empresas B2B en Chile / Latam", value: "Empresas y equipos B2B en Chile o Latinoamérica" },
          { id: "ma-skip", label: "Por definir", value: "__unknown__", kind: "neutral" }
        ]
      };

    case "mkt_assets_history":
      return {
        stage: "needs",
        question: "¿Qué web, redes o contenidos tienes hoy y qué acciones de marketing ya probaste?",
        options: [
          { id: "mh-1", label: "Tengo redes activas, sin web optimizada", value: "Redes activas, sin web optimizada" },
          { id: "mh-2", label: "Ya probé anuncios pero con pocos resultados", value: "Ya probé anuncios anteriormente, pero con pocos resultados" },
          { id: "mh-3", label: "Empezamos casi desde cero", value: "Empezamos desde cero en canales digitales y contenidos" },
          { id: "mh-skip", label: "Por definir", value: "__unknown__", kind: "neutral" }
        ]
      };

    case "comb_priorities":
      return {
        stage: "priorities",
        question: "Para coordinar desarrollo y marketing en un solo proyecto, ¿qué conviene resolver primero?",
        options: [
          { id: "cp-1", label: "Primero la web/landing y medición, luego campañas", value: "Priorizar web de captación + analítica y luego activar campañas" },
          { id: "cp-2", label: "Estrategia + marca + web en paralelo", value: "Definir estrategia y mensajes junto con la construcción de la web" },
          { id: "cp-3", label: "Web con reservas + SEO local y publicidad", value: "Implementar reservas/contacto en la web junto con presencia local y campañas" },
          { id: "cp-skip", label: "Por definir", value: "__unknown__", kind: "neutral" }
        ]
      };

    case "mkt_modality":
      return {
        stage: "priorities",
        question: "¿Buscas un trabajo puntual o un acompañamiento periódico mensual?",
        options: [
          { id: "mm-1", label: "Trabajo puntual (diagnóstico, lanzamiento o piezas)", value: "one-time" },
          { id: "mm-2", label: "Acompañamiento periódico (campañas, contenido y mejora)", value: "ongoing" },
          { id: "mm-3", label: "Primero un trabajo puntual y luego evaluar continuidad", value: "one-time-then-ongoing" },
          { id: "mm-skip", label: "Por definir", value: "__unknown__", kind: "neutral" }
        ]
      };

    case "mkt_budget_dates":
      return {
        stage: "priorities",
        question: "¿Tienes alguna fecha objetivo o referencia de inversión? (Separamos siempre la inversión en anuncios de los honorarios de servicio.)",
        options: [
          { id: "mb-1", label: "Empezar este mes · Inversión por definir", value: "Inicio ideal este mes; inversión publicitaria y honorarios por definir" },
          { id: "mb-2", label: "Próximo 1–2 meses · Pauta acotada inicial", value: "Lanzamiento en 1 a 2 meses con inversión publicitaria inicial acotada" },
          { id: "mb-3", label: "Próximo trimestre · Evaluando alcance", value: "Planificado para el próximo trimestre; presupuestos por definir" },
          { id: "mb-skip", label: "Dejar fechas e inversión por definir", value: "__unknown__", kind: "neutral" }
        ]
      };

    // --- DEVELOPMENT STEPS ---
    case "category":
      return {
        stage: "idea",
        question: "¿Qué tipo de solución o servicio se acerca más a lo que tienes en mente?",
        options: [
          { id: "c-web", label: "Sitio web", value: "websites" },
          { id: "c-app", label: "Aplicación", value: "applications" },
          { id: "c-sys", label: "Sistema de gestión", value: "management-systems" },
          { id: "c-mkt", label: "Marketing digital / campañas", value: "marketing" },
          { id: "c-comb", label: "Web + Marketing digital", value: "combined" },
          { id: "c-auto", label: "Automatización o IA", value: "automations" },
          { id: "c-none", label: "Por definir", value: "undetermined", kind: "neutral" }
        ]
      };

    case "users": {
      if (cat === "management-systems") {
        return {
          stage: "needs",
          question: "¿Quiénes necesitarán usar el sistema en el día a día?",
          options: [
            { id: "u-1", label: "Ventas y administración", value: "Ventas y administración" },
            { id: "u-2", label: "También bodega o despacho", value: "Ventas, administración y bodega" },
            { id: "u-3", label: "También clientes externos", value: "Equipo interno y clientes externos" },
            { id: "u-4", label: "Solo yo o un equipo pequeño", value: "Equipo pequeño / dirección del negocio" },
            { id: "u-skip", label: "Por definir", value: "__unknown__", kind: "neutral" }
          ]
        };
      }
      if (cat === "websites") {
        return {
          stage: "needs",
          question: "¿Quién visita principalmente tu web y qué debería poder hacer ahí?",
          options: [
            { id: "u-1", label: "Clientes nuevos que buscan cotizar", value: "Clientes nuevos que buscan cotizar o escribir" },
            { id: "u-2", label: "Clientes que quieren reservar hora", value: "Clientes que necesitan agendar o reservar en línea" },
            { id: "u-3", label: "Empresas B2B revisando catálogo", value: "Empresas B2B que consultan servicios o catálogo" },
            { id: "u-4", label: "Compradores de tienda online", value: "Compradores que desean comprar directamente" },
            { id: "u-skip", label: "Omitir por ahora", value: "__skip__", kind: "neutral" }
          ]
        };
      }
      return {
        stage: "needs",
        question: "¿Quiénes serán las personas usuarias principales de esta solución?",
        options: [
          { id: "u-1", label: "Mis clientes finales", value: "Clientes finales" },
          { id: "u-2", label: "Mi equipo interno", value: "Equipo interno de operación" },
          { id: "u-3", label: "Clientes y equipo interno", value: "Clientes y equipo interno con roles distintos" },
          { id: "u-4", label: "Colaboradores o proveedores", value: "Colaboradores, socios o proveedores" },
          { id: "u-skip", label: "Por definir", value: "__unknown__", kind: "neutral" }
        ]
      };
    }

    case "process": {
      if (cat === "websites") {
        return {
          stage: "needs",
          question: "¿Qué situación tienen hoy con su web o contenidos?",
          options: [
            { id: "p-1", label: "Empezamos desde cero", value: "No tenemos sitio web actual; empezamos desde cero" },
            { id: "p-2", label: "Tenemos web pero no convierte", value: "Ya tenemos web pero está desactualizada y no genera consultas" },
            { id: "p-3", label: "Tenemos textos y fotos listos", value: "Contamos con identidad y contenidos base para renovar la web" },
            { id: "p-skip", label: "Omitir por ahora", value: "__skip__", kind: "neutral" }
          ]
        };
      }
      if (cat === "automations") {
        return {
          stage: "needs",
          question: "¿Qué dispara hoy la tarea repetitiva y qué resultado esperas?",
          options: [
            { id: "p-1", label: "Llega un formulario o correo", value: "Al llegar un formulario o correo, clasificar y registrar automáticamente" },
            { id: "p-2", label: "Mover datos entre planillas y CRM", value: "Sincronizar datos entre planillas, CRM y avisos al equipo" },
            { id: "p-3", label: "Seguimiento de cotizaciones o pagos", value: "Automatizar recordatorios y seguimiento de estados" },
            { id: "p-skip", label: "Por definir", value: "__unknown__", kind: "neutral" }
          ]
        };
      }
      if (cat === "ai-solutions") {
        return {
          stage: "needs",
          question: "¿Qué información o tarea quieres asistir con IA?",
          options: [
            { id: "p-1", label: "Consultar documentos o manuales", value: "Consultar manuales, catálogos técnicos o políticas internas" },
            { id: "p-2", label: "Clasificar y preparar borradores", value: "Clasificar solicitudes entrantes y preparar borradores para revisión humana" },
            { id: "p-3", label: "Atender consultas frecuentes", value: "Responder preguntas frecuentes con información verificada" },
            { id: "p-skip", label: "Por definir", value: "__unknown__", kind: "neutral" }
          ]
        };
      }
      return {
        stage: "needs",
        question: "¿Cómo resuelven hoy este proceso y qué resultado concreto buscas?",
        options: [
          { id: "p-1", label: "Con WhatsApp, correos y Excel", value: "Hoy se coordina por WhatsApp, correo y Excel; buscamos centralizarlo" },
          { id: "p-2", label: "Es una idea nueva sin proceso previo", value: "Es un servicio nuevo que necesita una primera versión funcional" },
          { id: "p-3", label: "Usamos software que nos queda corto", value: "Usamos herramientas actuales que no se adaptan bien al flujo real" },
          { id: "p-skip", label: "Omitir por ahora", value: "__skip__", kind: "neutral" }
        ]
      };
    }

    case "essentials":
      return {
        stage: "priorities",
        question: "Para la primera versión, ¿qué es lo más importante resolver primero?",
        options: [
          { id: "e-1", label: "Captar consultas o reservas", value: "Captar solicitudes o reservas con información completa" },
          { id: "e-2", label: "Ordenar estados y responsables", value: "Centralizar registros con estados claros y responsables por equipo" },
          { id: "e-3", label: "Lanzar versión simple para validar", value: "Lanzar una primera versión enfocada en el flujo central" },
          { id: "e-4", label: "Conectar pagos o cobros", value: "Integrar flujo de cobro o confirmación en línea" },
          { id: "e-skip", label: "Omitir por ahora", value: "__skip__", kind: "neutral" }
        ]
      };

    case "integrations":
      return {
        stage: "priorities",
        question: "¿Necesitas conectar alguna herramienta o sistema que ya utilicen?",
        options: [
          { id: "i-1", label: "Correo y WhatsApp", value: "Notificaciones por correo o WhatsApp" },
          { id: "i-2", label: "CRM, ERP o facturación", value: "Conexión con CRM, ERP o sistema de facturación existente" },
          { id: "i-3", label: "Pagos en línea o calendario", value: "Pasarela de pagos o calendario compartido" },
          { id: "i-4", label: "Ninguna por ahora", value: "Sin integraciones externas en la primera etapa" },
          { id: "i-skip", label: "Por definir", value: "__unknown__", kind: "neutral" }
        ]
      };

    case "timeline":
      return {
        stage: "priorities",
        question: "Como referencia para planificar, ¿tienes algún plazo o expectativa de lanzamiento?",
        options: [
          { id: "t-1", label: "Lo antes posible (1–2 meses)", value: "Prioridad inmediata (1 a 2 meses)" },
          { id: "t-2", label: "Próximo trimestre", value: "Planificado para el próximo trimestre" },
          { id: "t-3", label: "Sin fecha fija, explorando", value: "Sin fecha cerrada; evaluando alcance e inversión" },
          { id: "t-skip", label: "Omitir por ahora", value: "__skip__", kind: "neutral" }
        ]
      };

    default:
      return {
        stage: "summary",
        question:
          "Tu ficha de proyecto está lista para revisar. Puedes editar campos directamente, confirmar o quitar sugerencias, ajustar presupuestos o modalidades y descargar el resumen.",
        options: []
      };
  }
}

export function startGuidedSession(
  initialIdea: string,
  initialCategory: string | null = null
): {
  track: ProjectTrack;
  briefPatch: BriefPatch;
  stepIndex: number;
  interpretation: string;
  question: string;
  stage: ProjectStage;
  stepId: string;
  options: ChatOption[];
} {
  const cleanIdea = initialIdea.trim();
  const track = inferTrackFromInput(cleanIdea, initialCategory);
  const detectedCategory =
    initialCategory && initialCategory !== "undetermined"
      ? track === "combined"
        ? "combined"
        : initialCategory
      : cleanIdea
        ? inferCategoryFromIdea(cleanIdea, track)
        : null;
  const detectedAudience = cleanIdea ? inferAudienceFromText(cleanIdea) : "undetermined";

  const patch: BriefPatch = {
    track,
    title: deriveProvisionalTitle(cleanIdea, detectedCategory),
    goal: cleanIdea || "",
    category: detectedCategory,
    audience: detectedAudience
  };

  if (cleanIdea) {
    const declared = extractDeclaredCapabilities(cleanIdea);
    patch.addRequirements = [
      makeRequirement(
        cleanIdea.length > 140 ? `${cleanIdea.slice(0, 137)}…` : cleanIdea,
        "confirmed",
        "user",
        "initial",
        "idea"
      ),
      ...declared.requirements
    ];
    if (declared.integrations.length > 0) {
      patch.addIntegrations = declared.integrations;
    }
    if (track === "marketing" || track === "combined") {
      patch.commercialGoal = cleanIdea;
      patch.addIndicators = getMarketingIndicatorsSuggestions(detectedCategory);
    }
  }

  const steps = getStepsForTrack(track);
  let startStepIndex = 0;

  if (track === "development" && detectedCategory && detectedCategory !== "undetermined") {
    startStepIndex = 1; // skip category question
  } else if (track === "marketing" && cleanIdea.length > 24) {
    // Idea already states offer/goal; go directly to audience & territory
    startStepIndex = 1;
    patch.businessOffer = cleanIdea;
  }

  const step = steps[startStepIndex] || steps[0];
  const tempBrief: ProjectBrief = {
    schemaVersion: 1,
    revision: 1,
    track,
    title: patch.title || "",
    idea: cleanIdea,
    goal: cleanIdea,
    currentSituation: "",
    expectedOutcome: "",
    category: detectedCategory,
    audience: detectedAudience,
    users: [],
    requirements: [],
    integrations: [],
    constraints: [],
    openQuestions: [],
    declaredBudget: null,
    declaredTimeline: null,
    nextStep: "",
    updatedAt: new Date().toISOString()
  };

  const q = getQuestionForStep(step.id, tempBrief);
  const catLabel = detectedCategory ? CATEGORY_LABELS[detectedCategory] : null;

  let interpretation = "Vamos a ordenar tu idea paso a paso en una ficha editable.";
  if (track === "combined") {
    interpretation =
      "Detecté un proyecto combinado de desarrollo y marketing digital. Vamos a construir una sola ficha integrada para ambos frentes.";
  } else if (track === "marketing" && cleanIdea) {
    interpretation = `Tomé tu solicitud de ${catLabel ? catLabel.toLowerCase() : "marketing digital"} y la registré en la ficha. Te haré solo preguntas comerciales pertinentes.`;
  } else if (track === "marketing") {
    interpretation = `Partimos con enfoque en ${catLabel || "marketing digital"}. Ordenemos tu objetivo, público, canales y modalidad.`;
  } else if (cleanIdea && catLabel) {
    interpretation = `Tomé tu idea inicial orientada a ${catLabel.toLowerCase()}. Ya la registré en tu ficha para que no tengas que repetirla.`;
  } else if (cleanIdea) {
    interpretation = "Registré tu idea inicial en la ficha. Empecemos por encuadrar el tipo de solución.";
  } else if (catLabel) {
    interpretation = `Partimos con foco en ${catLabel}. Cuéntame un poco más para armar tu ficha.`;
  }

  return {
    track,
    briefPatch: patch,
    stepIndex: startStepIndex,
    interpretation,
    question: q.question,
    stage: q.stage,
    stepId: step.id,
    options: q.options
  };
}

export function processGuidedAnswer(
  brief: ProjectBrief,
  stepId: string,
  rawAnswer: string,
  isSelection = false
): AssistantTurnResponse {
  const answer = rawAnswer.trim();
  const origin = isSelection ? "selection" : "user";
  const isUnknown = answer === "__unknown__" || /^(todav[ií]a no lo s[eé]|por definir)$/i.test(answer);
  const isSkip = answer === "__skip__" || /^omitir/i.test(answer);

  // Scope guard: keep conversation focused strictly on ENIX Studio projects & services
  if (!isSelection && isOffTopicOrAbuse(answer)) {
    const currentQ = getQuestionForStep(stepId, brief);
    return {
      mode: "guided",
      expectedRevision: brief.revision,
      interpretation:
        "Estoy aquí exclusivamente para ayudarte a definir proyectos con ENIX Studio (sitios web, aplicaciones, sistemas, automatizaciones, IA, marca y marketing digital). No puedo responder temas ajenos a eso.",
      question: currentQ.question,
      stage: currentQ.stage,
      stepId,
      options: currentQ.options,
      patch: {}
    };
  }

  const patch: BriefPatch = {};
  let interpretation = "Anotado en tu ficha.";
  let nextTrack: ProjectTrack = brief.track || "development";

  const detectedAudience = inferAudienceFromText(answer);
  if (detectedAudience !== "undetermined") {
    patch.audience = detectedAudience;
  }

  // Handle category selection when starting from blank
  if (stepId === "category") {
    if (isUnknown || isSkip || answer === "undetermined") {
      patch.category = "undetermined";
      patch.addOpenQuestions = ["Definir el formato ideal de la solución o servicio según el objetivo."];
      interpretation = "Dejamos la categoría como «Por definir» mientras aclaramos tus necesidades.";
    } else if (answer === "combined") {
      nextTrack = "combined";
      patch.track = "combined";
      patch.category = "combined";
      patch.addIndicators = getMarketingIndicatorsSuggestions("combined");
      interpretation = "Configuramos una ficha combinada de desarrollo y marketing digital.";
    } else if (MARKETING_CATEGORY_SLUGS.has(answer) || inferTrackFromInput(answer, null) === "marketing") {
      nextTrack = "marketing";
      patch.track = "marketing";
      patch.category = CATEGORY_LABELS[answer] ? answer : inferCategoryFromIdea(answer, "marketing") || "marketing";
      patch.addIndicators = getMarketingIndicatorsSuggestions(patch.category);
      interpretation = `Enfocamos tu ficha en ${CATEGORY_LABELS[patch.category] || "marketing digital"} con preguntas comerciales.`;
    } else {
      const matched = CATEGORY_LABELS[answer] ? answer : inferCategoryFromIdea(answer, "development") || "undetermined";
      patch.category = matched;
      if (!brief.title || brief.title === "Nuevo proyecto digital") {
        patch.title = deriveProvisionalTitle(brief.idea || answer, matched);
      }
      interpretation = `Enfocamos el proyecto hacia ${CATEGORY_LABELS[matched] || answer}.`;
    }
  } else if (stepId === "mkt_offer_goal" || stepId === "comb_scope") {
    if (isUnknown || isSkip) {
      patch.addOpenQuestions = ["Precisar la oferta del negocio y el objetivo comercial prioritario."];
      interpretation = "Dejamos el objetivo comercial por definir para revisarlo luego.";
    } else {
      const inferredMktCat =
        nextTrack === "marketing" ? inferCategoryFromIdea(answer, "marketing") || brief.category : brief.category;
      patch.category = inferredMktCat;
      patch.title = deriveProvisionalTitle(answer, inferredMktCat);
      patch.goal = answer;
      patch.businessOffer = brief.businessOffer || answer;
      patch.commercialGoal = answer;
      patch.addRequirements = [makeRequirement(answer, "confirmed", origin, "initial", "goal")];
      interpretation = "Registré tu negocio y objetivo comercial en la ficha.";
    }
  } else if (stepId === "mkt_audience_territory") {
    if (isUnknown || isSkip) {
      patch.addOpenQuestions = ["Definir público objetivo y territorio de cobertura."];
      interpretation = "Dejamos el público y territorio marcados como «Por definir».";
    } else {
      patch.targetAudienceAndTerritory = answer;
      interpretation = `Actualicé el público y territorio (${answer}).`;
    }
  } else if (stepId === "mkt_assets_history") {
    if (isUnknown || isSkip) {
      patch.addOpenQuestions = ["Relevar web actual, redes, contenidos y acciones previas."];
      interpretation = "Dejamos los canales y activos actuales por relevar.";
    } else {
      patch.existingChannelsAndAssets = answer;
      patch.currentSituation = answer;
      patch.addRequirements = getDomainSuggestions(brief.category, nextTrack);
      patch.addIndicators = getMarketingIndicatorsSuggestions(brief.category);
      interpretation =
        "Registré tus canales actuales y agregué entregables e indicadores sugeridos (en naranja) para que confirmes o ajustes.";
    }
  } else if (stepId === "comb_priorities") {
    if (isUnknown || isSkip) {
      patch.addOpenQuestions = ["Acordar secuencia inicial entre desarrollo y acciones de marketing."];
      interpretation = "Dejamos el orden de prioridades abierto para evaluarlo contigo.";
    } else {
      patch.addRequirements = [makeRequirement(answer, "confirmed", origin, "initial", "comb")];
      interpretation = "Sumé esta prioridad conjunta en tu ficha integrada.";
    }
  } else if (stepId === "mkt_modality") {
    if (isUnknown || isSkip) {
      patch.engagementModality = "undecided";
      patch.addOpenQuestions = ["Definir si conviene trabajo puntual o acompañamiento periódico."];
      interpretation = "Dejamos la modalidad de trabajo como «Por definir».";
    } else if (answer === "one-time-then-ongoing" || (/puntual/i.test(answer) && /(continuidad|evaluar|luego|despu[eé]s)/i.test(answer))) {
      patch.engagementModality = "one-time-then-ongoing";
      interpretation = "Registré modalidad mixta: trabajo puntual inicial y evaluación de continuidad.";
    } else if (answer === "one-time" || /puntual/i.test(answer)) {
      patch.engagementModality = "one-time";
      interpretation = "Registré preferencia por trabajo puntual.";
    } else if (answer === "ongoing" || /peri[oó]dico|mensual|acompa[nñ]amiento/i.test(answer)) {
      patch.engagementModality = "ongoing";
      interpretation = "Registré preferencia por acompañamiento periódico.";
    } else {
      patch.engagementModality = "undecided";
      patch.addConstraints = [makeRequirement(answer, "confirmed", origin, "initial", "mod")];
      interpretation = "Anoté tu preferencia de modalidad en la ficha.";
    }
  } else if (stepId === "mkt_budget_dates") {
    if (isUnknown || isSkip) {
      patch.declaredTimeline = "Por definir";
      patch.adSpendBudget = "Por definir";
      patch.serviceBudget = "Por definir";
      patch.addOpenQuestions = [
        "Acordar fechas objetivo, inversión publicitaria y presupuesto de servicios por separado."
      ];
      interpretation = "Dejamos fechas, inversión publicitaria y honorarios como «Por definir».";
    } else {
      const parsed = parseMarketingBudgetAndDates(answer);
      patch.declaredTimeline = parsed.timeline || "Por definir";
      if (parsed.adSpend) {
        patch.adSpendBudget = parsed.adSpend;
      } else if (!brief.adSpendBudget) {
        patch.adSpendBudget = "Por definir";
      }
      if (parsed.serviceBudget) {
        patch.serviceBudget = parsed.serviceBudget;
      } else if (!brief.serviceBudget) {
        patch.serviceBudget = "Por definir";
      }
      interpretation =
        "Separé tus expectativas de lanzamiento, inversión en anuncios y honorarios en tu ficha. Puedes ajustarlos libremente antes de enviar.";
    }
    patch.nextStep =
      "Revisa tu ficha, confirma o ajusta sugerencias e indicadores, descarga el resumen o compártelo con el equipo de ENIX Studio.";
  } else if (stepId === "users") {
    if (isUnknown || isSkip) {
      patch.addOpenQuestions = ["Confirmar qué perfiles o equipos usarán la solución."];
      interpretation = "Dejamos los usuarios por definir para revisarlo más adelante.";
    } else {
      patch.addUsers = [makeRequirement(answer, "confirmed", origin, "initial", "usr")];
      interpretation = `Actualicé los usuarios principales en la ficha (${answer}).`;
    }
  } else if (stepId === "process") {
    if (isUnknown || isSkip) {
      patch.addOpenQuestions = ["Detallar la situación actual y el proceso principal a resolver."];
      interpretation = "Anotado como pendiente para la evaluación inicial.";
    } else {
      patch.currentSituation = answer;
      patch.addRequirements = getDomainSuggestions(brief.category, nextTrack);
      interpretation =
        "Registré el contexto actual y agregué algunas sugerencias en la ficha (marcadas en naranja) para que decidas si te sirven.";
    }
  } else if (stepId === "essentials") {
    if (isUnknown || isSkip) {
      patch.addOpenQuestions = ["Priorizar qué funciones deben entrar en la primera versión."];
      interpretation = "Dejamos la priorización inicial abierta para revisarla contigo.";
    } else {
      patch.addRequirements = [makeRequirement(answer, "confirmed", origin, "initial", "ess")];
      if (brief.requirements.filter((r) => r.status === "suggested").length === 0) {
        patch.addRequirements.push(...getDomainSuggestions(brief.category, nextTrack));
      }
      interpretation = "Sumé esta prioridad confirmada en «Lo esencial».";
    }
  } else if (stepId === "integrations") {
    if (isUnknown || isSkip) {
      patch.addOpenQuestions = ["Confirmar si habrá integraciones con herramientas existentes."];
      interpretation = "Dejamos las integraciones marcadas como «Por definir».";
    } else {
      patch.addIntegrations = [makeRequirement(answer, "confirmed", origin, "initial", "int")];
      interpretation = "Registré las integraciones indicadas en tu ficha.";
    }
  } else if (stepId === "timeline") {
    if (isUnknown || isSkip) {
      patch.declaredTimeline = "Por definir";
      patch.addOpenQuestions = ["Definir ventana de lanzamiento e inversión referencial."];
      interpretation = "Dejamos el plazo abierto; no es necesario tenerlo cerrado para avanzar.";
    } else {
      patch.declaredTimeline = answer;
      interpretation = `Registré el plazo de referencia (${answer}).`;
    }
    patch.nextStep =
      "Revisa tu ficha, confirma o ajusta las sugerencias, descarga el resumen o compártelo con el equipo de ENIX Studio.";
  } else {
    if (answer && !isSkip && !isUnknown) {
      patch.addRequirements = [makeRequirement(answer, "confirmed", "user", "initial", "ext")];
      interpretation = "Agregué ese detalle confirmado directamente a tu ficha.";
    }
  }

  const steps = getStepsForTrack(nextTrack);
  let nextStep: GuidedStep;

  if (stepId === "category" && (nextTrack === "marketing" || nextTrack === "combined")) {
    nextStep = steps[0];
  } else {
    const currentIdx = steps.findIndex((s) => s.id === stepId);
    const nextIdx = currentIdx >= 0 && currentIdx < steps.length - 1 ? currentIdx + 1 : steps.length - 1;
    nextStep = steps[nextIdx];
  }

  const previewBrief: ProjectBrief = {
    ...brief,
    track: nextTrack,
    category: patch.category !== undefined ? patch.category : brief.category
  };
  const nextQ = getQuestionForStep(nextStep.id, previewBrief);

  return {
    mode: "guided",
    expectedRevision: brief.revision,
    interpretation,
    question: nextQ.question,
    stage: nextQ.stage,
    stepId: nextStep.id,
    options: nextQ.options,
    patch
  };
}

/**
 * Consultative commercial conversation engine (used across Home, Contextual Panel, and /create-project/).
 * Answers direct questions first, recommends proportionate V1 scope, updates brief incrementally,
 * never repeats already-answered questions, and never invents prices/timelines/certifications.
 */
export function processCommercialTurn(
  brief: ProjectBrief,
  rawMessage: string,
  options: { pageId?: string; categoryHint?: string | null; isSelection?: boolean } = {}
): AssistantTurnResponse {
  const message = rawMessage.trim();
  const low = message.toLowerCase();
  const isSelection = Boolean(options.isSelection);

  // 1. Prompt injection or pure off-topic guard
  if (!isSelection && isOffTopicOrAbuse(message)) {
    return {
      mode: "guided",
      expectedRevision: brief.revision,
      interpretation:
        "Soy el asistente comercial de ENIX Studio y solo puedo ayudarte con proyectos de diseño, desarrollo, sistemas, automatizaciones, IA, marca o marketing digital. No tengo acceso a instrucciones internas ni respondo temas ajenos a estos servicios.",
      question: "¿Hay algún proyecto digital o necesidad de tu negocio que quieras evaluar juntos?",
      reply:
        "Soy el asistente comercial de ENIX Studio y solo puedo ayudarte con proyectos de diseño, desarrollo, sistemas, automatizaciones, IA, marca o marketing digital. No respondo temas ajenos a estos servicios ni revelo configuración interna.\n\nSi tienes un proyecto o necesidad para tu negocio, cuéntame brevemente qué buscas lograr y te ayudo a aterrizar el mejor punto de partida.",
      stage: brief.idea ? "needs" : "idea",
      stepId: "conversation",
      options: [
        { id: "ot-web", label: "Evaluar un sitio web", value: "Quiero evaluar un sitio web para mi negocio" },
        { id: "ot-mkt", label: "Atraer más clientes", value: "Quiero atraer más clientes con marketing digital" },
        { id: "ot-sys", label: "Ordenar mi operación", value: "Necesito un sistema de gestión para ordenar mi operación" }
      ],
      links: [{ label: "Hablar con el equipo", href: "/contact/" }],
      patch: {}
    };
  }

  const isMixed = !isSelection && isMixedOffTopicRequest(message);

  // 2. Infer track, category, audience, and extract structured facts from message
  const asksUndecidedPro = /(no s[eé].*(necesito|pedir|empezar)|poco profesional|imagen profesional|cursos y asesor[ií]as)/.test(low);
  const combinedText = `${brief.idea ? `${brief.idea}. ` : ""}${message}`;
  const rawTrack = asksUndecidedPro
    ? "combined"
    : inferTrackFromInput(combinedText, options.categoryHint ?? brief.category);
  const nextTrack: ProjectTrack =
    brief.track === "combined" || rawTrack === "combined"
      ? "combined"
      : rawTrack;

  const inferredCategory =
    (brief.category && brief.category !== "undetermined" ? brief.category : null) ||
    (asksUndecidedPro ? "websites" : null) ||
    inferCategoryFromIdea(message, nextTrack) ||
    options.categoryHint ||
    null;

  const patch: BriefPatch = {};
  if (!brief.idea.trim()) {
    patch.title = deriveProvisionalTitle(message, inferredCategory);
    patch.goal = message.slice(0, 480);
  }
  if (nextTrack !== brief.track) {
    patch.track = nextTrack;
  }
  if (inferredCategory && (!brief.category || brief.category === "undetermined")) {
    patch.category = inferredCategory;
  }
  const detectedAudience = inferAudienceFromText(message);
  if (detectedAudience !== "undetermined" && brief.audience === "undetermined") {
    patch.audience = detectedAudience;
  }

  const declared = extractDeclaredCapabilities(message);
  const newReqs: Requirement[] = [...declared.requirements];
  const newInts: Requirement[] = [...declared.integrations];
  const newUsers: Requirement[] = [];
  const newConstraints: Requirement[] = [];

  // Extract domain-specific facts naturally so we NEVER repeat already-answered questions
  if (/(offline|sin conexi[oó]n|sin se[nñ]al|terreno|campo|t[eé]cnicos)/.test(low)) {
    newReqs.push(makeRequirement("Registro móvil en terreno con respaldo sin conexión", "confirmed", "user", "initial", "fld"));
  }
  if (/(reportes?\s+pdf|exportar\s+pdf|informes?\s+por\s+cliente)/.test(low)) {
    newReqs.push(makeRequirement("Generación de reportes PDF por cliente", "confirmed", "user", "initial", "pdf"));
  }
  if (/(varios profesionales|estilistas|horarios distintos|m[uú]ltiples agendas)/.test(low)) {
    newReqs.push(makeRequirement("Agendas diferenciadas por profesional y horario", "confirmed", "user", "initial", "agd"));
  }
  if (/(correo|email|gmail|outlook)/.test(low) && !newInts.some((i) => /correo/i.test(i.text))) {
    newInts.push(makeRequirement("Conexión y avisos por correo electrónico", "confirmed", "user", "initial", "eml"));
  }
  if (/(excel|planilla|planillas|hoja de c[aá]lculo)/.test(low)) {
    patch.currentSituation = patch.currentSituation || "Operación actual gestionada en planillas / Excel.";
  }
  if (/(whatsapp)/.test(low) && !brief.currentSituation) {
    patch.currentSituation = "Actualmente reciben consultas o coordinación por WhatsApp.";
  }
  if (/(paciente|cl[ií]nica|salud|m[eé]dic|historia cl[ií]nica|datos sensibles)/.test(low)) {
    newConstraints.push(
      makeRequirement("Revisión de privacidad, permisos y tratamiento de datos sensibles de salud con el equipo", "confirmed", "user", "initial", "sec")
    );
  }
  if (/(peluquer[ií]a|barber[ií]a|est[eé]tica|sal[oó]n)/.test(low) && !brief.businessOffer) {
    patch.businessOffer = "Peluquería / servicios con reserva de horas.";
  }
  if (/(cafeter[ií]a|restaurante|local de comida|bar|panader[ií]a)/.test(low) && !brief.businessOffer) {
    patch.businessOffer = "Negocio gastronómico / atención local.";
  }

  // Extract territory / city / commune so we don't ask again
  const locMatch = message.match(
    /\ben\s+(santiago|providencia|[ñn]u[ñn]oa|las condes|vitacura|vi[ñn]a del mar|valpara[ií]so|concepci[oó]n|antofagasta|temuco|la serena|chile|latam|m[eé]xico|colombia|per[uú]|argentina|espa[ñn]a)\b/i
  );
  if (locMatch && !brief.targetAudienceAndTerritory) {
    patch.targetAudienceAndTerritory = `Clientes en ${locMatch[1]}`;
  }

  // Extract existing channels (Instagram, Google Maps, sin web)
  if (/(solo tenemos instagram|google maps|sin web|no tenemos web|instagram activo)/i.test(low)) {
    const channelParts: string[] = [];
    if (/instagram/i.test(low)) channelParts.push("Instagram activo");
    if (/google maps/i.test(low)) channelParts.push("ficha en Google Maps");
    if (/(sin web|no tenemos web)/i.test(low)) channelParts.push("sin sitio web aún");
    if (channelParts.length > 0) {
      patch.existingChannelsAndAssets = channelParts.join(", ");
      if (!brief.currentSituation) patch.currentSituation = channelParts.join(", ");
    }
  }

  // Extract engagement modality (puntual / mensual / periódico)
  if (/(puntual|para probar)/i.test(low) && brief.engagementModality === "undecided") {
    patch.engagementModality = /luego|despu[eé]s|probar/i.test(low) ? "one-time-then-ongoing" : "one-time";
  } else if (/(mensual|peri[oó]dico|acompa[nñ]amiento)/i.test(low) && !/(anuncios|pauta|presupuesto)/i.test(low) && brief.engagementModality === "undecided") {
    patch.engagementModality = "ongoing";
  }

  // Extract timeline cleanly (e.g. "en 2 meses", "este mes", "próximo trimestre")
  const timeMatch = message.match(
    /(en\s+\d+\s+(?:mes|meses|semana|semanas)|este\s+mes|pr[oó]ximo\s+(?:mes|trimestre)|lo\s+antes\s+posible|urgente)/i
  );
  if (timeMatch && (!brief.declaredTimeline || brief.declaredTimeline === "Por definir")) {
    patch.declaredTimeline = timeMatch[1];
  }

  // Extract ad spend / marketing budget cleanly
  const moneyMatch = message.match(/(\$?\s?\d{2,3}(?:[.,]\d{3})+\s*(?:clp|usd)?(?:\s*(?:al mes|mensual(?:es)?|\/\s*mes))?)/i);
  if (moneyMatch && /(anuncios|pauta|instagram|meta|google|publicidad)/i.test(low)) {
    patch.adSpendBudget = `${moneyMatch[1].trim()} (pauta en plataformas, separada de honorarios)`;
  } else if (/(300\.?000|clp|usd|\$|presupuesto|inversi[oó]n|anuncios|pauta)/.test(low)) {
    const parsedMkt = parseMarketingBudgetAndDates(message);
    if (parsedMkt.adSpend) patch.adSpendBudget = parsedMkt.adSpend;
    if (parsedMkt.serviceBudget) patch.serviceBudget = parsedMkt.serviceBudget;
    if (parsedMkt.timeline && !brief.declaredTimeline) patch.declaredTimeline = parsedMkt.timeline;
  }

  // Extract users / roles so we don't repeat "¿Quiénes lo usarán?"
  if (brief.users.length === 0) {
    if (/(t[eé]cnicos|terreno)/.test(low)) {
      const countMatch = message.match(/(\d+)\s+t[eé]cnicos/i);
      newUsers.push(
        makeRequirement(
          countMatch
            ? `${countMatch[1]} técnicos en terreno y coordinación operativa`
            : "Equipos técnicos en terreno y coordinación operativa",
          "confirmed",
          "user",
          "initial",
          "usr"
        )
      );
    } else if (/(estilistas|profesionales|peluquer[ií]a)/.test(low)) {
      const countMatch = message.match(/(\d+)\s+(estilistas|profesionales)/i);
      newUsers.push(
        makeRequirement(
          countMatch
            ? `Clientes que reservan y ${countMatch[1]} ${countMatch[2].toLowerCase()}`
            : "Clientes que reservan y profesionales del salón",
          "confirmed",
          "user",
          "initial",
          "usr"
        )
      );
    } else if (/bodega/.test(low)) {
      newUsers.push(makeRequirement("Equipos de ventas, bodega y administración", "confirmed", "user", "initial", "usr"));
    } else if (/clientes/.test(low)) {
      newUsers.push(makeRequirement("Clientes finales y equipo del negocio", "confirmed", "user", "initial", "usr"));
    }
  }

  if (nextTrack === "marketing" || nextTrack === "combined") {
    if (!brief.commercialGoal) patch.commercialGoal = message.slice(0, 300);
    if (!brief.indicatorsToAgree || brief.indicatorsToAgree.length === 0) {
      patch.addIndicators = getMarketingIndicatorsSuggestions(inferredCategory);
    }
  }

  if (brief.requirements.length === 0 && newReqs.length === 0) {
    newReqs.push(...getDomainSuggestions(inferredCategory, nextTrack).slice(0, 2));
  }
  if (newReqs.length > 0) patch.addRequirements = newReqs;
  if (newInts.length > 0) patch.addIntegrations = newInts;
  if (newUsers.length > 0) patch.addUsers = newUsers;
  if (newConstraints.length > 0) patch.addConstraints = newConstraints;

  // Compute effective state after this turn to avoid repeating answered questions
  const effectiveUsersCount = brief.users.length + newUsers.length;
  const effectiveSituation = patch.currentSituation || brief.currentSituation;
  const effectiveTerritory = patch.targetAudienceAndTerritory || brief.targetAudienceAndTerritory;
  const effectiveChannels = patch.existingChannelsAndAssets || brief.existingChannelsAndAssets;
  const effectiveModality = patch.engagementModality || brief.engagementModality;
  const effectiveTimeline = patch.declaredTimeline || brief.declaredTimeline;

  // 3. Craft direct, consultative answer FIRST (60–140 words target)
  const links: { label: string; href: string }[] = [];
  let answerParagraph = "";
  let followUp = "";
  let quickOptions: ChatOption[] = [];

  const asksToQuoteOrStart = /(c[oó]mo empezamos|quiero que me cotice|cotizar con el equipo|enviar mi ficha|listo para enviar|hablar con el equipo|pasemos a cotizar)/i.test(low);
  const asksPrice = /(cu[aá]nto (cuesta|me saldr[ií]a|sale|vale)|precio|valor|tarifa|presupuesto|descuento|cotiz)/.test(low);
  const asksDiscountOrGuarantee = /(descuento|garantiza|garant[ií]a de ventas|primer lugar en google|roas garantizado)/.test(low);
  const asksHealth = /(paciente|cl[ií]nica|salud|m[eé]dic|ficha cl[ií]nica)/.test(low);
  const asksSalonBooking = /(peluquer[ií]a|barber[ií]a|sal[oó]n|est[eé]tica)/.test(low) && /(whatsapp|reserva|hora|agenda|empezar|recomiend|saldr[ií]a)/.test(low);
  const asksCafeAds = /(cafeter[ií]a|restaurante|local)/.test(low) && /(instagram|anuncios|publicidad|meta|ads|300|350|pauta)/.test(low);
  const asksFieldMaintenance = /(mantenimiento|t[eé]cnicos|terreno)/.test(low) && /(offline|sin conexi[oó]n|sin se[nñ]al|excel|planilla|orden)/.test(low);
  const asksWhatToStart = /(qu[eé] recomiendas|por d[oó]nde empezar|c[oó]mo empezar|qu[eé] conviene|app o web|necesito una app)/.test(low);

  const mixedPrefix = isMixed
    ? "En temas ajenos a ENIX Studio (como recetas o tareas generales) no puedo ayudarte, pero sí con tu proyecto digital. "
    : "";

  if (asksDiscountOrGuarantee) {
    answerParagraph =
      `${mixedPrefix}No puedo aprobar descuentos ni prometer ventas, retornos o posiciones garantizadas en Google: eso depende de tu mercado, tu oferta y el alcance real que evaluamos junto al equipo de ENIX Studio. Lo que sí podemos hacer es definir una primera versión acotada y transparente, con entregables claros e indicadores acordados para medir avances reales.`;
    followUp = "¿Qué resultado concreto necesitas priorizar primero para que preparemos una evaluación realista?";
    links.push({ label: "Hablar con el equipo", href: "/contact/" });
  } else if (asksToQuoteOrStart) {
    answerParagraph =
      `${mixedPrefix}¡Perfecto! Ya tienes una ficha clara con lo esencial de tu proyecto. El siguiente paso es enviársela al equipo de ENIX Studio (desde la pestaña «Evaluar con ENIX» arriba) para que revisemos tu alcance real y te respondamos con una propuesta concreta de etapas, plazos e inversión.`;
    followUp = "¿Quieres revisar o ajustar algún detalle en «Mi ficha» antes de enviarla, o pasamos directo a «Evaluar con ENIX»?";
    quickOptions = [
      { id: "go-submit", label: "Pasar directo a Evaluar con ENIX →", value: "__open_submit__" },
      { id: "go-brief", label: "Revisar mi ficha primero", value: "__open_brief__" }
    ];
  } else if (asksHealth) {
    answerParagraph =
      `${mixedPrefix}Para una aplicación de salud con datos de pacientes conviene partir por un flujo acotado (por ejemplo agenda, ficha básica y permisos por rol) y revisar desde el inicio los requisitos de privacidad, control de acceso y normativa aplicable junto al equipo de ENIX Studio. No asumimos certificaciones médicas previas sin validar el alcance técnico y legal real.`;
    followUp = "¿Qué acción principal deben resolver primero tus profesionales o pacientes en esta primera versión?";
    links.push(
      { label: "Explorar aplicaciones", href: "/solutions/applications/" },
      { label: "Hablar con el equipo", href: "/contact/" }
    );
  } else if (asksUndecidedPro) {
    answerParagraph =
      `${mixedPrefix}Es súper común cuando vendes cursos y asesorías solo desde Instagram: antes de gastar en anuncios, el salto que más confianza genera suele ser ordenar tu imagen de marca y lanzar una web clara donde tus clientes vean qué ofreces, tu metodología y puedan inscribirse o agendar sin idas y vueltas por DM.`;
    followUp = "¿Te gustaría empezar por una web profesional con agenda/inscripción, renovar primero tu marca o ambos en un plan acotado?";
    links.push(
      { label: "Explorar sitios web", href: "/solutions/websites/" },
      { label: "Branding y marca", href: "/marketing/brand-design/" }
    );
    quickOptions = [
      { id: "up-1", label: "Web profesional con agenda o inscripción", value: "Quiero empezar por una web profesional donde puedan agendar o inscribirse a mis cursos" },
      { id: "up-2", label: "Marca + web en un plan acotado", value: "Quiero ordenar mi marca y lanzar una web clara en una primera etapa acotada" },
      { id: "up-3", label: "Quiero cotizar con el equipo", value: "Quiero que me cotice el equipo" }
    ];
  } else if (asksSalonBooking) {
    const priceNote = asksPrice
      ? " No te doy un número cerrado al aire porque la inversión depende de si sumamos pagos/abonos y cuántas agendas manejan, pero al definir esto aquí el equipo de ENIX puede cotizártelo con precisión."
      : "";
    answerParagraph =
      `${mixedPrefix}Para empezar sin sobredimensionar, lo más práctico suele ser un sitio web rápido enfocado en móvil con catálogo de servicios, precios referenciales y agenda de reservas en línea con confirmación automática (por correo o aviso a WhatsApp), en lugar de construir una app compleja desde el día uno.${priceNote}`;
    followUp = "¿Atienden con una sola agenda o varios profesionales con horarios distintos?";
    links.push(
      { label: "Ver demo de reservas", href: "/demos/bookings/" },
      { label: "Explorar sitios web", href: "/solutions/websites/" }
    );
    quickOptions = [
      { id: "sb-1", label: "Varios profesionales con horarios", value: "Atendemos con varios profesionales y horarios distintos" },
      { id: "sb-2", label: "Una sola agenda principal", value: "Usamos una sola agenda principal para los servicios" },
      { id: "sb-3", label: "Quiero sumar clientes nuevos también", value: "Además de reservas quiero atraer clientes nuevos con marketing" }
    ];
  } else if (asksCafeAds) {
    answerParagraph =
      `${mixedPrefix}Cuando ya probaste anuncios sin retorno, casi siempre falla el destino o el mensaje, no el canal. Con un presupuesto mensual acotado para anuncios en Instagram conviene enfocar la pauta en tu zona local con una oferta concreta y un destino claro (ficha local, carta o reserva). Recuerda que la inversión publicitaria se paga directo a Meta y siempre se separa de los honorarios de gestión y creatividad de ENIX Studio; tampoco prometemos retornos cerrados sin validar primero tu punto de partida.`;
    followUp = effectiveTerritory
      ? `Ya anoté que operas en ${effectiveTerritory.replace(/^Clientes en /i, "")}. ¿Hoy cuentan con sitio web o solo Instagram y Google Maps para recibir esas visitas?`
      : "¿En qué comuna o ciudad estás y ya cuentan con sitio web o ficha en Google Maps para recibir esas visitas?";
    links.push(
      { label: "Explorar publicidad digital", href: "/marketing/digital-advertising/" },
      { label: "SEO y presencia local", href: "/marketing/seo-local/" }
    );
    quickOptions = [
      { id: "ca-1", label: "Solo tenemos Instagram por ahora", value: "Hoy solo tenemos Instagram activo y sin sitio web" },
      { id: "ca-2", label: "Tenemos Instagram y Google Maps", value: "Tenemos Instagram y ficha en Google Maps, sin web optimizada" },
      { id: "ca-3", label: "Queremos web simple + campañas", value: "Queremos una web simple o carta digital junto con las campañas" }
    ];
  } else if (asksFieldMaintenance) {
    const alreadyHasCount = /\d+\s+t[eé]cnicos/i.test(message);
    answerParagraph =
      `${mixedPrefix}Cuando tus técnicos trabajan en terreno con mala señal y todo termina en Excel, una buena primera versión es una aplicación web móvil con captura offline (órdenes, fotos y firma que se sincronizan al recuperar señal) conectada a un tablero central para despacho y facturación. Así reemplazas planillas por etapas sin frenar la operación diaria.`;
    followUp = alreadyHasCount
      ? "Ya registré tu equipo en terreno en la ficha. ¿Tienen algún plazo objetivo o herramientas clave (como correo, ERP o reportes PDF) que debamos conectar desde la primera versión?"
      : "¿Cuántas personas trabajan en terreno y qué datos mínimos debe registrar cada orden de trabajo?";
    links.push(
      { label: "Ver demo de pedidos y operación", href: "/demos/order-management/" },
      { label: "Explorar sistemas de gestión", href: "/solutions/management-systems/" }
    );
    quickOptions = [
      { id: "fm-1", label: "Plazo 1–2 meses + reportes PDF", value: "Lo necesitamos en 2 meses con reportes PDF por cliente" },
      { id: "fm-2", label: "Conectar con correo o ERP", value: "Necesitamos conectar con correo y nuestro sistema actual" },
      { id: "fm-3", label: "Quiero evaluar alcance con el equipo", value: "Quiero que me cotice el equipo" }
    ];
  } else if (asksPrice) {
    answerParagraph =
      `${mixedPrefix}No damos precios cerrados a ciegas porque la inversión depende del alcance real: cantidad de flujos, diseño, integraciones y si incluye acompañamiento de marketing (donde la pauta en anuncios siempre va separada de los honorarios). Si ordenamos aquí lo esencial de tu primera versión, el equipo de ENIX Studio puede prepararte una evaluación concreta sin sorpresas.`;
    followUp = "¿Qué es lo mínimo que necesitas tener funcionando primero para cotizarlo con claridad?";
    links.push({ label: "Cómo trabajamos", href: "/how-we-work/" });
  } else if (asksWhatToStart) {
    const isMkt = nextTrack === "marketing" || nextTrack === "combined";
    answerParagraph = isMkt
      ? `${mixedPrefix}Para empezar con buen criterio, conviene alinear primero el objetivo comercial (consultas, reservas o ventas), revisar si tu web o destino actual convierte bien y luego activar los canales más pertinentes sin dispersar presupuesto.`
      : `${mixedPrefix}Para empezar sin sobredimensionar, solemos separar una primera versión enfocada en el flujo principal que resuelve el problema hoy, dejando funciones secundarias para una segunda etapa. Así validas rápido y mantienes una base escalable.`;
    followUp = "¿Qué problema concreto del día a día te gustaría resolver primero?";
  } else if (nextTrack === "combined") {
    answerParagraph =
      `${mixedPrefix}¡Excelente! Ya actualicé tu ficha integrada de desarrollo y marketing digital con este contexto${effectiveChannels ? ` (${effectiveChannels})` : ""}${effectiveModality && effectiveModality !== "undecided" ? " y modalidad puntual inicial para validar" : ""}. Trabajar ambos frentes juntos evita lanzar campañas sin un destino que convierta.`;
    if (!effectiveTerritory) {
      followUp = "¿En qué ciudad o territorio operas principalmente?";
    } else if (!effectiveTimeline) {
      followUp = "Con esto ya tenemos una base muy sólida. ¿Tienes una fecha ideal de lanzamiento o pasamos a «Evaluar con ENIX» para que el equipo prepare una propuesta?";
      quickOptions = [
        { id: "c-go", label: "Pasar a Evaluar con ENIX →", value: "__open_submit__" },
        { id: "c-t1", label: "Empezar este mes", value: "Me gustaría empezar este mes" },
        { id: "c-t2", label: "En 1 a 2 meses", value: "Idealmente en 1 a 2 meses" }
      ];
    } else {
      followUp = "¡Tu ficha ya tiene todo lo necesario para una primera evaluación! ¿Quieres revisarla en «Mi ficha» o enviársela al equipo?";
      quickOptions = [
        { id: "c-go2", label: "Ir a Evaluar con ENIX →", value: "__open_submit__" },
        { id: "c-br2", label: "Revisar mi ficha", value: "__open_brief__" }
      ];
    }
    links.push(
      { label: "Sitios web", href: "/solutions/websites/" },
      { label: "Marketing digital", href: "/marketing/" }
    );
  } else if (nextTrack === "marketing") {
    const catName = inferredCategory && CATEGORY_LABELS[inferredCategory]
      ? CATEGORY_LABELS[inferredCategory].toLowerCase()
      : "marketing digital";
    answerParagraph =
      `${mixedPrefix}Buen punto de partida para trabajar ${catName}. Para recomendarte un enfoque realista (sin prometer resultados cerrados y separando siempre inversión en anuncios de honorarios), ya anoté estos datos en tu ficha.`;
    if (!effectiveTerritory) {
      followUp = "¿En qué ciudad o territorio operas y qué canales digitales (web, Instagram, Google) tienes activos hoy?";
    } else if (!effectiveModality || effectiveModality === "undecided") {
      followUp = "¿Buscas un trabajo puntual de lanzamiento o un acompañamiento periódico mensual?";
      quickOptions = [
        { id: "m-1", label: "Trabajo puntual primero", value: "Busco un trabajo puntual primero para probar" },
        { id: "m-2", label: "Acompañamiento mensual", value: "Busco un acompañamiento periódico mensual" }
      ];
    } else {
      followUp = "Ya tienes una ficha clara de marketing. ¿Quieres enviársela al equipo en «Evaluar con ENIX» o agregar algún detalle más?";
      quickOptions = [
        { id: "m-go", label: "Ir a Evaluar con ENIX →", value: "__open_submit__" },
        { id: "m-br", label: "Revisar mi ficha", value: "__open_brief__" }
      ];
    }
    if (inferredCategory && inferredCategory !== "marketing") {
      links.push({ label: `Ver ${CATEGORY_LABELS[inferredCategory]}`, href: `/marketing/${inferredCategory}/` });
    }
  } else {
    const catName = inferredCategory && CATEGORY_LABELS[inferredCategory]
      ? CATEGORY_LABELS[inferredCategory].toLowerCase()
      : "tu proyecto digital";
    const capturedHighlights: string[] = [];
    if (newReqs.length > 0) capturedHighlights.push(newReqs[0].text.toLowerCase());
    if (newInts.length > 0) capturedHighlights.push(newInts[0].text.toLowerCase());
    if (patch.declaredTimeline) capturedHighlights.push(`plazo ${patch.declaredTimeline}`);

    const summaryClause =
      capturedHighlights.length > 0
        ? ` Sumé ${capturedHighlights.join(", ")} en tu ficha.`
        : " Ya actualicé tu ficha con este contexto.";

    answerParagraph = `${mixedPrefix}Perfecto, seguimos afinando ${catName}.${summaryClause}`;

    if (effectiveUsersCount === 0) {
      followUp = "¿Quiénes usarán principalmente esta solución y qué acción clave deben completar?";
    } else if (!effectiveSituation) {
      followUp = "¿Cómo resuelven hoy este proceso y qué es lo que más les frena actualmente?";
    } else if (!effectiveTimeline) {
      followUp = "Con esto ya tenemos el alcance base bastante claro. ¿Tienes alguna fecha ideal de lanzamiento o prefieres pasar ya a evaluar con el equipo?";
      quickOptions = [
        { id: "d-t1", label: "En 1 a 2 meses", value: "Lo ideal sería lanzarlo en 1 a 2 meses" },
        { id: "d-t2", label: "Sin fecha cerrada, evaluando", value: "Sin fecha fija, quiero evaluar alcance e inversión" },
        { id: "d-go", label: "Ir a Evaluar con ENIX →", value: "__open_submit__" }
      ];
    } else {
      followUp = "¡Excelente! Ya tienes una ficha muy completa (objetivo, usuarios, alcance y plazo). Puedes revisarla en «Mi ficha» o enviársela directo al equipo para recibir una evaluación concreta.";
      quickOptions = [
        { id: "d-go2", label: "Ir a Evaluar con ENIX →", value: "__open_submit__" },
        { id: "d-br2", label: "Revisar mi ficha", value: "__open_brief__" }
      ];
    }
    if (inferredCategory && ["websites", "applications", "management-systems", "platforms", "automations", "ai-solutions"].includes(inferredCategory)) {
      links.push({ label: `Explorar ${CATEGORY_LABELS[inferredCategory]}`, href: `/solutions/${inferredCategory}/` });
    }
  }

  // Always offer contextual demo link when highly relevant
  if (/(reserva|agenda|cita|hora)/.test(low) && !links.some((l) => l.href === "/demos/bookings/")) {
    links.push({ label: "Probar demo de reservas", href: "/demos/bookings/" });
  } else if (/(pedido|bodega|despacho|inventario|orden)/.test(low) && !links.some((l) => l.href === "/demos/order-management/")) {
    links.push({ label: "Probar demo de operación", href: "/demos/order-management/" });
  } else if (/(automatiz|clasific|formulario)/.test(low) && !links.some((l) => l.href === "/demos/automation/")) {
    links.push({ label: "Probar demo de automatización", href: "/demos/automation/" });
  }

  const replyText = `${answerParagraph}\n\n${followUp}`.trim();

  return {
    mode: "guided",
    expectedRevision: brief.revision,
    interpretation: answerParagraph,
    question: followUp,
    reply: replyText,
    stage: brief.requirements.length > 1 ? "priorities" : "needs",
    stepId: "conversation",
    options: quickOptions,
    links: links.slice(0, 3),
    patch
  };
}
