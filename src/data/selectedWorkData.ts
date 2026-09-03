export interface ConsultingCase {
  id: string;
  tag: string;
  client: string;
  industry: string;
  year: string;
  title: string;
  image: string;
  challenge: string;
  consultingScope: string[];
  novvorIntegration?: string;
  deliverables: string[];
  economicImpact: string;
  accentColor: string;
  dealValue: string;
}

export const consultingCases: ConsultingCase[] = [
  {
    id: "altair-industrial",
    tag: "Case 01 · Heavy Industry & Mining",
    client: "Altair Industrial Systems",
    industry: "Minería, Equipamiento Pesado & Telemetría IoT",
    year: "2026",
    title: "Reestructuración comercial y plataforma industrial para licitaciones de gran escala.",
    dealValue: "+$4.8M USD en Licitaciones Adjudicadas",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1600&q=85",
    challenge:
      "Una firma de suministros y tecnología para faenas mineras competía por precio frente a transnacionales porque su narrativa comercial y activos digitales no transmitían la sofisticación de su ingeniería. Perdían contratos con grandes mandantes antes de llegar a la fase técnica.",
    consultingScope: [
      "Auditoría y redefinición del portafolio comercial B2B para directores de operaciones y compras mineras.",
      "Reposicionamiento de autoridad institucional y consultoría de diferenciación en licitaciones privadas.",
      "Diseño de arquitectura de software para portal corporativo con cifrado de grado industrial.",
    ],
    novvorIntegration:
      "Alianza de ingeniería con NOVVOR para el diseño industrial de terminales de monitoreo en faena y la interfaz HMI (Human-Machine Interface) de sus sensores de vibración y desgaste.",
    deliverables: [
      "Consultoría de Narrativa Comercial",
      "Portal Digital Institucional de Alta Seguridad",
      "Interfaz de Telemetría de Maquinaria",
      "Diseño Industrial de Sensores IoT con NOVVOR",
    ],
    economicImpact:
      "Apertura de contratos marco en 3 países, reducción del 50% en el ciclo de ventas corporativas y aumento del 35% en margen promedio por salida de la guerra de precios.",
    accentColor: "#DC2626",
  },
  {
    id: "kronos-capital",
    tag: "Case 02 · Real Estate & Private Equity",
    client: "Kronos Capital & Residences",
    industry: "Desarrollo Inmobiliario & Gestión de Activos de Lujo",
    year: "2026",
    title: "Ecosistema digital de captación de capital e inversión residencial privada.",
    dealValue: "+$18M USD en Ventas Pre-Launch",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=85",
    challenge:
      "Fondo inmobiliario con una cartera de activos de más de $40M USD comercializaba desarrollos de alto patrimonio con folletería y corredores convencionales, sufriendo una tasa de abandono alta de inversionistas institucionales y compradores internacionales de alto poder adquisitivo.",
    consultingScope: [
      "Modelado estratégico del viaje del inversionista internacional de ticket alto (HNWI y family offices).",
      "Consultoría de percepción de exclusividad, arquitectura de marca y narrativa de plusvalía patrimonial.",
      "Desarrollo de plataforma interactiva de reserva y visualización 3D arquitectónica de unidades.",
    ],
    novvorIntegration:
      "Infraestructura cloud dedicada con NOVVOR para procesamiento en tiempo real de modelos BIM y renderizado volumétrico en el navegador con latencia nula para usuarios en cualquier parte del mundo.",
    deliverables: [
      "Estrategia de Marca & Posicionamiento Exclusivo",
      "Showroom Digital Interactivo & Cotizador Financiero",
      "Sala de Negocios Privada para Family Offices",
      "Infraestructura Cloud de Renderizado NOVVOR",
    ],
    economicImpact:
      "Comercialización del 70% del inventario en fase privada pre-lanzamiento y captación del 65% de inversionistas internacionales sin intermediarios comerciales tradicionales.",
    accentColor: "#D97706",
  },
  {
    id: "valen-health",
    tag: "Case 03 · Advanced Healthcare",
    client: "Valen Medical Institutes",
    industry: "Medicina de Alta Complejidad & Centros de Especialidad",
    year: "2026",
    title: "Modernización de experiencia, admisión de tratamientos de alta gama y privacidad médica.",
    dealValue: "3.4x Tasa de Admisión de Alta Complejidad",
    image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1600&q=85",
    challenge:
      "Red de clínicas especializadas en oncología preventiva, traumatología robótica y medicina regenerativa con tratamientos de entre $5,000 y $25,000 USD. Su proceso de captación generaba desconfianza y los pacientes preferían atenderse en el extranjero por falta de certidumbre digital.",
    consultingScope: [
      "Consultoría integral de experiencia del paciente y protocolos de discreción para directores médicos.",
      "Rediseño de la arquitectura de información para desmitificar procedimientos complejos y transmitir rigor científico.",
      "Flujos automatizados de triaje asistido por IA para calificar pre-diagnósticos sin comprometer la ética médica.",
    ],
    novvorIntegration:
      "Soporte de ciberseguridad e ingeniería de NOVVOR para cumplir normativas internacionales de protección de datos clínicos (HIPAA y estándares ISO de salud).",
    deliverables: [
      "Consultoría de Experiencia & Confianza Clínica",
      "Plataforma Digital de Admisión de Pacientes",
      "Sistema de Triaje Inteligente & Asignación Médica",
      "Arquitectura de Ciberseguridad & Privacidad NOVVOR",
    ],
    economicImpact:
      "Incremento de 3.4x en pacientes para tratamientos quirúrgicos mayores y retención del 85% de consultas premium que antes emigraban a centros hospitalarios internacionales.",
    accentColor: "#0284C7",
  },
];
