import {
  CATEGORY_LABELS,
  MARKETING_CATEGORY_SLUGS,
  computeBriefReadiness,
  createInitialLeadCapture,
  mapCommercialStageToProjectStage,
  normalizeLeadCapture,
  type AssistantTurnResponse,
  type BriefPatch,
  type ChatOption,
  type CommercialStage,
  type LeadCaptureState,
  type ProjectBrief,
  type ProjectStage,
  type ProjectTrack,
  type Requirement,
  type SelectionMode,
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
  /(marketing|publicidad|campa[nñ]a|anuncios|google ads|meta ads|facebook|instagram|redes sociales|\bseo\b|posicionamiento|b[uú]squedas locales|atraer m[aá]s clientes|conseguir m[aá]s clientes|quiero m[aá]s clientes|necesito m[aá]s clientes|vender m[aá]s|aumentar ventas|captar clientes|conseguir m[aá]s reservas|conseguir reservas|estrategia digital|branding|dise[nñ]o de marca|mejorar mi marca|identidad de marca|email marketing|conversi[oó]n|contenido editorial)/i;

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
    if (/(estrategia|atraer|captar|clientes|reservas|vender|ventas)/.test(text)) return "digital-strategy";
    return "marketing";
  }

  // ENX-04: Prioritize explicit website intent before secondary keywords like "whatsapp" or "reservas"
  if (/(quiero|necesito|crear|hacer|dise[nñ]ar|nueva|renovar)\s+(un\s+|una\s+)?(sitio\s+|p[aá]gina\s+)?web\b|sitio web|p[aá]gina web/.test(text)) {
    return "websites";
  }
  if (/(\bcrm\b|pedido|inventario|bodega|excel|planilla|gesti[oó]n|erp|stock|despacho|ordenar la operaci|mantenimiento|t[eé]cnicos en terreno|sistema industrial|industrial|planta|trazabilidad)/.test(text)) {
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
  if (/(app|aplicaci[oó]n|delivery|reparto|celular|m[oó]vil|ios|android|reservar|reserva|agenda)/.test(text)) {
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
export function extractEmailFromText(text: string): string | null {
  const match = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  return match ? match[1].toLowerCase() : null;
}

export function isDecliningContactText(text: string): boolean {
  return /(no quiero dejar|sin dejar (mi )?correo|ahora no|todav[ií]a no quiero|prefiero seguir conversando|no gracias,?\s*prefiero|sin dar datos|no me contacten)/i.test(
    text.trim()
  );
}

export function hasImmediateContactIntent(text: string): boolean {
  return /(quiero cotizar|cotizar\s+(una?|un|mi|el|la)\b|quiero contratar|me interesa\b|hablemos\b|hablar con el equipo|cotizar con el equipo|quiero que me contacten|enviar mi ficha|solicitar evaluaci[oó]n|c[oó]mo empezamos|listo para enviar|pasemos a cotizar)/i.test(
    text.trim()
  );
}

export function processCommercialTurn(
  brief: ProjectBrief,
  rawMessage: string,
  options: {
    pageId?: string;
    categoryHint?: string | null;
    isSelection?: boolean;
    history?: Array<{ role: "user" | "assistant"; text: string }>;
    currentCommercialStage?: CommercialStage;
    leadCapture?: LeadCaptureState;
  } = {}
): AssistantTurnResponse {
  const message = rawMessage.trim();
  const low = message.toLowerCase();
  const isSelection = Boolean(options.isSelection);
  const lead = normalizeLeadCapture(options.leadCapture || createInitialLeadCapture());
  const canOfferContact = lead.status !== "declined" && lead.status !== "submitted";
  const isFirstTurn = options.history
    ? options.history.length === 0
    : !brief.idea.trim() && !brief.goal.trim() && brief.requirements.length === 0;

  // 1. Prompt injection or pure off-topic guard
  if (!isSelection && isOffTopicOrAbuse(message)) {
    return {
      mode: "guided",
      expectedRevision: brief.revision,
      interpretation:
        "Soy Steve, el asesor comercial de ENIX Studio, y solo puedo ayudarte con proyectos digitales (web, apps, sistemas, automatizaciones, IA, marca o marketing). No respondo temas ajenos ni revelo configuración interna.",
      question: "¿Qué proyecto o mejora para tu negocio te gustaría explorar juntos?",
      reply:
        "Soy Steve, el asesor comercial de ENIX Studio, y solo puedo ayudarte con proyectos digitales (web, apps, sistemas, automatizaciones, IA, marca o marketing). No respondo temas ajenos ni revelo configuración interna.\n\n¿Qué proyecto o mejora para tu negocio te gustaría explorar juntos?",
      stage: brief.idea ? "needs" : "idea",
      commercialStage: "discover",
      stepId: "conversation",
      selectionMode: "single",
      options: [
        { id: "ot-web", label: "Crear o renovar una web", value: "Necesito una página web para captar más clientes" },
        { id: "ot-mkt", label: "Vender más / atraer clientes", value: "Quiero vender más y atraer más clientes" },
        { id: "ot-sys", label: "Ordenar mi operación o CRM", value: "Quiero ordenar mi operación y clientes con un sistema a medida" }
      ],
      links: [{ label: "Hablar con el equipo", href: "/contact/" }],
      patch: {}
    };
  }

  const isMixed = !isSelection && isMixedOffTopicRequest(message);
  const isUnsureReply =
    message === "__unsure__" ||
    /^(no estoy seguro|no s[eé] todav[ií]a|no estoy seguro,?\s*recomi[eé]ndame|no estoy seguro,?\s*quiero detectarlo)$/i.test(message);

  // 2. Infer track, category, audience, and extract structured facts from message
  const asksUndecidedPro = /(no s[eé].*(necesito|pedir|empezar)|poco profesional|imagen profesional|cursos y asesor[ií]as)/.test(low) && !/(excel|planilla)/.test(low);
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
    inferCategoryFromIdea(combinedText, nextTrack) ||
    options.categoryHint ||
    null;

  const patch: BriefPatch = {};
  const blueprintHighlights: string[] = [];

  if (!brief.idea.trim()) {
    patch.title = deriveProvisionalTitle(message, inferredCategory);
    patch.goal = message.slice(0, 480);
  }
  if (nextTrack !== brief.track) {
    patch.track = nextTrack;
  }
  if (inferredCategory && (!brief.category || brief.category === "undetermined")) {
    patch.category = inferredCategory;
    blueprintHighlights.push(`Enfoque: ${CATEGORY_LABELS[inferredCategory] || inferredCategory}`);
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
  if (/(whatsapp)/.test(low) && !brief.currentSituation && !patch.currentSituation) {
    patch.currentSituation = "Actualmente reciben consultas o coordinación por WhatsApp.";
  }
  if (/(empresa que ya funciona|negocio en marcha|ya funcionamos)/.test(low) && !brief.currentSituation) {
    patch.currentSituation = "Empresa en funcionamiento buscando potenciar su presencia digital.";
    patch.audience = "business";
  } else if (/(proyecto nuevo|emprendimiento nuevo|rec[ií][eé]n empezando)/.test(low) && !brief.currentSituation) {
    patch.currentSituation = "Proyecto nuevo en etapa de lanzamiento.";
    patch.audience = "entrepreneur";
  } else if (/(renovar.*web|web actual)/.test(low) && !brief.currentSituation) {
    patch.currentSituation = "Cuenta con sitio web actual que busca renovar para captar más clientes.";
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

  // Extract existing channels (Instagram, Google Maps, recomendaciones, sin web)
  if (/(solo tenemos instagram|google maps|sin web|no tenemos web|instagram activo|redes sociales|recomendaciones|boca a boca|b[uú]squedas locales|canal constante)/i.test(low)) {
    const channelParts: string[] = [];
    if (/instagram|redes sociales|tiktok/i.test(low)) channelParts.push("Redes sociales / Instagram");
    if (/google maps|b[uú]squedas locales|google/i.test(low)) channelParts.push("Google / búsquedas locales");
    if (/recomendaciones|boca a boca/i.test(low)) channelParts.push("Recomendaciones / boca a boca");
    if (/(sin web|no tenemos web)/i.test(low)) channelParts.push("sin sitio web aún");
    if (/canal constante/i.test(low)) channelParts.push("sin canal digital constante aún");
    if (channelParts.length > 0) {
      patch.existingChannelsAndAssets = channelParts.join(", ");
      if (!brief.currentSituation && !patch.currentSituation) patch.currentSituation = channelParts.join(", ");
    }
  }

  // Extract engagement modality (puntual / mensual / periódico)
  if (/(puntual|para probar)/i.test(low) && brief.engagementModality === "undecided") {
    patch.engagementModality = /luego|despu[eé]s|probar/i.test(low) ? "one-time-then-ongoing" : "one-time";
  } else if (/(mensual|peri[oó]dico|acompa[nñ]amiento)/i.test(low) && !/(anuncios|pauta|presupuesto)/i.test(low) && brief.engagementModality === "undecided") {
    patch.engagementModality = "ongoing";
  }

  // Extract timeline cleanly
  const timeMatch = message.match(
    /(en\s+\d+\s+(?:meses|mes|semanas|semana)|en\s+1\s+a\s+2\s+meses|este\s+mes|pr[oó]ximo\s+(?:mes|trimestre)|lo\s+antes\s+posible|urgente|sin\s+fecha\s+fija)/i
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
    } else if (/(equipo comercial|vendedores|ventas y seguimiento)/.test(low)) {
      newUsers.push(makeRequirement("Equipo comercial y gestión de ventas", "confirmed", "user", "initial", "usr"));
    } else if (/(repartidores|locales|restaurantes|delivery)/.test(low)) {
      newUsers.push(makeRequirement("Clientes finales, despacho y repartidores", "confirmed", "user", "initial", "usr"));
    } else if (/(planta|operarios|industrial|bodega)/.test(low)) {
      newUsers.push(makeRequirement("Equipos de operación, planta y supervisión", "confirmed", "user", "initial", "usr"));
    } else if (/(mis clientes|clientes finales|los clientes\s+(?:reserv|compr|us|entr|pid|ingres))/.test(low)) {
      newUsers.push(makeRequirement("Clientes finales y equipo del negocio", "confirmed", "user", "initial", "usr"));
    }
  }

  // Capture user-confirmed priority / capability choices on follow-up turns
  if (!isFirstTurn && !isUnsureReply && message.length >= 6 && newReqs.length === 0 && !/(c[oó]mo empezamos|cotiz|enviar mi ficha|evaluar con enix|pasemos)/i.test(low)) {
    const isPureMeta = /(sin fecha|este mes|1 a 2 meses|puntual|mensual|solo tenemos instagram|google maps|empresa que ya funciona|proyecto nuevo)/i.test(low);
    if (!isPureMeta) {
      newReqs.push(makeRequirement(message.slice(0, 180), "confirmed", isSelection ? "selection" : "user", "initial", "usrp"));
    }
  }

  if (nextTrack === "marketing" || nextTrack === "combined") {
    if (!brief.commercialGoal) patch.commercialGoal = message.slice(0, 300);
    if (!brief.indicatorsToAgree || brief.indicatorsToAgree.length === 0) {
      patch.addIndicators = getMarketingIndicatorsSuggestions(inferredCategory);
    }
  }

  // Domain-tailored suggested capabilities on first turn (clearly marked status: "suggested")
  const isCrm = /\bcrm\b|clientes y ventas|oportunidades de venta|pipeline/.test(low);
  const isDelivery = /(delivery|reparto|pedidos a domicilio)/.test(low);
  const isIndustrial = /(sistema industrial|industrial|planta|trazabilidad)/.test(low) && !/(t[eé]cnicos en terreno|offline|sin conexi[oó]n)/.test(low);
  const isExcelPain = /(excel|planilla|hoja de c[aá]lculo)/.test(low) && !/(mantenimiento|t[eé]cnicos|terreno)/.test(low);
  const isAutomation = /(automatiz|tareas repetitivas|procesos manuales)/.test(low);
  const isAiBiz = /(\bia\b|inteligencia artificial|usar ia)/.test(low) && !/(industrial)/.test(low);
  const isGenericWeb = /(necesito|quiero|hacer|crear|dise[nñ]ar)\s+(una?\s+)?(p[aá]gina\s+|sitio\s+)?web\b/.test(low) && !/(peluquer|barber|sal[oó]n|cafeter|restaurante)/.test(low);
  const isSellMore = /((quiero|necesito)\s+(vender\s+m[aá]s|m[aá]s\s+clientes)|aumentar\s+ventas|atraer\s+m[aá]s\s+clientes|captar\s+clientes)/.test(low) && !/(cafeter|restaurante)/.test(low);

  if (brief.requirements.length === 0) {
    if (isCrm) {
      newReqs.push(
        makeRequirement("Centralización de clientes, historial y embudo comercial", "suggested", "assistant", "initial", "crm"),
        makeRequirement("Seguimiento automático de oportunidades y cotizaciones", "suggested", "assistant", "initial", "crm"),
        makeRequirement("Reportes comerciales e integración a evaluar con WhatsApp", "suggested", "assistant", "later", "crm")
      );
    } else if (isDelivery) {
      newReqs.push(
        makeRequirement("Catálogo móvil y toma de pedidos en tiempo real", "suggested", "assistant", "initial", "del"),
        makeRequirement("Seguimiento de estado de entrega y panel de despacho", "suggested", "assistant", "initial", "del"),
        makeRequirement("Pagos en línea y notificaciones automáticas al cliente", "suggested", "assistant", "later", "del")
      );
    } else if (isIndustrial) {
      newReqs.push(
        makeRequirement("Control centralizado de órdenes de trabajo y trazabilidad", "suggested", "assistant", "initial", "ind"),
        makeRequirement("Registro operativo en planta o terreno desde móvil", "suggested", "assistant", "initial", "ind"),
        makeRequirement("Tableros de control y reportes automáticos por turno o cliente", "suggested", "assistant", "later", "ind")
      );
    } else if (isExcelPain) {
      newReqs.push(
        makeRequirement("Panel centralizado que reemplaza planillas sueltas", "suggested", "assistant", "initial", "exl"),
        makeRequirement("Carga rápida de datos sin duplicados y permisos por rol", "suggested", "assistant", "initial", "exl"),
        makeRequirement("Reportes y alertas automáticas en tiempo real", "suggested", "assistant", "later", "exl")
      );
    } else if (isAutomation) {
      newReqs.push(
        makeRequirement("Automatización de tareas repetitivas entre herramientas", "suggested", "assistant", "initial", "aut"),
        makeRequirement("Conexión de formularios, correo, WhatsApp o planillas", "suggested", "assistant", "initial", "aut"),
        makeRequirement("Alertas operativas y reportes automáticos", "suggested", "assistant", "later", "aut")
      );
    } else if (isAiBiz) {
      newReqs.push(
        makeRequirement("Asistente inteligente para atender o calificar consultas", "suggested", "assistant", "initial", "ai"),
        makeRequirement("Clasificación o resumen automático de solicitudes y documentos", "suggested", "assistant", "initial", "ai"),
        makeRequirement("Reglas de control humano y privacidad sobre tus datos", "suggested", "assistant", "initial", "ai")
      );
    } else if (newReqs.length === 0) {
      newReqs.push(...getDomainSuggestions(inferredCategory, nextTrack).slice(0, 3));
    }
  }

  if (newReqs.length > 0) {
    patch.addRequirements = newReqs;
    const confirmedCount = newReqs.filter((r) => r.status === "confirmed").length;
    const suggestedCount = newReqs.filter((r) => r.status === "suggested").length;
    if (confirmedCount > 0) blueprintHighlights.push(`+${confirmedCount} prioridad${confirmedCount > 1 ? "es" : ""} confirmada${confirmedCount > 1 ? "s" : ""}`);
    if (suggestedCount > 0) blueprintHighlights.push(`+${suggestedCount} posibilidades propuestas`);
  }
  if (newInts.length > 0) {
    patch.addIntegrations = newInts;
    blueprintHighlights.push(`+${newInts.length} integración${newInts.length > 1 ? "es" : ""}`);
  }
  if (newUsers.length > 0) {
    patch.addUsers = newUsers;
    blueprintHighlights.push("Usuarios definidos");
  }
  if (newConstraints.length > 0) patch.addConstraints = newConstraints;
  if (patch.declaredTimeline) blueprintHighlights.push(`Plazo: ${patch.declaredTimeline}`);
  if (patch.targetAudienceAndTerritory) blueprintHighlights.push(patch.targetAudienceAndTerritory);

  // Compute effective state after this turn to avoid repeating answered questions
  const effectiveUsersCount = brief.users.length + newUsers.length;
  const effectiveSituation = patch.currentSituation || brief.currentSituation;
  const effectiveTerritory = patch.targetAudienceAndTerritory || brief.targetAudienceAndTerritory;
  const effectiveChannels = patch.existingChannelsAndAssets || brief.existingChannelsAndAssets;
  const effectiveModality = patch.engagementModality || brief.engagementModality;
  const effectiveTimeline = patch.declaredTimeline || brief.declaredTimeline;
  const effectiveConfirmedCount =
    brief.requirements.filter((r) => r.status === "confirmed").length +
    newReqs.filter((r) => r.status === "confirmed").length;

  // Estimate readiness after patch
  const previewBrief: ProjectBrief = {
    ...brief,
    track: nextTrack,
    category: patch.category !== undefined ? patch.category : brief.category,
    idea: brief.idea || message,
    goal: patch.goal || brief.goal,
    currentSituation: effectiveSituation,
    targetAudienceAndTerritory: effectiveTerritory,
    existingChannelsAndAssets: effectiveChannels,
    engagementModality: effectiveModality,
    declaredTimeline: effectiveTimeline,
    users: [...brief.users, ...newUsers],
    requirements: [...brief.requirements, ...newReqs]
  };
  const readiness = computeBriefReadiness(previewBrief);

  // 3. Craft concise, value-first recommendation (25–55 words target) + low-friction contact capture
  const links: { label: string; href: string }[] = [];
  let answerParagraph = "";
  let followUp = "";
  let quickOptions: ChatOption[] = [];
  let selectionMode: SelectionMode = "single";
  let commercialStage: CommercialStage = "possibilities";
  let offerContact = false;
  let askedDiscoveryQuestion = false;
  let contactDeclined = false;

  const detectedEmail = extractEmailFromText(message);
  const userDeclinedContact = !isSelection && isDecliningContactText(message);
  const wantsImmediateContact = hasImmediateContactIntent(message);

  // Count how many concrete facts the visitor already gave on turn 1
  const initialConcreteSignals =
    (patch.category ? 1 : 0) +
    (patch.currentSituation ? 1 : 0) +
    (patch.targetAudienceAndTerritory ? 1 : 0) +
    (patch.declaredTimeline ? 1 : 0) +
    (patch.adSpendBudget ? 1 : 0) +
    (newUsers.length > 0 ? 1 : 0) +
    (declared.requirements.length > 0 ? 1 : 0) +
    (declared.integrations.length > 0 ? 1 : 0);
  const wordCount = message.split(/\s+/).filter(Boolean).length;
  const isDetailedInitial = isFirstTurn && initialConcreteSignals >= 3 && wordCount >= 14;

  const asksPrice = /(cu[aá]nto (cuesta|me saldr[ií]a|sale|vale)|precio|valor|tarifa|presupuesto|descuento)/.test(low);
  const asksDiscountOrGuarantee = /(descuento|garantiza|garant[ií]a de ventas|primer lugar en google|roas garantizado)/.test(low);
  const asksHealth = /(paciente|cl[ií]nica|salud|m[eé]dic|ficha cl[ií]nica)/.test(low);
  const asksSalonBooking = /(peluquer[ií]a|barber[ií]a|sal[oó]n|est[eé]tica)/.test(low) && /(whatsapp|reserva|hora|agenda|empezar|recomiend|saldr[ií]a)/.test(low);
  const asksCafeAds = /(cafeter[ií]a|restaurante|local)/.test(low) && /(instagram|anuncios|publicidad|meta|ads|300|350|pauta)/.test(low);
  const asksFieldMaintenance = /(mantenimiento|t[eé]cnicos|terreno)/.test(low) && /(offline|sin conexi[oó]n|sin se[nñ]al|excel|planilla|orden)/.test(low);

  const mixedPrefix = isMixed
    ? "En temas ajenos a ENIX Studio no puedo ayudarte, pero sí con tu proyecto digital. "
    : "";
  const contactPrompt = "¿A qué correo puede escribirte el equipo de ENIX para evaluar esta primera versión?";

  if (detectedEmail && lead.status !== "submitted") {
    const catLabel = inferredCategory && CATEGORY_LABELS[inferredCategory]
      ? CATEGORY_LABELS[inferredCategory].toLowerCase()
      : "tu proyecto";
    answerParagraph =
      `${mixedPrefix}Perfecto, ya anoté ${detectedEmail} junto con el resumen de ${catLabel} para que el equipo de ENIX revise el alcance.`;
    followUp = "Confirma el envío abajo y te escribirán directamente sobre esta propuesta.";
    commercialStage = "evaluation";
    offerContact = true;
  } else if (userDeclinedContact) {
    contactDeclined = true;
    offerContact = false;
    const catLabel = inferredCategory && CATEGORY_LABELS[inferredCategory]
      ? CATEGORY_LABELS[inferredCategory].toLowerCase()
      : "tu proyecto";
    answerParagraph =
      `Sin problema, seguimos conversando por aquí sin pedirte datos. Para ${catLabel} podemos afinar la propuesta inicial o revisar opciones técnicas a tu ritmo.`;
    followUp = "¿Qué aspecto te gustaría explorar ahora?";
    commercialStage = "priorities";
    quickOptions = [
      { id: "dc-1", label: "Qué incluir en la primera versión", value: "Qué me recomiendas incluir en la primera versión" },
      { id: "dc-2", label: "Cómo se integra con lo que ya uso", value: "Cómo se integraría con las herramientas que ya usamos" },
      { id: "dc-3", label: "Ver ejemplos o demos", value: "Qué demos o ejemplos puedo revisar" }
    ];
  } else if (asksDiscountOrGuarantee) {
    answerParagraph =
      `${mixedPrefix}No puedo aprobar descuentos ni prometer ventas, retornos o posiciones garantizadas en Google: eso depende de tu mercado y del alcance real que evalúa el equipo de ENIX Studio. Podríamos comenzar por una primera versión acotada y medible.`;
    followUp = canOfferContact ? contactPrompt : "¿Qué resultado concreto quieres priorizar primero?";
    commercialStage = canOfferContact ? "evaluation" : "priorities";
    offerContact = canOfferContact;
    askedDiscoveryQuestion = !canOfferContact;
    links.push({ label: "Hablar con el equipo", href: "/contact/" });
  } else if (wantsImmediateContact) {
    const catLabel = inferredCategory && CATEGORY_LABELS[inferredCategory]
      ? CATEGORY_LABELS[inferredCategory].toLowerCase()
      : "tu proyecto";
    const proposalByCat =
      inferredCategory === "websites"
        ? "Para tu negocio partiría con un sitio web rápido orientado a captar consultas, con oferta clara y contacto o reservas directas."
        : inferredCategory === "management-systems"
          ? "Podríamos comenzar por un sistema centralizado para ordenar clientes, pedidos o tareas críticas y eliminar planillas manuales."
          : nextTrack === "marketing"
            ? "Podríamos comenzar por alinear tu oferta y activar captación enfocada en tu público (separando pauta en plataformas de honorarios)."
            : `Para ${catLabel} partiría con una primera versión acotada enfocada en el flujo principal que genera valor más rápido.`;
    answerParagraph = `${mixedPrefix}${proposalByCat} El equipo de ENIX revisará este resumen para proponerte etapas y alcance reales.`;
    followUp = canOfferContact ? contactPrompt : "Puedes usar el botón de contacto cuando gustes o seguir afinando detalles aquí.";
    commercialStage = "evaluation";
    offerContact = canOfferContact;
  } else if (isUnsureReply) {
    const catLabel = inferredCategory && CATEGORY_LABELS[inferredCategory]
      ? CATEGORY_LABELS[inferredCategory].toLowerCase()
      : "tu proyecto";
    answerParagraph =
      `Para ${catLabel} partiría resolviendo un único cuello de botella con una primera versión liviana que puedas validar rápido, sin sobrecargar el alcance.`;
    if (canOfferContact && lead.discoveryQuestionsAsked >= 1) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else {
      followUp = "¿Te urge más captar clientes o ahorrar horas internas de operación?";
      commercialStage = "priorities";
      askedDiscoveryQuestion = true;
      quickOptions = [
        { id: "un-1", label: "Captar más clientes", value: "Priorizar captar y convertir más clientes" },
        { id: "un-2", label: "Ahorrar tiempo y ordenar procesos", value: "Priorizar ahorrar tiempo y ordenar procesos internos" },
        { id: "un-other", label: "Otro enfoque", value: "__other__", kind: "other" }
      ];
    }
  } else if (asksHealth) {
    answerParagraph =
      `${mixedPrefix}Para salud partiría con agenda, ficha básica y permisos por rol, revisando privacidad y normativa aplicable con el equipo de ENIX Studio; no asumimos certificaciones previas sin validar el alcance real.`;
    followUp = canOfferContact ? contactPrompt : "¿Qué flujo deben resolver primero tus profesionales o pacientes?";
    commercialStage = canOfferContact ? "evaluation" : "priorities";
    offerContact = canOfferContact;
    askedDiscoveryQuestion = !canOfferContact;
    links.push(
      { label: "Explorar aplicaciones", href: "/solutions/applications/" },
      { label: "Hablar con el equipo", href: "/contact/" }
    );
  } else if (asksUndecidedPro) {
    answerParagraph =
      `${mixedPrefix}Para tu negocio partiría ordenando tu marca y lanzando un sitio web claro donde muestres tus cursos y tus clientes agenden o se inscriban sin idas y vueltas por DM.`;
    followUp = canOfferContact ? contactPrompt : "¿Prefieres partir por la web con agenda o marca + web juntos?";
    commercialStage = canOfferContact ? "evaluation" : "possibilities";
    offerContact = canOfferContact;
    askedDiscoveryQuestion = !canOfferContact;
    links.push(
      { label: "Explorar sitios web", href: "/solutions/websites/" },
      { label: "Branding y marca", href: "/marketing/brand-design/" }
    );
  } else if (asksSalonBooking && isFirstTurn) {
    const priceNote = asksPrice
      ? " La inversión real se define según abonos y agendas."
      : "";
    answerParagraph =
      `${mixedPrefix}Para tu peluquería partiría con un sitio web rápido en móvil con servicios y agenda de reservas online con confirmación automática por correo o aviso a WhatsApp, sin una app compleja.${priceNote}`;
    if (isDetailedInitial && canOfferContact) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else {
      followUp = "¿Atienden con una sola agenda o varios profesionales con horarios distintos?";
      commercialStage = "possibilities";
      askedDiscoveryQuestion = true;
      quickOptions = [
        { id: "sb-1", label: "Varios profesionales", value: "Atendemos con varios profesionales y horarios distintos" },
        { id: "sb-2", label: "Una sola agenda", value: "Usamos una sola agenda principal para los servicios" },
        { id: "sb-3", label: "Sumar abonos online", value: "Quiero sumar reservas con abono online" }
      ];
    }
    links.push(
      { label: "Ver demo de reservas", href: "/demos/bookings/" },
      { label: "Explorar sitios web", href: "/solutions/websites/" }
    );
  } else if (asksCafeAds && isFirstTurn) {
    answerParagraph =
      `${mixedPrefix}Con pauta mensual acotada en Instagram partiría con campañas locales enfocadas en una oferta concreta y un destino claro (carta o reserva). La pauta se paga directo a Meta y se separa de honorarios de ENIX, sin prometer retornos cerrados.`;
    if (isDetailedInitial && canOfferContact) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else {
      followUp = effectiveTerritory
        ? "¿Hoy cuentan con web o solo Instagram y Google Maps?"
        : "¿En qué comuna operas y hoy usan web o solo Instagram?";
      commercialStage = "possibilities";
      askedDiscoveryQuestion = true;
      quickOptions = [
        { id: "ca-1", label: "Solo Instagram", value: "Hoy solo tenemos Instagram activo y sin sitio web" },
        { id: "ca-2", label: "Instagram + Google Maps", value: "Tenemos Instagram y ficha en Google Maps, sin web optimizada" },
        { id: "ca-3", label: "Web simple + campañas", value: "Queremos una web simple o carta digital junto con las campañas" }
      ];
    }
    links.push(
      { label: "Publicidad digital", href: "/marketing/digital-advertising/" },
      { label: "SEO y presencia local", href: "/marketing/seo-local/" }
    );
  } else if (asksFieldMaintenance && isFirstTurn) {
    answerParagraph =
      `${mixedPrefix}Para tu operación partiría con una app web móvil con captura offline (órdenes, fotos y firma que sincronizan al recuperar señal) conectada a un tablero central para despacho y reportes.`;
    if (isDetailedInitial && canOfferContact) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else {
      followUp = "¿Qué dato o reporte (ej. PDF por cliente o ERP) es indispensable en la primera versión?";
      commercialStage = "possibilities";
      askedDiscoveryQuestion = true;
      selectionMode = "multi";
      quickOptions = [
        { id: "fm-1", label: "Reportes PDF por cliente", value: "Necesitamos reportes PDF automáticos por cliente" },
        { id: "fm-2", label: "Evaluar conexión con ERP/correo", value: "Queremos evaluar conexión con correo o ERP actual" },
        { id: "fm-3", label: "Solo captura offline + tablero", value: "Partir con captura offline en terreno y tablero central" }
      ];
    }
    links.push(
      { label: "Ver demo de operación", href: "/demos/order-management/" },
      { label: "Sistemas de gestión", href: "/solutions/management-systems/" }
    );
  } else if (isCrm && isFirstTurn) {
    answerParagraph =
      `${mixedPrefix}Para tu negocio partiría con un CRM a medida que centralice clientes, automatice seguimientos y muestre oportunidades de venta en un solo panel. También podríamos evaluar conexión con WhatsApp y cotizaciones.`;
    if (isDetailedInitial && canOfferContact) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else {
      followUp = "¿Qué necesitas ordenar primero?";
      commercialStage = "possibilities";
      askedDiscoveryQuestion = true;
      selectionMode = "multi";
      quickOptions = [
        { id: "crm-1", label: "Clientes y ventas", value: "Priorizar gestión de clientes y pipeline de ventas" },
        { id: "crm-2", label: "Automatizaciones", value: "Priorizar automatizaciones de seguimiento y avisos" },
        { id: "crm-3", label: "Equipo comercial", value: "Priorizar coordinación y metas del equipo comercial" },
        { id: "crm-other", label: "Otro", value: "__other__", kind: "other" }
      ];
    }
    links.push(
      { label: "Sistemas de gestión", href: "/solutions/management-systems/" },
      { label: "Automatizaciones", href: "/solutions/automations/" }
    );
  } else if (isDelivery && isFirstTurn) {
    answerParagraph =
      `${mixedPrefix}Podríamos comenzar por una app de delivery con catálogo en vivo, seguimiento de pedidos en tiempo real y panel de despacho. Esto permitiría ordenar entregas y evaluar pagos en línea.`;
    if (isDetailedInitial && canOfferContact) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else {
      followUp = "¿Es para repartir pedidos de tu propio negocio o conectar varios locales?";
      commercialStage = "possibilities";
      askedDiscoveryQuestion = true;
      quickOptions = [
        { id: "del-1", label: "Solo mi negocio", value: "Es para repartir pedidos de mi propio negocio" },
        { id: "del-2", label: "Varios locales", value: "Es una plataforma para conectar varios locales y repartidores" },
        { id: "del-unsure", label: "No estoy seguro", value: "__unsure__", kind: "unsure" }
      ];
    }
    links.push(
      { label: "Explorar aplicaciones", href: "/solutions/applications/" },
      { label: "Demo de pedidos", href: "/demos/order-management/" }
    );
  } else if (isIndustrial && isFirstTurn) {
    answerParagraph =
      `${mixedPrefix}Podríamos comenzar por un sistema industrial a medida para controlar órdenes de trabajo, trazabilidad y mantenimiento en tiempo real, con captura móvil en planta y reportes automáticos.`;
    if (isDetailedInitial && canOfferContact) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else {
      followUp = "¿Qué proceso industrial necesitas ordenar primero?";
      commercialStage = "possibilities";
      askedDiscoveryQuestion = true;
      selectionMode = "multi";
      quickOptions = [
        { id: "ind-1", label: "Órdenes y mantenimiento", value: "Ordenar órdenes de trabajo y mantenimiento preventivo" },
        { id: "ind-2", label: "Producción y trazabilidad", value: "Control de producción, inventario y trazabilidad" },
        { id: "ind-3", label: "Operación móvil en planta", value: "Registro móvil en planta o terreno con reportes" },
        { id: "ind-other", label: "Otro proceso", value: "__other__", kind: "other" }
      ];
    }
    links.push(
      { label: "Sistemas de gestión", href: "/solutions/management-systems/" },
      { label: "Demo de operación", href: "/demos/order-management/" }
    );
  } else if (isExcelPain && isFirstTurn) {
    answerParagraph =
      `${mixedPrefix}Para dejar atrás Excel partiría con un sistema simple donde tu equipo cargue datos en segundos, todo quede centralizado sin duplicados y los reportes salgan solos.`;
    if (isDetailedInitial && canOfferContact) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else {
      followUp = "¿Qué proceso llevas hoy en Excel que te quita más tiempo?";
      commercialStage = "possibilities";
      askedDiscoveryQuestion = true;
      selectionMode = "multi";
      quickOptions = [
        { id: "ex-1", label: "Clientes y cotizaciones", value: "Llevamos clientes, cotizaciones y ventas en Excel" },
        { id: "ex-2", label: "Pedidos, stock o despachos", value: "Llevamos pedidos, inventario o despachos en Excel" },
        { id: "ex-3", label: "Equipo, horas o cobros", value: "Llevamos control de equipo, horas o cobros en Excel" },
        { id: "ex-other", label: "Otro proceso", value: "__other__", kind: "other" }
      ];
    }
    links.push(
      { label: "Sistemas de gestión", href: "/solutions/management-systems/" },
      { label: "Ver demo de pedidos", href: "/demos/order-management/" }
    );
  } else if (isAutomation && isFirstTurn) {
    answerParagraph =
      `${mixedPrefix}Podríamos comenzar por automatizar tareas repetitivas conectando tus formularios, correos, WhatsApp o planillas. Esto permitiría que tu equipo ahorre horas manuales y reduzca errores.`;
    if (isDetailedInitial && canOfferContact) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else {
      followUp = "¿En qué área pierden más horas manuales hoy?";
      commercialStage = "possibilities";
      askedDiscoveryQuestion = true;
      selectionMode = "multi";
      quickOptions = [
        { id: "au-1", label: "Ventas y seguimiento", value: "Perdemos tiempo en seguimiento manual de leads y cotizaciones" },
        { id: "au-2", label: "Pedidos y operación", value: "Perdemos tiempo pasando pedidos o datos entre planillas" },
        { id: "au-3", label: "Reportes y administración", value: "Perdemos tiempo armando reportes, cobros o avisos" },
        { id: "au-unsure", label: "No estoy seguro", value: "__unsure__", kind: "unsure" }
      ];
    }
    links.push(
      { label: "Ver demo de automatización", href: "/demos/automation/" },
      { label: "Automatizaciones", href: "/solutions/automations/" }
    );
  } else if (isAiBiz && isFirstTurn) {
    answerParagraph =
      `${mixedPrefix}Para tu negocio partiría aplicando IA en un flujo concreto: atender y calificar consultas, clasificar documentos o resumir reportes internos, siempre con control humano.`;
    if (isDetailedInitial && canOfferContact) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else {
      followUp = "¿Dónde te ahorraría más horas aplicar IA primero?";
      commercialStage = "possibilities";
      askedDiscoveryQuestion = true;
      selectionMode = "multi";
      quickOptions = [
        { id: "ai-1", label: "Atender y calificar clientes", value: "Quiero usar IA para atender y calificar consultas de clientes" },
        { id: "ai-2", label: "Procesar documentos", value: "Quiero usar IA para resumir o clasificar documentos internos" },
        { id: "ai-3", label: "Soporte interno", value: "Quiero usar IA para soporte o respuestas repetitivas" },
        { id: "ai-unsure", label: "No estoy seguro", value: "__unsure__", kind: "unsure" }
      ];
    }
    links.push({ label: "Soluciones de IA", href: "/solutions/ai-solutions/" });
  } else if (isGenericWeb && isFirstTurn) {
    answerParagraph =
      `${mixedPrefix}Para tu negocio partiría con un sitio web rápido enfocado en captar clientes, incorporando reservas, catálogo interactivo o ventas online según lo que ofreces.`;
    if (isDetailedInitial && canOfferContact) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else {
      followUp = "¿Es para una empresa que ya funciona o un proyecto nuevo?";
      commercialStage = "possibilities";
      askedDiscoveryQuestion = true;
      quickOptions = [
        { id: "wb-1", label: "Empresa que ya funciona", value: "Es para una empresa que ya funciona" },
        { id: "wb-2", label: "Proyecto nuevo", value: "Es para un proyecto nuevo" },
        { id: "wb-3", label: "Renovar web actual", value: "Quiero renovar nuestra web actual" },
        { id: "wb-unsure", label: "No estoy seguro", value: "__unsure__", kind: "unsure" }
      ];
    }
    links.push({ label: "Explorar sitios web", href: "/solutions/websites/" });
  } else if (isSellMore && isFirstTurn) {
    answerParagraph =
      `${mixedPrefix}Para atraer más clientes partiría combinando campañas segmentadas y una página de captación clara, separando siempre la pauta en anuncios de los honorarios de ENIX y sin prometer resultados garantizados.`;
    if (isDetailedInitial && canOfferContact) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else {
      followUp = "¿Hoy consigues más clientes por redes sociales, Google o recomendaciones?";
      commercialStage = "possibilities";
      askedDiscoveryQuestion = true;
      selectionMode = "multi";
      quickOptions = [
        { id: "sm-1", label: "Redes sociales", value: "Hoy conseguimos más clientes por redes sociales" },
        { id: "sm-2", label: "Google / búsquedas", value: "Hoy conseguimos más clientes por Google o búsquedas locales" },
        { id: "sm-3", label: "Recomendaciones", value: "Hoy dependemos principalmente de recomendaciones" },
        { id: "sm-4", label: "Sin canal constante", value: "Aún no tenemos un canal constante de captación" }
      ];
    }
    links.push(
      { label: "Marketing digital", href: "/marketing/" },
      { label: "Publicidad digital", href: "/marketing/digital-advertising/" }
    );
  } else if (asksPrice) {
    answerParagraph =
      `${mixedPrefix}No damos precios cerrados a ciegas porque la inversión depende del alcance real y las integraciones (y en marketing, la pauta va separada de honorarios). Con este resumen inicial el equipo puede darte una evaluación realista.`;
    followUp = canOfferContact ? contactPrompt : "¿Qué flujo mínimo necesitas lanzar primero?";
    commercialStage = canOfferContact ? "evaluation" : "priorities";
    offerContact = canOfferContact;
    askedDiscoveryQuestion = !canOfferContact;
    links.push({ label: "Cómo trabajamos", href: "/how-we-work/" });
  } else if (!isFirstTurn && canOfferContact && (lead.discoveryQuestionsAsked >= 1 || readiness.defined.length >= 3)) {
    // ELIMINATE INTERROGATION: After 1-2 discovery questions, give concrete value + offer contact directly!
    const catLabel = inferredCategory && CATEGORY_LABELS[inferredCategory]
      ? CATEGORY_LABELS[inferredCategory].toLowerCase()
      : "tu proyecto";
    answerParagraph =
      `${mixedPrefix}Con ese enfoque para ${catLabel}, podríamos comenzar por una primera versión centrada en lo que acabas de priorizar, dejando mejoras secundarias para una segunda etapa. Ya guardé este resumen en segundo plano.`;
    followUp = contactPrompt;
    commercialStage = "evaluation";
    offerContact = true;
  } else if (nextTrack === "marketing" || nextTrack === "combined") {
    const catName = inferredCategory && CATEGORY_LABELS[inferredCategory]
      ? CATEGORY_LABELS[inferredCategory].toLowerCase()
      : "marketing digital";
    answerParagraph =
      `${mixedPrefix}Para ${catName} partiría enfocando el mensaje y la página de destino antes de escalar pauta, separando inversión en anuncios de honorarios.`;
    if (canOfferContact && lead.discoveryQuestionsAsked >= 1) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else if (!effectiveTerritory) {
      followUp = "¿En qué ciudad o territorio quieres captar clientes principalmente?";
      commercialStage = "priorities";
      askedDiscoveryQuestion = true;
      quickOptions = [
        { id: "mk-loc1", label: "Mi ciudad / comuna", value: "Clientes en Santiago y alrededores" },
        { id: "mk-loc2", label: "Todo el país", value: "Clientes en todo Chile de forma online" },
        { id: "mk-loc3", label: "Latam / internacional", value: "Clientes en Latam" }
      ];
    } else {
      followUp = "Ya dejé este avance registrado en tu ficha; si quieres profundizar en canales o presupuesto, cuéntame.";
      commercialStage = "summary";
    }
    if (inferredCategory && inferredCategory !== "marketing" && MARKETING_CATEGORY_SLUGS.has(inferredCategory)) {
      links.push({ label: `Ver ${CATEGORY_LABELS[inferredCategory]}`, href: `/marketing/${inferredCategory}/` });
    }
  } else {
    const catName = inferredCategory && CATEGORY_LABELS[inferredCategory]
      ? CATEGORY_LABELS[inferredCategory].toLowerCase()
      : "tu proyecto";
    answerParagraph =
      `${mixedPrefix}Anotado para ${catName}. Esto permitiría estructurar una primera versión clara sin sobredimensionar el alcance.`;

    if (canOfferContact && lead.discoveryQuestionsAsked >= 1) {
      followUp = contactPrompt;
      commercialStage = "evaluation";
      offerContact = true;
    } else if (effectiveUsersCount === 0) {
      followUp = "¿Lo usará tu equipo interno, tus clientes finales o ambos?";
      commercialStage = "scope";
      askedDiscoveryQuestion = true;
      quickOptions = [
        { id: "dv-u1", label: "Equipo interno", value: "Lo usará principalmente nuestro equipo interno" },
        { id: "dv-u2", label: "Clientes finales", value: "Lo usarán directamente nuestros clientes" },
        { id: "dv-u3", label: "Ambos", value: "Lo usarán clientes finales y nuestro equipo interno" }
      ];
    } else {
      followUp = "Ya dejé este avance en tu ficha; si quieres ajustar algún detalle técnico o de alcance, dime aquí.";
      commercialStage = "summary";
    }

    if (inferredCategory && ["websites", "applications", "management-systems", "platforms", "automations", "ai-solutions"].includes(inferredCategory)) {
      links.push({ label: `Explorar ${CATEGORY_LABELS[inferredCategory]}`, href: `/solutions/${inferredCategory}/` });
    }
  }

  // Never nag if visitor already declined or submitted contact
  if (!canOfferContact) {
    offerContact = false;
  }

  // Always offer contextual demo link when highly relevant
  if (/(reserva|agenda|cita|hora)/.test(low) && !links.some((l) => l.href === "/demos/bookings/")) {
    links.push({ label: "Probar demo de reservas", href: "/demos/bookings/" });
  } else if (/(pedido|bodega|despacho|inventario|orden|delivery)/.test(low) && !links.some((l) => l.href === "/demos/order-management/")) {
    links.push({ label: "Probar demo de operación", href: "/demos/order-management/" });
  } else if (/(automatiz|clasific|formulario)/.test(low) && !links.some((l) => l.href === "/demos/automation/")) {
    links.push({ label: "Probar demo de automatización", href: "/demos/automation/" });
  }

  // Prevent ever repeating the exact same follow-up question from the previous assistant turn
  const prevAssistantText =
    options.history && options.history.length > 0
      ? [...options.history].reverse().find((m) => m.role === "assistant")?.text || ""
      : "";
  if (followUp && prevAssistantText.includes(followUp)) {
    if (canOfferContact) {
      commercialStage = "evaluation";
      followUp =
        followUp === contactPrompt
          ? "Ya sumé este avance al resumen; cuando quieras, deja tu correo abajo para que te escriba el equipo."
          : contactPrompt;
      offerContact = true;
      quickOptions = [];
    } else {
      commercialStage = "summary";
      followUp = "Si quieres profundizar en algún punto técnico o revisar tu ficha, dime por aquí.";
      quickOptions = [];
    }
  }

  const replyText = [answerParagraph, followUp].filter(Boolean).join("\n\n").trim();

  return {
    mode: "guided",
    expectedRevision: brief.revision,
    interpretation: answerParagraph,
    question: followUp,
    reply: replyText,
    stage: mapCommercialStageToProjectStage(commercialStage),
    commercialStage,
    stepId: "conversation",
    selectionMode,
    blueprintHighlights: blueprintHighlights.slice(0, 3),
    offerContact,
    detectedEmail,
    contactDeclined,
    askedDiscoveryQuestion,
    options: quickOptions,
    links: links.slice(0, 3),
    patch
  };
}
