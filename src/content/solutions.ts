export type SolutionSlug =
  | "websites"
  | "applications"
  | "management-systems"
  | "platforms"
  | "automations"
  | "ai-solutions";

export interface SolutionItem {
  slug: SolutionSlug;
  name: string;
  shortDescription: string;
  eyebrow: string;
  headline: string;
  intro: string;
  forWhom: string[];
  problemSolved: string;
  canInclude: string[];
  exampleTitle: string;
  exampleSummary: string;
  exampleHighlights: string[];
  howToStart: string;
  starterPrompt: string;
  previewType: "web" | "app" | "system" | "portal" | "automation" | "ai";
}

export const solutions: SolutionItem[] = [
  {
    slug: "websites",
    name: "Sitios web",
    shortDescription: "Una presencia digital que explica, conecta y vende.",
    eyebrow: "Sitios web a medida",
    headline: "Una web que explica bien tu oferta y convierte interés en conversaciones reales.",
    intro:
      "Diseñamos sitios corporativos, páginas comerciales y catálogos digitales rápidos, claros y preparados para móvil, buscadores y crecimiento continuo.",
    forWhom: [
      "Emprendedores y negocios que lanzan su primera presencia profesional.",
      "Empresas cuya web actual quedó desactualizada o no refleja su nivel real.",
      "Equipos comerciales que necesitan captar consultas calificadas o reservas directas."
    ],
    problemSolved:
      "Cuando un visitante no entiende en pocos segundos qué haces, para quién es y cómo dar el siguiente paso, se va antes de escribirte. Ordenamos tu propuesta comercial y la convertimos en una experiencia rápida y convincente.",
    canInclude: [
      "Arquitectura de contenidos y jerarquía de mensajes claros.",
      "Diseño visual a medida en escritorio y móvil.",
      "Formularios calificados, agenda de reservas o catálogo consultable.",
      "Optimización técnica de velocidad, accesibilidad y SEO base.",
      "Autonomía editorial para actualizar contenidos clave."
    ],
    exampleTitle: "Sitio comercial con reservas y propuesta clara",
    exampleSummary:
      "Portada directa al grano, páginas por servicio, preguntas frecuentes útiles y reserva o consulta sin fricción en móvil.",
    exampleHighlights: [
      "Carga rápida orientada a lectura inmediata",
      "Secciones pensadas para responder dudas reales",
      "Llamados a la acción claros en cada vista"
    ],
    howToStart:
      "Cuéntanos qué ofreces, qué acción quieres que realice el visitante (escribir, reservar, cotizar o comprar) y qué materiales ya tienes.",
    starterPrompt:
      "Quiero diseñar y desarrollar un sitio web para mi negocio que explique claramente nuestros servicios y facilite recibir consultas o reservas.",
    previewType: "web"
  },
  {
    slug: "applications",
    name: "Aplicaciones",
    shortDescription: "Convierte una idea en un servicio que las personas puedan usar.",
    eyebrow: "Aplicaciones web y móviles",
    headline: "Lleva tu servicio a una aplicación clara, usable y enfocada en lo esencial.",
    intro:
      "Ayudamos a definir, diseñar y construir aplicaciones pensadas para el uso diario: desde una primera versión validable hasta productos digitales en operación.",
    forWhom: [
      "Emprendedores que buscan lanzar una primera versión sólida de su producto digital.",
      "Negocios de servicios que quieren ofrecer reservas, seguimiento o autogestión.",
      "Empresas que necesitan una app de uso interno para equipos en terreno."
    ],
    problemSolved:
      "Muchas ideas se frenan por intentar construir demasiadas funciones al principio o por falta de claridad en la experiencia de uso. Definimos el flujo central, diseñamos pantallas reales y construimos una base escalable.",
    canInclude: [
      "Definición de primera versión (lo esencial vs. etapas futuras).",
      "Diseño de experiencia e interfaz para uso táctil y escritorio.",
      "Cuentas de usuario, perfiles, notificaciones y flujos principales.",
      "Panel de administración para gestionar contenido y usuarios.",
      "Conexión con pagos, calendarios o APIs existentes."
    ],
    exampleTitle: "Aplicación de servicio con seguimiento y reservas",
    exampleSummary:
      "El cliente elige servicio, agenda en segundos, recibe confirmaciones y consulta el estado de sus solicitudes desde su teléfono.",
    exampleHighlights: [
      "Flujo principal resuelto en 3 pasos",
      "Funciona fluido en móvil y escritorio",
      "Panel simple para el equipo operador"
    ],
    howToStart:
      "Describe quién usará la aplicación y cuál es la acción principal que debe poder completar sin ayuda.",
    starterPrompt:
      "Quiero crear una aplicación para que mis usuarios puedan completar su proceso principal desde el celular o la web de forma simple.",
    previewType: "app"
  },
  {
    slug: "management-systems",
    name: "Sistemas de gestión",
    shortDescription: "Organiza la operación de tu negocio en un solo lugar.",
    eyebrow: "Sistemas de gestión a medida",
    headline: "Deja atrás planillas sueltas y coordina tu operación con visibilidad real.",
    intro:
      "Construimos sistemas internos adaptados a cómo trabaja tu equipo: pedidos, inventario, clientes, aprobaciones, reportes y trazabilidad por roles.",
    forWhom: [
      "Distribuidoras, talleres, clínicas o comercios que coordinan pedidos por WhatsApp y Excel.",
      "Empresas con varios equipos (ventas, bodega, administración) que necesitan trabajar sobre el mismo dato.",
      "Operaciones donde los software genéricos obligan a cambiar procesos que ya funcionan."
    ],
    problemSolved:
      "Cuando la información vive repartida entre chats, correos y planillas duplicadas, se pierden pedidos, se cometen errores y nadie sabe el estado real del día. Un sistema a medida concentra el flujo y da claridad a cada rol.",
    canInclude: [
      "Gestión de pedidos, clientes, tareas o solicitudes con estados claros.",
      "Permisos diferenciados por equipo o responsabilidad.",
      "Historial de cambios, alertas y seguimiento de pendientes.",
      "Reportes operativos exportables y vistas por área.",
      "Conexión con facturación, correo o sistemas que ya utilizas."
    ],
    exampleTitle: "Control centralizado de pedidos y despacho",
    exampleSummary:
      "Ventas registra el pedido, bodega prepara y marca listo, administración factura y todos ven el estado actualizado al instante.",
    exampleHighlights: [
      "Un solo registro por pedido, sin duplicados",
      "Estados claros con responsables visibles",
      "Búsqueda rápida por cliente, folio o fecha"
    ],
    howToStart:
      "Cuéntanos cómo registran hoy el trabajo diario, qué equipos intervienen y dónde suelen ocurrir los cuellos de botella.",
    starterPrompt:
      "Necesito un sistema de gestión a medida para organizar pedidos, estados y responsables de mi equipo en un solo lugar.",
    previewType: "system"
  },
  {
    slug: "platforms",
    name: "Portales y plataformas",
    shortDescription: "Conecta clientes, equipos y colaboradores.",
    eyebrow: "Portales y plataformas",
    headline: "Un espacio compartido para que tus clientes y equipos trabajen sin fricción.",
    intro:
      "Diseñamos portales de clientes, plataformas B2B, espacios para proveedores o comunidades privadas con acceso seguro, documentos, solicitudes y seguimiento.",
    forWhom: [
      "Empresas B2B que reciben cotizaciones, pedidos o solicitudes frecuentes de clientes.",
      "Organizaciones que comparten documentos, reportes o avances con múltiples cuentas.",
      "Negocios que conectan oferta y demanda dentro de una misma plataforma."
    ],
    problemSolved:
      "Atender cada consulta de estado, documento o cotización por correo genera demoras y sobrecarga al equipo. Un portal ordenado permite que cada participante consulte y gestione lo que le corresponde.",
    canInclude: [
      "Acceso por perfil (clientes, ejecutivos, colaboradores, administradores).",
      "Catálogos privados, solicitudes de cotización y seguimiento en vivo.",
      "Repositorio ordenado de documentos, entregas o comprobantes.",
      "Notificaciones automáticas ante cambios de estado.",
      "Integración con CRM, ERP o bases de datos existentes."
    ],
    exampleTitle: "Portal de clientes con solicitudes y entregas",
    exampleSummary:
      "Cada cliente ingresa a su espacio, revisa pedidos activos, descarga documentos y envía nuevas solicitudes con historial completo.",
    exampleHighlights: [
      "Acceso privado y permisos por organización",
      "Seguimiento transparente sin perseguir correos",
      "Menos carga operativa para el equipo comercial"
    ],
    howToStart:
      "Indícanos qué perfiles participarán en la plataforma y qué información o acciones compartirán entre sí.",
    starterPrompt:
      "Quiero construir un portal para conectar a nuestros clientes y equipo interno, con seguimiento de solicitudes y acceso a documentos.",
    previewType: "portal"
  },
  {
    slug: "automations",
    name: "Automatizaciones",
    shortDescription: "Conecta herramientas y reduce tareas repetitivas.",
    eyebrow: "Automatizaciones e integraciones",
    headline: "Conecta tus herramientas actuales y elimina el trabajo manual repetitivo.",
    intro:
      "Integramos formularios, correos, CRM, planillas, mensajería y sistemas internos para que la información fluya automáticamente con reglas claras y alertas ante excepciones.",
    forWhom: [
      "Equipos que copian y pegan datos manualmente entre correo, Excel y su CRM.",
      "Negocios que pierden oportunidades por responder tarde o olvidar seguimientos.",
      "Operaciones que necesitan sincronizar datos entre herramientas que hoy no conversan."
    ],
    problemSolved:
      "Las tareas repetitivas consumen horas valiosas y generan errores difíciles de detectar. Automatizamos la captura, validación, clasificación y envío de datos dejando control visible sobre cada paso.",
    canInclude: [
      "Disparadores automáticos desde formularios, correos, webhooks o horarios.",
      "Validación, limpieza y clasificación de datos entrantes.",
      "Sincronización entre CRM, ERP, planillas y notificaciones internas.",
      "Manejo de excepciones con aviso inmediato a una persona responsable.",
      "Registro de ejecuciones para saber siempre qué ocurrió."
    ],
    exampleTitle: "Recepción automática de solicitudes y derivación por área",
    exampleSummary:
      "Cada consulta entrante se valida, se clasifica por tipo, se registra en el tablero correspondiente y avisa al responsable en segundos.",
    exampleHighlights: [
      "Sin copiar datos a mano entre sistemas",
      "Reglas transparentes y fáciles de ajustar",
      "Control de errores y trazabilidad"
    ],
    howToStart:
      "Cuéntanos qué tarea repetitiva ocurre cada día, qué herramientas participan y cuál debería ser el resultado final.",
    starterPrompt:
      "Quiero automatizar un proceso repetitivo conectando nuestras herramientas actuales para ahorrar tiempo y reducir errores.",
    previewType: "automation"
  },
  {
    slug: "ai-solutions",
    name: "Soluciones de IA",
    shortDescription: "Consulta información y mejora procesos con asistencia inteligente.",
    eyebrow: "Soluciones de IA aplicada",
    headline: "Asistencia inteligente sobre tu información real, con reglas claras y control humano.",
    intro:
      "Diseñamos asistentes de consulta documental, clasificación de solicitudes y apoyo operativo conectados a fuentes aprobadas, con permisos y revisión humana cuando corresponde.",
    forWhom: [
      "Empresas con manuales, catálogos técnicos o políticas extensas difíciles de consultar.",
      "Equipos de soporte o preventa que responden preguntas repetitivas sobre información propia.",
      "Operaciones que desean resumir, clasificar o preparar borradores manteniendo aprobación humana."
    ],
    problemSolved:
      "Usar IA genérica sin control puede inventar respuestas o exponer información sensible. Diseñamos soluciones acotadas a tus fuentes, con límites explícitos y trazabilidad de cada respuesta.",
    canInclude: [
      "Asistentes de consulta sobre documentos, catálogos o bases de conocimiento internas.",
      "Clasificación y preparación de borradores para revisión del equipo.",
      "Control de fuentes citadas, permisos por usuario y límites de política.",
      "Integración en portales internos, web comercial o flujos operativos.",
      "Registro de uso y mecanismos de respaldo si el modelo no tiene certeza."
    ],
    exampleTitle: "Asistente interno sobre catálogo técnico y políticas",
    exampleSummary:
      "El equipo consulta compatibilidades o procedimientos en lenguaje natural y obtiene respuestas respaldadas por el documento exacto.",
    exampleHighlights: [
      "Responde solo con fuentes verificadas",
      "Señala cuando falta información en lugar de inventar",
      "Revisión humana antes de compromisos comerciales"
    ],
    howToStart:
      "Cuéntanos qué preguntas o tareas quieres asistir, de dónde sale la información y qué decisiones siempre deben pasar por una persona.",
    starterPrompt:
      "Quiero implementar una solución de IA para consultar nuestra información o asistir un proceso interno con control y revisión humana.",
    previewType: "ai"
  }
];

export function getSolutionBySlug(slug: string): SolutionItem | undefined {
  return solutions.find((item) => item.slug === slug);
}
