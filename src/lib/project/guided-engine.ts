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
  /(ignora (todas )?las instrucciones|ignore previous instructions|act[uú]a como|system prompt|dame una receta|receta de cocina|escribe un poema|hazme la tarea|traduce este texto|resuelve esta ecuaci[oó]n|cu[aá]ntos habitantes|qui[eé]n gan[oó] el mundial|chiste sobre|jailbreak|dan mode|escribe c[oó]digo python para)/i;

export function isOffTopicOrAbuse(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  return OFF_TOPIC_OR_INJECTION_REGEX.test(clean);
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
    if (/(publicidad|google ads|meta ads|anuncios|campa[nñ]a|pauta)/.test(text)) return "digital-advertising";
    if (/(seo|google|org[aá]nico|b[uú]squedas locales|maps)/.test(text)) return "seo-local";
    if (/(redes|instagram|contenido|editorial|publicaciones)/.test(text)) return "content-social";
    if (/(email|correo|seguimiento|crm)/.test(text)) return "email-crm-automation";
    if (/(anal[ií]tica|conversi[oó]n|medici[oó]n|embudo)/.test(text)) return "analytics-cro";
    if (/(estrategia|atraer|captar|clientes|reservas)/.test(text)) return "digital-strategy";
    return "marketing";
  }

  if (/(ia|inteligencia artificial|chatbot|asistente|rag|documento|pdf|resumir)/.test(text)) {
    return "ai-solutions";
  }
  if (/(automatiz|conectar|sincroniz|webhook|zapier|repetitiv|flujo autom)/.test(text)) {
    return "automations";
  }
  if (/(portal|clientes puedan|proveedores|distribuidores|colaboradores|b2b|intranet)/.test(text)) {
    return "platforms";
  }
  if (/(pedido|inventario|bodega|excel|whatsapp|gesti[oó]n|erp|crm|stock|despacho|ordenar la operaci)/.test(text)) {
    return "management-systems";
  }
  if (/(app|aplicaci[oó]n|celular|m[oó]vil|ios|android|reservar|reserva|agenda)/.test(text)) {
    return "applications";
  }
  if (/(web|sitio|p[aá]gina|landing|tienda|cat[aá]logo|presencia digital)/.test(text)) {
    return "websites";
  }
  return null;
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
          { id: "mh-1", label: "Tengo redes activas, pero sin web o web básica", value: "Redes activas, sin web optimizada; aún no hemos hecho campañas estructuradas" },
          { id: "mh-2", label: "Ya probé anuncios pero con pocos resultados", value: "Ya tenemos web y probamos anuncios antes, pero sin suficiente conversión ni medición clara" },
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
    patch.addRequirements = [
      makeRequirement(
        cleanIdea.length > 140 ? `${cleanIdea.slice(0, 137)}…` : cleanIdea,
        "confirmed",
        "user",
        "initial",
        "idea"
      )
    ];
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
      patch.businessOffer = brief.businessOffer || answer;
      patch.commercialGoal = answer;
      patch.addRequirements = [makeRequirement(answer, "confirmed", origin, "initial", "goal")];
      interpretation = "Registré tu objetivo comercial en la ficha.";
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
      patch.declaredTimeline = answer;
      if (!brief.adSpendBudget) patch.adSpendBudget = "Por definir (separado de honorarios)";
      if (!brief.serviceBudget) patch.serviceBudget = "Por definir según alcance";
      interpretation =
        "Registré tus expectativas de fechas. En la ficha puedes editar por separado la inversión en anuncios y el presupuesto de servicios.";
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
      patch.expectedOutcome = `Resolver de forma ordenada: ${answer}`;
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
