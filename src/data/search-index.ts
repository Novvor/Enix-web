import type { ElementType } from "react";
import {
  Compass,
  Palette,
  Laptop,
  Cpu,
  FileText,
  Briefcase,
  Users,
  Send,
  BookOpen,
} from "lucide-react";
import { blogArticles } from "@/data/blogData";

export type SearchItemType =
  | "Capacidad"
  | "Caso"
  | "Página"
  | "Perspectiva";

export type SearchItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  type: SearchItemType;
  category?: string;
  tags?: string[];
  featured?: boolean;
  icon?: ElementType;
};

const capabilityItems: SearchItem[] = [
  {
    id: "cap-consultoria",
    title: "Consultoría Estratégica & Modelo Comercial",
    description:
      "Reestructuración de propuesta de valor, diagnóstico de brecha comercial y arquitectura para licitaciones corporativas.",
    href: "/servicios/",
    type: "Capacidad",
    category: "Estrategia",
    tags: ["estrategia", "consultoria", "negocio", "licitaciones", "b2b", "modelo comercial"],
    featured: true,
    icon: Compass,
  },
  {
    id: "cap-marca",
    title: "Dirección de Arte & Percepción de Marca",
    description:
      "Sistemas de identidad visual editorial de estándar internacional para fondos de inversión, clínicas y consorcios industriales.",
    href: "/servicios/",
    type: "Capacidad",
    category: "Dirección de Arte",
    tags: ["branding", "marca", "identidad", "direccion de arte", "diseno editorial", "estatus"],
    featured: true,
    icon: Palette,
  },
  {
    id: "cap-software",
    title: "Plataformas Web & Software a Medida",
    description:
      "Desarrollo de portales digitales de alto rendimiento, showrooms 3D y ecosistemas de software seguro.",
    href: "/servicios/",
    type: "Capacidad",
    category: "Tecnología",
    tags: ["desarrollo web", "software", "plataformas", "astro", "react", "3d", "seguridad"],
    featured: true,
    icon: Laptop,
  },
  {
    id: "cap-novvor",
    title: "Diseño Industrial & Hardware (Powered by NOVVOR)",
    description:
      "Diseño de producto físico, modelado CAD, carcasas de sensores IoT e interfaces HMI para maquinaria y faenas mineras.",
    href: "/servicios/",
    type: "Capacidad",
    category: "Ingeniería",
    tags: ["novvor", "diseno industrial", "iot", "hmi", "maquinaria", "sensores", "telemetria", "hardware"],
    featured: true,
    icon: Cpu,
  },
];

const pageItems: SearchItem[] = [
  {
    id: "page-contacto",
    title: "Start a Project (Evaluación de Proyecto)",
    description:
      "Inicie una conversación estratégica y confidencial con nuestros socios directores bajo acuerdo NDA.",
    href: "/contacto/",
    type: "Página",
    category: "Admisión",
    tags: ["contacto", "comenzar proyecto", "evaluacion", "iniciar", "presupuesto", "nda", "socios"],
    featured: true,
    icon: Send,
  },
  {
    id: "page-casos",
    title: "Work & Casos de Consultoría",
    description:
      "Intervenciones estratégicas en minería, fondos inmobiliarios y clínicas médicas de alta complejidad.",
    href: "/casos/",
    type: "Página",
    category: "Casos",
    tags: ["casos", "portafolio", "work", "clientes", "altair", "kronos", "valen", "mineria", "real estate"],
    featured: true,
    icon: Briefcase,
  },
  {
    id: "page-servicios",
    title: "Capacidades & Alcance Consultivo",
    description:
      "Los 4 pilares de consultoría, arte, ingeniería y modelos de acompañamiento directivo del estudio.",
    href: "/servicios/",
    type: "Página",
    category: "Servicios",
    tags: ["capacidades", "servicios", "pilares", "alcance", "advisory", "transformacion"],
    featured: true,
    icon: Compass,
  },
  {
    id: "page-nosotros",
    title: "Studio & Manifiesto Directivo",
    description:
      "Conozca la visión, principios directivos, trayectoria desde 2017 y la alianza tecnológica con NOVVOR.",
    href: "/nosotros/",
    type: "Página",
    category: "Estudio",
    tags: ["nosotros", "estudio", "manifiesto", "principios", "equipo", "liderazgo", "socios"],
    featured: false,
    icon: Users,
  },
  {
    id: "page-blog",
    title: "Insights & Perspectivas Estratégicas",
    description:
      "Ensayos y análisis sobre dirección de negocio, percepción de marca, arquitectura de software e IA aplicada.",
    href: "/blog/",
    type: "Página",
    category: "Pensamiento",
    tags: ["blog", "insights", "articulos", "perspectivas", "ensayos"],
    featured: false,
    icon: BookOpen,
  },
];

const caseItems: SearchItem[] = [
  {
    id: "caso-altair",
    title: "Altair Industrial Systems (Minería & Telemetría IoT)",
    description:
      "Reestructuración comercial y plataforma industrial para licitaciones de gran escala. Adjudicación de +$4.8M USD.",
    href: "/casos/",
    type: "Caso",
    category: "Minería & Industria",
    tags: ["altair", "mineria", "telemetria", "iot", "hmi", "licitaciones", "novvor"],
    featured: true,
    icon: Cpu,
  },
  {
    id: "caso-kronos",
    title: "Kronos Capital & Residences (Luxury Real Estate)",
    description:
      "Ecosistema digital de captación de capital y showroom 3D para fondos de inversión. +$18M USD en ventas pre-launch.",
    href: "/casos/",
    type: "Caso",
    category: "Real Estate & Private Equity",
    tags: ["kronos", "real estate", "inmobiliaria", "lujo", "inversion", "showroom 3d"],
    featured: true,
    icon: Palette,
  },
  {
    id: "caso-valen",
    title: "Valen Medical Institutes (Medicina de Alta Complejidad)",
    description:
      "Modernización de experiencia clínica, triaje asistido por IA y ciberseguridad. 3.4x en tasa de admisión médica.",
    href: "/casos/",
    type: "Caso",
    category: "Salud & Clínicas",
    tags: ["valen", "salud", "medica", "clinicas", "triaje", "ia", "cirugia"],
    featured: true,
    icon: Briefcase,
  },
];

const blogItems: SearchItem[] = blogArticles.map((article) => ({
  id: `blog-${article.slug}`,
  title: article.title,
  description: article.description,
  href: `/blog/${article.slug}/`,
  type: "Perspectiva",
  category: article.category,
  tags: [
    ...article.keywords,
    article.intent,
    article.serviceRelated,
    article.category,
  ],
  featured: false,
  icon: FileText,
}));

export const searchIndex: SearchItem[] = [
  ...capabilityItems,
  ...pageItems,
  ...caseItems,
  ...blogItems,
];
