export type BlogSection = {
  heading: string;
  body: string[];
  bullets?: string[];
};

export type BlogArticle = {
  title: string;
  description: string;
  slug: string;
  category: string;
  readingTime: string;
  publishedAt: string;
  updatedAt: string;
  author: string;
  coverImage: string;
  coverAlt: string;
  keywords: string[];
  intent: string;
  serviceRelated: string;
  primaryCta: string;
  finalCta: string;
  intro: string;
  sections: BlogSection[];
  examples: string[];
  commonMistakes: string[];
  recommendedSolution: string;
  faq: [string, string][];
  related: string[];
};

const date = "2026-05-13";

export const blogCategories = [
  "Estrategia & Negocio",
  "Dirección de Arte & Marca",
  "Plataformas & Software",
  "Ingeniería & NOVVOR",
  "Posicionamiento & SEO",
  "Conversión & CRO",
];

export const blogArticles: BlogArticle[] = [
  {
    title: "Por qué una mala percepción digital destruye el margen comercial de una empresa B2B",
    description: "Cuando una compañía sólida compite con una presencia digital débil, termina cediendo precio ante competidores más ágiles. Análisis sobre cómo la percepción arquitectónica y digital defiende el ticket alto.",
    slug: "por-que-tu-pagina-web-no-genera-clientes",
    category: "Estrategia & Negocio",
    readingTime: "8 min",
    publishedAt: date,
    updatedAt: date,
    author: "ENIX STUDIO",
    coverImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=85",
    coverAlt: "Arquitectura corporativa contemporánea y toma de decisiones comerciales de alto nivel",
    keywords: ["percepción digital b2b", "margen comercial empresas", "branding corporativo ticket alto", "diseño web para licitaciones", "estrategia b2b"],
    intent: "Empresas consolidadas que pierden licitaciones o margen porque sus activos digitales no reflejan su capacidad técnica real.",
    serviceRelated: "Consultoría Estratégica & Dirección de Arte",
    primaryCta: "Evaluar Posicionamiento de Marca",
    finalCta: "Inicie una evaluación estratégica confidencial con nuestra dirección.",
    intro: "El problema más costoso en el sector B2B no es la falta de clientes: es competir por precio. Cuando la presencia digital de una empresa no transmite autoridad inmediata, los comités de compras tratan su servicio como un commodity.",
    sections: [
      {
        heading: "El sesgo de percepción en comités de adquisiciones",
        body: [
          "Antes de abrir una reunión o invitar a una licitación, los directores generales y gerentes de operaciones inspeccionan los activos digitales de la empresa proveedora. En menos de diez segundos juzgan el calibre, solidez y riesgo percibido de la organización.",
          "Una web lenta, genérica o basada en plantillas prefabricadas envía una señal involuntaria: falta de rigor técnico y vulnerabilidad operativa.",
        ],
      },
      {
        heading: "01. La falacia del 'boca a boca suficiente'",
        body: [
          "Muchas compañías técnicas se apoyan en que 'sus clientes históricos ya las conocen'. Sin embargo, cuando se busca expandir operaciones a nuevas regiones o calificar en consorcios multinacionales, el comprador ya no es un conocido: es un comité corporativo que evalúa gobernanza y estatus.",
        ],
        bullets: [
          "Dependencia de contactos personales que no escalan",
          "Dificultad para justificar honorarios un 30% superiores a la media",
          "Rechazo silencioso antes de llegar a la presentación técnica",
        ],
      },
      {
        heading: "02. El diseño como herramienta de descommoditización",
        body: [
          "El diseño editorial de estándar global y la tipografía monumental no son vanidad estética: son señales de solvencia patrimonial. Una empresa que invierte en su identidad demuestra control sobre su futuro y respaldo en sus entregas.",
        ],
      },
      {
        heading: "03. Arquitectura tecnológica de grado empresarial",
        body: [
          "Las empresas en ligas mayores exigen velocidad extrema, ciberseguridad garantizada y cero fallas en producción. El software no puede ser un CMS vulnerable ni un parche improvisado.",
        ],
      },
      {
        heading: "Cómo reestructurar la presencia comercial",
        body: [
          "El proceso comienza auditando la brecha entre el valor real de ingeniería de su compañía y lo que el mercado observa. A partir de allí, se reescribe la narrativa corporativa, se rediseña la arquitectura visual y se despliega una plataforma digital concebida para cerrar contratos corporativos.",
        ],
      },
    ],
    examples: [
      "Un proveedor industrial que tras rediseñar su portal corporativo y formalizar su arquitectura de telemetría IoT cerró un contrato de suministro por $4.8M USD.",
      "Un fondo inmobiliario de lujo que eliminó corredores tradicionales y logró colocar el 70% de sus unidades pre-launch a través de un showroom digital 3D.",
    ],
    commonMistakes: [
      "Contratar agencias de marketing orientadas a volumen masivo en lugar de consultoría estratégica",
      "Rediseñar únicamente colores sin abordar el modelo comercial",
      "Llenar el sitio de palabras de relleno como 'soluciones integrales' o 'comprometidos con la excelencia'",
    ],
    recommendedSolution: "ENIX estructura intervenciones estratégicas a medida que unen consultoría comercial, dirección de arte e ingeniería tecnológica.",
    faq: [
      ["¿Por qué una web influye en decisiones de millones de dólares?", "Porque los tomadores de decisión buscan mitigar riesgo. Nadie es despedido por contratar a un proveedor que proyecta autoridad indiscutible."],
      ["¿Cuál es la diferencia entre un rediseño común y consultoría estratégica?", "Un rediseño cambia la fachada; la consultoría estratégica reestructura la oferta, la narrativa de negociación y la arquitectura de datos para ganar contratos."],
    ],
    related: ["diseno-web-profesional", "seo-para-empresas", "branding-para-empresas"],
  },
  {
    title: "SEO de Autoridad: cómo posicionar una consultora o empresa técnica ante directores de compras",
    description: "Estrategias de posicionamiento orgánico orientadas a captar búsquedas de alto ticket, licitaciones privadas y tomadores de decisiones corporativas.",
    slug: "seo-para-empresas",
    category: "Posicionamiento & SEO",
    readingTime: "9 min",
    publishedAt: date,
    updatedAt: date,
    author: "ENIX STUDIO",
    coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=85",
    coverAlt: "Topología de datos y conectividad digital para posicionamiento orgánico de alto impacto",
    keywords: ["SEO para empresas B2B", "posicionamiento orgánico de autoridad", "SEO directores de compras", "estrategia SEO corporativa", "consultoría SEO Chile"],
    intent: "Compañías que necesitan atraer demanda corporativa calificada sin depender exclusivamente de campañas de publicidad pagada.",
    serviceRelated: "Plataformas Web & Posicionamiento de Autoridad",
    primaryCta: "Diseñar Estrategia de Autoridad",
    finalCta: "Construyamos la autoridad digital que su empresa requiere.",
    intro: "En mercados de alto valor, el SEO no consiste en acumular miles de visitas curiosas. Consiste en interceptar las preguntas precisas que un director de compras o inversionista escribe antes de tomar una decisión.",
    sections: [
      {
        heading: "Volumen vs. Intención en contratos de alto ticket",
        body: [
          "Para un estudio o consultora, diez mil visitas genéricas no valen nada frente a cinco visitas de gerentes de operaciones con presupuesto asignado. El SEO de autoridad se enfoca en resolver dudas de viabilidad, normativas, arquitectura técnica y casos comparativos.",
        ],
      },
      {
        heading: "La tríada: SEO técnico, Datos Estructurados y E-E-A-T",
        body: [
          "Google y los motores de IA (ChatGPT, SearchGPT, Perplexity) priorizan páginas con semántica Schema.org impecable, velocidad extrema y evidencia tangible de experiencia práctica (E-E-A-T).",
        ],
      },
      {
        heading: "Optimización para motores de Inteligencia Artificial (GEO / AEO)",
        body: [
          "Los ejecutivos modernos ya no buscan solo en Google: le preguntan a ChatGPT o Claude 'cuál es el mejor estudio de diseño y tecnología industrial'. Para ser recomendado por una IA, el sitio debe estructurarse con entidades claras, texto denso en valor y archivos de conocimiento como llms.txt.",
        ],
      },
    ],
    examples: [
      "Artículos especializados que responden cómo licitar telemetría en minería captan mandantes antes de que publiquen las bases de licitación.",
    ],
    commonMistakes: [
      "Producir contenido genérico generado por IA sin opinión directiva ni casos reales",
      "Medir el éxito del SEO por tráfico bruto en lugar de cotizaciones corporativas",
      "Descuidar el schema y la jerarquía semántica HTML5",
    ],
    recommendedSolution: "ENIX implementa arquitecturas web con optimización para Google y modelos de lenguaje de inteligencia artificial.",
    faq: [
      ["¿Cuánto tarda en madurar una estrategia de autoridad?", "Entre 3 y 6 meses para consolidar términos de alta intención comercial."],
      ["¿Las IA consultan la web en tiempo real?", "Sí, los navegadores de IA analizan la semántica, metadatos y claridad del conocimiento publicado."],
    ],
    related: ["por-que-tu-pagina-web-no-genera-clientes", "diseno-web-profesional"],
  },
  {
    title: "Arquitectura de Software y Showrooms 3D: elevar la experiencia comercial en industrias complejas",
    description: "Cómo la ingeniería digital interactiva en el navegador transforma la venta de activos inmobiliarios, equipamiento pesado y tecnología médica.",
    slug: "diseno-web-profesional",
    category: "Plataformas & Software",
    readingTime: "8 min",
    publishedAt: date,
    updatedAt: date,
    author: "ENIX STUDIO",
    coverImage: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=85",
    coverAlt: "Ingeniería de software de alta performance y diseño de interfaces avanzadas",
    keywords: ["software a medida empresas", "showrooms 3D interactivos", "desarrollo web astro react", "plataformas corporativas alta velocidad", "tecnología enix"],
    intent: "Empresas que necesitan exhibir productos físicos, maquinaria o proyectos inmobiliarios con interactividad y cero fricción.",
    serviceRelated: "Plataformas Web & Software a Medida",
    primaryCta: "Conocer Capacidades de Software",
    finalCta: "Diseñemos una plataforma digital con rendimiento de vanguardia.",
    intro: "El catálogo en PDF y la maqueta física son herramientas del pasado. Hoy los grandes compradores internacionales esperan manipular maquinaria en 3D, explorar planos arquitectónicos y configurar especificaciones técnicas desde su navegador sin instalar nada.",
    sections: [
      {
        heading: "WebGL y renderizado volumétrico en el navegador",
        body: [
          "Gracias a estándares modernos como WebGL y Three.js integrados en stacks ligeros como Astro y React, es posible renderizar activos multimillonarios con fluidez cinematográfica a 60 frames por segundo.",
        ],
      },
      {
        heading: "Rendimiento y Core Web Vitals como imperativo",
        body: [
          "Una experiencia 3D o interactiva no puede costar 10 segundos de carga. En ENIX cuidamos cada kilobyte para garantizar tiempos de respuesta instantáneos en cualquier parte del mundo.",
        ],
      },
      {
        heading: "Seguridad y privacidad empresarial",
        body: [
          "Cumplimiento estricto de protocolos de confidencialidad, salas de negocio protegidas con contraseñas temporales y cifrado punto a punto para inversionistas institucionales.",
        ],
      },
    ],
    examples: [
      "Visualizador 3D de piezas de desgaste minero para cotización directa en faena.",
      "Showroom interactivo de residencias privadas con cotizador de rentabilidad y reservas en tiempo real.",
    ],
    commonMistakes: [
      "Usar plugins pesados que colapsan en dispositivos móviles",
      "No conectar los visualizadores con el flujo comercial directo",
    ],
    recommendedSolution: "ENIX diseña plataformas digitales a medida con tecnología gráfica de alto rendimiento respaldada por NOVVOR.",
    faq: [
      ["¿Funciona en teléfonos móviles?", "Sí, optimizamos cada modelo 3D con compresión de última generación para carga instantánea en móviles."],
    ],
    related: ["por-que-tu-pagina-web-no-genera-clientes", "automatizacion-comercial"],
  },
  {
    title: "Donde el diseño digital se encuentra con la ingeniería física: la alianza ENIX + NOVVOR",
    description: "Análisis sobre la integración de diseño de producto industrial, carcasas de hardware, interfaces de control HMI y telemetría de datos en tiempo real.",
    slug: "automatizacion-comercial",
    category: "Ingeniería & NOVVOR",
    readingTime: "10 min",
    publishedAt: date,
    updatedAt: date,
    author: "ENIX STUDIO",
    coverImage: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1600&q=85",
    coverAlt: "Ingeniería industrial de precisión y diseño de equipamiento tecnológico",
    keywords: ["diseño industrial novvor", "hardware iot mineria", "interfaces hmi maquinaria", "ingenieria aplicada chile", "enix y novvor"],
    intent: "Empresas industriales y tecnológicas que requieren diseño tangible junto con software digital.",
    serviceRelated: "Diseño Industrial & Hardware (Powered by NOVVOR)",
    primaryCta: "Explorar Sinergia Industrial",
    finalCta: "Hablemos sobre su próximo desarrollo físico y digital.",
    intro: "La mayoría de los estudios se quedan atrapados en la pantalla. ENIX, en alianza con NOVVOR, aborda la dimensión física: desde el diseño industrial de dispositivos electrónicos hasta las interfaces HMI que operan en condiciones extremas de faena.",
    sections: [
      {
        heading: "La necesidad de una visión unificada hardware-software",
        body: [
          "Cuando un cliente industrial diseña un sensor o equipo de telemetría, suele contratar a una empresa para la carcasa física y a otra para la pantalla. El resultado es desconexión y sobrecostos.",
          "Nuestra alianza con NOVVOR garantiza que la ergonomía del metal, la pantalla táctil y el software en la nube respondan a un mismo estándar de excelencia.",
        ],
      },
      {
        heading: "Interfaces Humano-Máquina (HMI) para industrias críticas",
        body: [
          "En faenas mineras o líneas de manufactura, una interfaz confusa genera paradas no planificadas o accidentes. Diseñamos con alto contraste, legibilidad bajo sol directo y tolerancia a fallos.",
        ],
      },
    ],
    examples: [
      "Terminales de monitoreo de vibraciones para chancadores mineros con carcasa rugerizada y software cloud.",
    ],
    commonMistakes: [
      "Tratar el diseño industrial como un afterthought cosmético",
      "Desconectar la telemetría de sensores del tablero de control ejecutivo",
    ],
    recommendedSolution: "ENIX y NOVVOR proporcionan un equipo multidisciplinario de diseño industrial, mecánica e ingeniería de software.",
    faq: [
      ["¿Qué rol cumple NOVVOR?", "NOVVOR aporta la ingeniería pesada, modelado CAD, desarrollo de hardware e infraestructura cloud masiva."],
    ],
    related: ["diseno-web-profesional", "ia-para-atencion-al-cliente"],
  },
  {
    title: "Inteligencia Artificial Aplicada a Negocios: más allá de los chatbots genéricos",
    description: "Modelos de calificación automática, triaje clínico asistido y automatización de procesos para organizaciones de alto estándar.",
    slug: "ia-para-atencion-al-cliente",
    category: "Ingeniería & NOVVOR",
    readingTime: "8 min",
    publishedAt: date,
    updatedAt: date,
    author: "ENIX STUDIO",
    coverImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=85",
    coverAlt: "Estructuras abstractas de inteligencia artificial y procesamiento de datos complejos",
    keywords: ["inteligencia artificial aplicada empresas", "triaje clinico ia", "automatizacion de procesos corporativos", "ia novvor", "enix studio ia"],
    intent: "Organizaciones que buscan utilizar IA para resolver ineficiencias reales sin comprometer la privacidad ni la reputación.",
    serviceRelated: "Consultoría Estratégica & Automatización con IA",
    primaryCta: "Evaluar Automatización con IA",
    finalCta: "Incorpore inteligencia aplicada con rigor técnico.",
    intro: "Instalar un bot genérico con respuestas automáticas degrada la percepción de cualquier marca de prestigio. La verdadera IA corporativa opera en segundo plano: extrayendo datos de contratos, analizando imágenes de diagnóstico y coordinando operaciones comerciales.",
    sections: [
      {
        heading: "Privacidad de datos y modelos dedicados",
        body: [
          "Las empresas serias no pueden enviar datos sensibles de clientes a modelos públicos. Diseñamos arquitecturas que garantizan aislamiento de datos, trazabilidad y cumplimiento legal estricto.",
        ],
      },
      {
        heading: "Casos de uso de alto impacto",
        body: [
          "Triaje clínico especializado que orienta al paciente antes de una cirugía mayor; calificación automática de licitaciones públicas para detectar contratos de alta probabilidad de adjudicación.",
        ],
      },
    ],
    examples: [
      "Sistema de triaje asistido para red de clínicas médicas que aumentó 3.4x las admisiones quirúrgicas.",
    ],
    commonMistakes: [
      "Poner un chatbot genérico en el pie de página que da respuestas inventadas",
      "No auditar las respuestas del modelo ante consultas críticas",
    ],
    recommendedSolution: "ENIX integra soluciones de IA de grado corporativo con soporte de ciberseguridad e infraestructura NOVVOR.",
    faq: [
      ["¿Mis datos quedan protegidos?", "Absolutamente. Diseñamos con modelos privados que no utilizan su información para reentrenamiento."],
    ],
    related: ["automatizacion-comercial", "por-que-tu-pagina-web-no-genera-clientes"],
  },
  {
    title: "Dirección de Arte e Identidad de Marca para Fondos de Inversión y Clientes Institucionales",
    description: "Cómo construir una narrativa visual y patrimonial que genere certidumbre ante comités de inversión y family offices.",
    slug: "branding-para-empresas",
    category: "Dirección de Arte & Marca",
    readingTime: "8 min",
    publishedAt: date,
    updatedAt: date,
    author: "ENIX STUDIO",
    coverImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=85",
    coverAlt: "Arquitectura y diseño de alta gama que transmiten solidez patrimonial",
    keywords: ["branding fondos de inversion", "direccion de arte corporativa", "identidad visual private equity", "percepcion de estatus", "enix branding"],
    intent: "Fondos de inversión, desarrolladoras inmobiliarias y firmas patrimoniales que buscan consolidar su reputación.",
    serviceRelated: "Dirección de Arte & Percepción de Marca",
    primaryCta: "Elevar la Identidad de su Firma",
    finalCta: "Estructuremos una presencia de autoridad indiscutible.",
    intro: "El capital busca refugio en la certidumbre. Una firma de inversiones o consorcio institucional no puede presentarse con identidades ambiguas: su identidad debe exudar gobernanza, permanencia y serenidad patrimonial.",
    sections: [
      {
        heading: "La estética de la serenidad patrimonial",
        body: [
          "A diferencia de las startups tecnológicas que compiten con colores fluorescentes y estridencia, las organizaciones de alto patrimonio operan con paletas sobrias, tipografía con linaje y fotografía espacial cuidada.",
        ],
      },
      {
        heading: "Coherencia en cada punto de contacto",
        body: [
          "Desde el documento de deal-flow confidencial hasta el portal de inversionistas y la sala de reuniones, cada soporte debe respirar el mismo nivel de excelencia.",
        ],
      },
    ],
    examples: [
      "Fondo inmobiliario que consolidó la captación de $18M USD tras un reposicionamiento integral de su identidad y showroom digital.",
    ],
    commonMistakes: [
      "Confundir diseño de marca con un simple logotipo",
      "Utilizar fotografías genéricas de stock de personas dándose la mano",
    ],
    recommendedSolution: "ENIX diseña identidades editoriales integrales que comunican autoridad ante inversionistas y directorios.",
    faq: [
      ["¿Qué entregables incluye?", "Sistemas visuales completos, manuales de marca, dirección de fotografía, tipografía corporativa y aplicaciones institucionales."],
    ],
    related: ["por-que-tu-pagina-web-no-genera-clientes", "diseno-web-profesional"],
  },
];

export const getArticleBySlug = (slug: string) => blogArticles.find((article) => article.slug === slug);
export const getArticlesByCategory = (category: string) =>
  blogArticles.filter((article) => article.category.toLowerCase().replaceAll(" ", "-") === category);
export const categorySlug = (category: string) =>
  category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(" ", "-");
