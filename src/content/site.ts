export const siteConfig = {
  brandName: "ENIX Studio",
  legalParent: "NOVVOR",
  siteUrl: "https://www.enix.studio",
  contactEmail: "hello@enix.studio",
  location: "Santiago de Chile · Proyectos en Latinoamérica y mercados globales",
  tagline: "Diseño, desarrollo y marketing digital.",
  defaultTitle: "ENIX Studio — Diseño, desarrollo y marketing digital a medida",
  defaultDescription:
    "Diseño, desarrollo y marketing digital para crear, lanzar y hacer crecer tu negocio: webs, apps, sistemas, marca, SEO, campañas y automatización comercial.",
  responsibilityStatement:
    "El asistente ayuda a definir el proyecto. El equipo de ENIX diseña, desarrolla, planifica y acompaña su implementación."
};

export interface AudiencePath {
  slug: "entrepreneurs" | "businesses";
  title: string;
  navDescription: string;
  eyebrow: string;
  headline: string;
  summary: string;
  situations: string[];
  examples: string[];
  accompaniment: { title: string; detail: string }[];
  starterPrompt: string;
}

export const audiencePaths: AudiencePath[] = [
  {
    slug: "entrepreneurs",
    title: "Emprendedores y negocios",
    navDescription:
      "Una nueva web, un servicio digital, una primera versión de producto o una operación pequeña que necesita orden.",
    eyebrow: "Emprendedores y negocios",
    headline: "Lleva tu idea a una primera versión clara, usable y lista para crecer.",
    summary:
      "Trabajamos contigo para convertir una necesidad concreta en una web, aplicación o herramienta digital bien pensada, sin obligarte a dominar tecnicismos ni construir de más desde el primer día.",
    situations: [
      "Quieres lanzar una web que explique con claridad qué vendes y facilite reservas o consultas.",
      "Tienes una idea de aplicación o servicio digital y necesitas definir una primera versión realista.",
      "Tu negocio creció y hoy coordinas pedidos, clientes o agenda entre WhatsApp y planillas.",
      "Buscas un equipo que te ayude a priorizar qué va primero y qué conviene dejar para después."
    ],
    examples: [
      "Sitio web comercial con agenda de reservas y campañas iniciales de captación.",
      "Primera versión funcional de una aplicación web o móvil para validar con clientes reales.",
      "Identidad de marca, mensajes claros y presencia local para atraer nuevos clientes.",
      "Automatizaciones para responder consultas frecuentes y hacer seguimiento sin trabajo manual."
    ],
    accompaniment: [
      {
        title: "Priorización sin relleno",
        detail: "Separamos lo esencial para salir al mercado de las mejoras para una segunda etapa."
      },
      {
        title: "Diseño que genera confianza",
        detail: "Tu negocio se presenta con el mismo rigor visual y técnico que una operación consolidada."
      },
      {
        title: "Base preparada para evolucionar",
        detail: "Construimos sobre arquitectura limpia para sumar funciones cuando el negocio lo pida."
      }
    ],
    starterPrompt:
      "Estoy impulsando mi negocio y necesito una primera versión digital para atender mejor a mis clientes y ordenar la operación."
  },
  {
    slug: "businesses",
    title: "Empresas y operaciones",
    navDescription:
      "Sistemas existentes, varios equipos, roles, integraciones, procesos críticos y necesidades de continuidad.",
    eyebrow: "Empresas y operaciones",
    headline: "Ordena procesos, conecta sistemas y construye herramientas a la medida de tu equipo.",
    summary:
      "Acompañamos a equipos comerciales, operativos y de tecnología en el diseño y desarrollo de portales, sistemas internos, integraciones y asistentes de IA con control, trazabilidad y continuidad.",
    situations: [
      "Varios equipos trabajan sobre herramientas desconectadas, correos y hojas de cálculo críticas.",
      "Necesitas un portal para clientes, distribuidores o colaboradores con permisos y seguimiento.",
      "Quieres modernizar una web corporativa o catálogo B2B sin perder posicionamiento ni operación.",
      "Buscas automatizar flujos o consultar documentación interna con IA manteniendo revisión humana."
    ],
    examples: [
      "Sistema de gestión de pedidos con roles para ventas, bodega y administración.",
      "Portal B2B con catálogo técnico, solicitudes de cotización y seguimiento de estados.",
      "Estrategia digital, SEO, campañas y analítica conectadas con CRM y páginas de captación.",
      "Asistente interno de consulta documental con fuentes aprobadas y trazabilidad."
    ],
    accompaniment: [
      {
        title: "Entendimiento de la operación real",
        detail: "Mapeamos roles, excepciones y sistemas existentes antes de escribir una línea de código."
      },
      {
        title: "Integración y continuidad",
        detail: "Respetamos tus herramientas actuales y planificamos despliegues sin detener el trabajo diario."
      },
      {
        title: "Entregables documentados",
        detail: "Entregamos código limpio, documentación operativa y opciones claras de acompañamiento."
      }
    ],
    starterPrompt:
      "En nuestra empresa necesitamos conectar procesos entre equipos y reducir trabajo manual en la operación diaria."
  }
];

export interface ProcessStage {
  number: string;
  name: string;
  summary: string;
  description: string;
  deliverable: string;
  clientParticipation: string;
}

export const processStages: ProcessStage[] = [
  {
    number: "01",
    name: "Entender",
    summary: "Alineamos objetivos, usuarios, situación actual y prioridades reales.",
    description:
      "Partimos de tu ficha de proyecto o una conversación inicial para revisar qué necesita resolver el negocio, quién usará la solución y qué herramientas ya existen.",
    deliverable: "Alcance acordado, prioridades de primera versión y hoja de ruta.",
    clientParticipation: "Compartir contexto, objetivos y validar qué es prioritario."
  },
  {
    number: "02",
    name: "Diseñar",
    summary: "Definimos estructura, flujos, pantallas e identidad de uso antes de programar.",
    description:
      "Construimos la arquitectura de pantallas y prototipos navegables en escritorio y móvil para validar cada paso con claridad antes de pasar a desarrollo.",
    deliverable: "Arquitectura de pantallas, diseño de interfaz y criterios técnicos.",
    clientParticipation: "Revisar flujos en hitos puntuales y confirmar textos clave."
  },
  {
    number: "03",
    name: "Construir y lanzar",
    summary: "Desarrollamos la solución, preparamos campañas o contenidos y conectamos medición.",
    description:
      "Programamos con foco en velocidad, accesibilidad y mantenibilidad, y preparamos piezas, páginas de captación, seguimiento o automatizaciones comerciales según el alcance acordado.",
    deliverable: "Versión funcional y materiales en entorno de revisión listos para aprobar.",
    clientParticipation: "Probar el entorno de revisión, aprobar piezas y facilitar accesos."
  },
  {
    number: "04",
    name: "Acompañar y optimizar",
    summary: "Publicamos de forma ordenada, medimos resultados reales y evolucionamos contigo.",
    description:
      "Coordinamos la puesta en marcha, entregamos documentación operativa y, cuando contratas acompañamiento periódico, revisamos indicadores acordados para ajustar campañas, contenidos o producto.",
    deliverable: "Proyecto publicado, documentación y plan opcional de evolución o marketing.",
    clientParticipation: "Aprobar la publicación y participar en las revisiones periódicas."
  }
];

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const homeFaqs: FaqItem[] = [
  {
    id: "tipos-proyecto",
    question: "¿Qué tipos de proyectos y servicios ofrece ENIX Studio?",
    answer:
      "Conectamos tres áreas en un mismo equipo: diseño y marca, desarrollo a medida (webs, aplicaciones, sistemas, portales, automatizaciones e IA) y marketing digital (estrategia, publicidad en Google y Meta, SEO y presencia local, contenido y redes, email comercial y analítica de conversión). Puedes contratar solo desarrollo, solo marketing o un proyecto combinado."
  },
  {
    id: "inversion-publicitaria",
    question: "¿Cómo se maneja la inversión en anuncios frente a los honorarios de marketing?",
    answer:
      "Siempre los separamos de forma transparente. La inversión publicitaria se paga directamente a las plataformas (como Google Ads o Meta Ads) desde tus cuentas, mientras que los honorarios de ENIX corresponden a estrategia, diseño de piezas, configuración, seguimiento y gestión acordada. No prometemos ventas ni retornos garantizados: definimos indicadores claros para evaluar avances reales."
  },
  {
    id: "despues-de-definir",
    question: "¿Qué ocurre después de definir mi proyecto en el asistente?",
    answer:
      "Obtienes una ficha editable con lo confirmado, las sugerencias opcionales y las decisiones pendientes. Puedes descargarla en Markdown o texto, guardarla como PDF o enviarla al equipo cuando la recepción esté conectada. El equipo de ENIX revisa tu ficha para evaluar el alcance y proponerte una conversación o propuesta concreta."
  },
  {
    id: "asistente-vs-equipo",
    question: "¿El asistente construye automáticamente la web o la app?",
    answer:
      "No. El asistente está diseñado para ayudarte a ordenar tu idea, aclarar necesidades y separar lo esencial de lo que puede venir después. El diseño, desarrollo, pruebas y puesta en marcha los realiza el equipo de ENIX Studio."
  },
  {
    id: "participacion-cliente",
    question: "¿Qué nivel de participación necesita mi equipo durante el proyecto?",
    answer:
      "Necesitamos una persona interlocutora con capacidad de decisión para validar hitos concretos: alcance inicial, diseño de pantallas y entorno de pruebas. Nosotros guiamos cada etapa para que el avance sea claro y no consuma horas innecesarias."
  },
  {
    id: "propuesta-inversion",
    question: "¿Cómo se prepara una propuesta de inversión y plazos?",
    answer:
      "Cada proyecto se cotiza según el alcance real: número de flujos, complejidad de reglas de negocio, integraciones con sistemas existentes y plazos esperados. Si el proyecto es amplio o tiene integraciones por explorar, podemos proponer primero una fase corta de definición con entregable propio."
  },
  {
    id: "evolucion-soporte",
    question: "¿Puedo empezar con una primera versión y sumar mejoras después?",
    answer:
      "Sí. De hecho, en la ficha de proyecto separamos siempre «Lo esencial» de «Para después». Entregamos una base limpia y documentada que tu equipo puede operar, y ofrecemos acompañamiento opcional para mantenimiento o nuevas etapas."
  }
];

export const heroExampleChips = [
  {
    id: "web",
    label: "Una web para mi negocio",
    category: "websites",
    prompt:
      "Quiero una web clara y profesional para mi negocio donde los clientes entiendan mis servicios, vean ejemplos y puedan contactarme o reservar fácilmente."
  },
  {
    id: "clientes",
    label: "Quiero atraer más clientes",
    category: "digital-advertising",
    prompt:
      "Quiero atraer más clientes a mi negocio mediante una estrategia de marketing digital, publicidad y presencia en buscadores."
  },
  {
    id: "app",
    label: "Una aplicación",
    category: "applications",
    prompt:
      "Quiero crear una aplicación para que mis clientes puedan usar mi servicio desde el celular o la web, con registro simple y seguimiento en tiempo real."
  },
  {
    id: "sistema",
    label: "Un sistema de gestión",
    category: "management-systems",
    prompt:
      "Necesito un sistema de gestión para organizar los pedidos y operaciones de mi negocio; hoy coordinamos todo por WhatsApp y planillas de Excel."
  },
  {
    id: "marca",
    label: "Mejorar mi marca",
    category: "brand-design",
    prompt:
      "Quiero mejorar la marca de mi negocio: actualizar nuestra identidad visual, mensajes y materiales para web y campañas."
  },
  {
    id: "automatizar",
    label: "Automatizar tareas",
    category: "automations",
    prompt:
      "Quiero automatizar tareas repetitivas entre nuestros formularios, correo y planillas para ahorrar tiempo y evitar errores manuales."
  }
];
