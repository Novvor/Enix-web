export type MarketingSlug =
  | "digital-strategy"
  | "digital-advertising"
  | "seo-local"
  | "content-social"
  | "email-crm-automation"
  | "analytics-cro"
  | "brand-design";

export interface MarketingServiceItem {
  slug: MarketingSlug;
  name: string;
  shortDescription: string;
  isComplementary?: boolean;
  eyebrow: string;
  headline: string;
  intro: string;
  businessObjectives: string[];
  deliverables: string[];
  modalityNote: string;
  indicatorsNote: string;
  relatedTech: { label: string; href: string; reason: string }[];
  starterPrompt: string;
  previewType: "strategy" | "ads" | "seo" | "social" | "email" | "analytics" | "brand";
}

export const marketingServices: MarketingServiceItem[] = [
  {
    slug: "digital-strategy",
    name: "Estrategia digital",
    shortDescription: "Diagnóstico, objetivos, público, propuesta de valor y selección de canales.",
    eyebrow: "Estrategia digital",
    headline: "Define a quién dirigirte, qué mensaje usar y en qué canales conviene invertir primero.",
    intro:
      "Antes de lanzar anuncios o publicar contenido sin rumbo, ordenamos el punto de partida comercial: propuesta de valor, segmentos prioritarios, recorrido del cliente y plan de acción.",
    businessObjectives: [
      "Alinear la oferta del negocio con lo que realmente buscan tus clientes.",
      "Priorizar canales según tipo de venta, territorio y recursos disponibles.",
      "Evitar gasto disperso en campañas o contenidos desconectados del sitio web."
    ],
    deliverables: [
      "Diagnóstico de presencia digital actual (web, canales y mensajes).",
      "Definición de públicos objetivo, propuesta de valor y mensajes clave.",
      "Selección de canales prioritarios y mapa de recorrido de captación.",
      "Hoja de ruta por etapas con indicadores sugeridos para acordar."
    ],
    modalityNote: "Puede realizarse como trabajo puntual previo a campañas o como base de un acompañamiento trimestral.",
    indicatorsNote: "Acordamos qué medir según el objetivo (consultas calificadas, reservas, solicitudes o costo por oportunidad), sin prometer cifras cerradas de antemano.",
    relatedTech: [
      { label: "Sitios web", href: "/solutions/websites/", reason: "Alinear la web con la propuesta de valor y los mensajes definidos." },
      { label: "Analítica y conversión", href: "/marketing/analytics-cro/", reason: "Medir el recorrido completo desde la captación hasta la consulta." }
    ],
    starterPrompt:
      "Quiero definir una estrategia digital para mi negocio: aclarar mi público, propuesta de valor y elegir los canales más adecuados para atraer clientes.",
    previewType: "strategy"
  },
  {
    slug: "digital-advertising",
    name: "Publicidad digital",
    shortDescription: "Campañas en Google Ads y Meta Ads, mensajes, piezas publicitarias, páginas de captación y seguimiento.",
    eyebrow: "Publicidad digital",
    headline: "Campañas estructuradas en Google Ads y Meta Ads conectadas a páginas que convierten.",
    intro:
      "Planificamos la estructura de campañas, redactamos mensajes claros, diseñamos piezas publicitarias y conectamos páginas de captación y medición para atraer consultas, reservas o compras.",
    businessObjectives: [
      "Captar demanda activa en buscadores (Google Ads) cuando el cliente ya busca una solución.",
      "Generar interés y consideración en audiencias definidas (Meta Ads) con mensajes y piezas claras.",
      "Conectar cada anuncio con una página de destino coherente y seguimiento verificable."
    ],
    deliverables: [
      "Arquitectura de campañas, audiencias, palabras clave y propuesta de anuncios.",
      "Piezas creativas y copys adaptados a cada formato de campaña.",
      "Recomendación o desarrollo coordinado de páginas de captación.",
      "Configuración de seguimiento de conversiones e informes periódicos claros."
    ],
    modalityNote: "Ideal como lanzamiento puntual para una oferta específica o acompañamiento mensual con optimización continua. La inversión publicitaria pagada a las plataformas siempre se separa de los honorarios de gestión.",
    indicatorsNote: "Revisamos consultas, reservas, costo por contacto y calidad de oportunidades junto a tu equipo; no prometemos retorno garantizado ni volumen fijo de ventas.",
    relatedTech: [
      { label: "Sitios web", href: "/solutions/websites/", reason: "Páginas de captación rápidas y específicas para cada campaña." },
      { label: "Automatizaciones", href: "/solutions/automations/", reason: "Derivar los contactos recibidos directo al equipo o CRM." }
    ],
    starterPrompt:
      "Quiero planificar campañas de publicidad digital en Google Ads o Meta Ads para conseguir más consultas o reservas para mi negocio.",
    previewType: "ads"
  },
  {
    slug: "seo-local",
    name: "SEO y presencia local",
    shortDescription: "Estructura y contenidos del sitio, posicionamiento orgánico y presencia del negocio en búsquedas locales.",
    eyebrow: "SEO y presencia local",
    headline: "Ordena tu sitio y tu presencia local para que te encuentren cuando buscan lo que haces.",
    intro:
      "Trabajamos la arquitectura técnica del sitio, los contenidos orientados a intención real de búsqueda y la ficha local del negocio para construir visibilidad orgánica sostenible.",
    businessObjectives: [
      "Mejorar cómo los buscadores entienden tus servicios, categorías y cobertura geográfica.",
      "Fortalecer la presencia en búsquedas locales para negocios con atención física o regional.",
      "Reducir la dependencia exclusiva de pauta paga a mediano plazo."
    ],
    deliverables: [
      "Auditoría técnica y de contenidos sobre tu sitio actual.",
      "Arquitectura de páginas por intención de búsqueda y optimización on-page.",
      "Guía y optimización de presencia local (fichas, categorías y coherencia de datos).",
      "Plan editorial orgánico y tablero de seguimiento de visibilidad."
    ],
    modalityNote: "Puede contratarse como optimización inicial puntual o evolución periódica de contenidos y mejoras técnicas.",
    indicatorsNote: "Seguimos impresiones, clics orgánicos, páginas indexadas y consultas atribuidas; el posicionamiento depende del mercado y la competencia, por lo que nunca prometemos posiciones garantizadas.",
    relatedTech: [
      { label: "Sitios web", href: "/solutions/websites/", reason: "Base técnica rápida, semántica limpia y buena experiencia móvil." },
      { label: "Contenido y redes sociales", href: "/marketing/content-social/", reason: "Artículos y páginas de apoyo útiles para clientes reales." }
    ],
    starterPrompt:
      "Quiero mejorar el SEO y la presencia local de mi negocio para aparecer mejor cuando los clientes buscan nuestros servicios.",
    previewType: "seo"
  },
  {
    slug: "content-social",
    name: "Contenido y redes sociales",
    shortDescription: "Estrategia editorial, textos, diseño de publicaciones y planificación de contenidos.",
    eyebrow: "Contenido y redes sociales",
    headline: "Comunicación constante y bien diseñada que explica tu valor y genera confianza.",
    intro:
      "Definimos líneas editoriales claras, redactamos textos útiles y diseñamos piezas visuales coherentes con tu marca para que tus redes acompañen el proceso comercial.",
    businessObjectives: [
      "Mantener una presencia profesional que respalde las visitas que llegan desde campañas o recomendaciones.",
      "Explicar servicios, procesos y diferenciales sin caer en publicaciones genéricas.",
      "Organizar un calendario editorial sostenible con aprobaciones claras."
    ],
    deliverables: [
      "Estrategia editorial, tono de voz y pilares de contenido.",
      "Planificación mensual y redacción de textos para publicaciones.",
      "Diseño gráfico de piezas y formatos adaptados a cada red.",
      "Revisión periódica de interacción y aprendizajes para el siguiente ciclo."
    ],
    modalityNote: "Pensado principalmente como acompañamiento periódico mensual, o como kit inicial de lanzamiento con plantillas editables.",
    indicatorsNote: "Evaluamos alcance cualificado, clics al sitio, consultas iniciadas y consistencia de marca.",
    relatedTech: [
      { label: "Branding y diseño de marca", href: "/marketing/brand-design/", reason: "Sistema visual coherente para que cada pieza sea reconocible." },
      { label: "Publicidad digital", href: "/marketing/digital-advertising/", reason: "Amplificar los mensajes que mejor conectan con la audiencia." }
    ],
    starterPrompt:
      "Quiero ordenar el contenido y las redes sociales de mi negocio con una estrategia editorial clara y piezas bien diseñadas.",
    previewType: "social"
  },
  {
    slug: "email-crm-automation",
    name: "Email y automatización comercial",
    shortDescription: "Comunicaciones, seguimiento de oportunidades y conexión con las herramientas existentes del negocio.",
    eyebrow: "Email y automatización comercial",
    headline: "Haz seguimiento oportuno a cada contacto sin depender de recordar todo a mano.",
    intro:
      "Diseñamos secuencias de correo, avisos automáticos y conexiones entre formularios, CRM y herramientas del equipo para que ninguna oportunidad se enfríe por falta de seguimiento.",
    businessObjectives: [
      "Responder con rapidez y orden cada vez que entra una consulta o solicitud.",
      "Mantener contacto útil con clientes actuales y cotizaciones abiertas.",
      "Conectar captación web y campañas con el flujo diario de ventas."
    ],
    deliverables: [
      "Diseño de flujos de seguimiento y secuencias de correo acordadas.",
      "Redacción y diseño de plantillas claras y legibles en móvil.",
      "Integración con formularios del sitio, CRM o planillas existentes.",
      "Criterios de segmentación y revisión de entregabilidad."
    ],
    modalityNote: "Funciona muy bien como implementación puntual llave en mano, con opción de optimización periódica.",
    indicatorsNote: "Revisamos tiempos de respuesta, tasas de apertura/clic y oportunidades retomadas en el flujo comercial.",
    relatedTech: [
      { label: "Automatizaciones", href: "/solutions/automations/", reason: "Integraciones técnicas robustas entre formularios, correo y CRM." },
      { label: "Sistemas de gestión", href: "/solutions/management-systems/", reason: "Centralizar estados de pedidos y seguimiento comercial." }
    ],
    starterPrompt:
      "Quiero implementar email marketing y automatización comercial para dar mejor seguimiento a las consultas y clientes de mi negocio.",
    previewType: "email"
  },
  {
    slug: "analytics-cro",
    name: "Analítica y conversión",
    shortDescription: "Medición y mejora de recorridos para convertir visitas en consultas, reservas o compras.",
    eyebrow: "Analítica y conversión",
    headline: "Entiende qué ocurre en tu sitio y elimina la fricción donde se pierden oportunidades.",
    intro:
      "Configuramos medición útil sobre eventos reales del negocio y proponemos mejoras concretas de contenido, formularios y experiencia para aprovechar mejor cada visita.",
    businessObjectives: [
      "Saber qué canales y páginas generan consultas reales y cuáles solo traen visitas sin acción.",
      "Detectar puntos de abandono en formularios, agendas de reserva o catálogos.",
      "Tomar decisiones de mejora basadas en comportamiento observado y no en suposiciones."
    ],
    deliverables: [
      "Plan de medición de eventos clave (consultas, reservas, clics críticos).",
      "Revisión de recorridos en escritorio y móvil con prioridades concretas.",
      "Propuesta e implementación de mejoras de conversión (mensajes, formularios, CTA).",
      "Reporte entendible para dirección y equipo comercial."
    ],
    modalityNote: "Disponible como diagnóstico e implementación puntual o ciclos periódicos de mejora continua.",
    indicatorsNote: "Acordamos métricas base antes de modificar el recorrido para comparar con criterio real.",
    relatedTech: [
      { label: "Sitios web", href: "/solutions/websites/", reason: "Aplicar mejoras de velocidad, jerarquía y formularios directo en la web." },
      { label: "Publicidad digital", href: "/marketing/digital-advertising/", reason: "Aumentar el aprovechamiento del tráfico generado por campañas." }
    ],
    starterPrompt:
      "Quiero mejorar la medición y la conversión de mi sitio web para entender qué canales funcionan y transformar más visitas en contactos o reservas.",
    previewType: "analytics"
  },
  {
    slug: "brand-design",
    name: "Branding y diseño de marca",
    shortDescription: "Identidad visual, mensajes y materiales gráficos — desde marcas completas hasta piezas de campaña.",
    isComplementary: true,
    eyebrow: "Servicio complementario · Marca",
    headline: "Una identidad coherente para presentar tu negocio con claridad en web, campañas y operación.",
    intro:
      "Acompañamos tanto la creación o renovación integral de una marca como el diseño de materiales específicos cuando ya cuentas con identidad y necesitas salir a comunicar.",
    businessObjectives: [
      "Diferenciar tu propuesta con una imagen profesional, memorable y consistente.",
      "Unificar tono de mensajes y criterios visuales entre web, redes y presentaciones.",
      "Acelerar el lanzamiento de campañas sin rehacer la identidad desde cero cuando no hace falta."
    ],
    deliverables: [
      "Identidad de marca completa: sistema visual, tipografía, paleta, usos del logo, tono de mensajes y guía base.",
      "O piezas para campaña: adaptaciones visuales, anuncios, banners, presentaciones o soportes puntuales sobre tu marca actual."
    ],
    modalityNote:
      "Diferenciamos siempre una identidad de marca completa (trabajo estructural) del diseño de piezas para una campaña puntual (alcance acotado).",
    indicatorsNote: "Validamos consistencia visual, claridad percibida y facilidad de aplicación en canales digitales y comerciales.",
    relatedTech: [
      { label: "Sitios web", href: "/solutions/websites/", reason: "Trasladar la identidad directamente a un sistema web coherente." },
      { label: "Contenido y redes sociales", href: "/marketing/content-social/", reason: "Aplicar la guía visual en publicaciones y materiales continuos." }
    ],
    starterPrompt:
      "Quiero mejorar la marca de mi negocio: ordenar identidad visual, mensajes y materiales gráficos para web y campañas.",
    previewType: "brand"
  }
];

export const primaryMarketingServices = marketingServices.filter((s) => !s.isComplementary);
export const brandComplementaryService = marketingServices.find((s) => s.slug === "brand-design")!;

export function getMarketingServiceBySlug(slug: string): MarketingServiceItem | undefined {
  return marketingServices.find((s) => s.slug === slug);
}
