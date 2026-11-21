import type { SolutionSlug } from "./solutions";

export type DemoSlug = "bookings" | "order-management" | "automation";

export interface DemonstrationItem {
  slug: DemoSlug;
  title: string;
  tag: string;
  businessNeed: string;
  summary: string;
  category: SolutionSlug;
  starterPrompt: string;
  disclaimer: string;
  highlights: string[];
}

export const demonstrations: DemonstrationItem[] = [
  {
    slug: "bookings",
    title: "Reservas y agenda",
    tag: "Demostración interactiva · Datos de ejemplo",
    businessNeed:
      "Cuando un cliente quiere agendar una hora sin intercambiar diez mensajes ni esperar confirmación manual.",
    summary:
      "Elige un servicio de ejemplo, revisa horarios disponibles y observa cómo se genera el resumen de reserva en segundos.",
    category: "applications",
    starterPrompt:
      "Quiero una experiencia de reservas similar a la demostración, donde mis clientes elijan servicio, vean horarios disponibles y reciban confirmación.",
    disclaimer:
      "Demostración local con servicios y horarios de ejemplo. No agenda una cita real ni envía datos a terceros.",
    highlights: [
      "Selección guiada de servicio y duración",
      "Horarios filtrados por día disponible",
      "Confirmación inmediata con resumen claro"
    ]
  },
  {
    slug: "order-management",
    title: "Gestión de pedidos",
    tag: "Demostración interactiva · Datos de ejemplo",
    businessNeed:
      "Cuando ventas, bodega y administración necesitan ver el mismo estado del pedido sin depender de chats sueltos.",
    summary:
      "Explora un pedido de ejemplo, avanza o cambia un estado permitido y observa cómo se actualiza la línea de seguimiento.",
    category: "management-systems",
    starterPrompt:
      "Quiero un sistema de gestión de pedidos similar a la demostración, con estados claros, responsables y seguimiento para mi equipo.",
    disclaimer:
      "Demostración local con pedidos ficticios de ejemplo. Los cambios de estado solo viven en esta sesión de prueba.",
    highlights: [
      "Estados permitidos por etapa operativa",
      "Trazabilidad visible para cada equipo",
      "Vista resumida lista para el cliente"
    ]
  },
  {
    slug: "automation",
    title: "Automatización de solicitudes",
    tag: "Demostración interactiva · Datos de ejemplo",
    businessNeed:
      "Cuando las consultas llegan desordenadas por correo o formulario y el equipo pierde horas clasificándolas a mano.",
    summary:
      "Compara el antes y el después de un flujo, cambia el tipo de entrada y observa cómo se aplican las reglas de ejemplo.",
    category: "automations",
    starterPrompt:
      "Quiero automatizar la recepción y clasificación de solicitudes como en la demostración, conectando nuestras herramientas actuales.",
    disclaimer:
      "Demostración local con reglas y escenarios de ejemplo. No ejecuta envíos ni modifica sistemas externos.",
    highlights: [
      "Comparación directa de flujo manual vs. automatizado",
      "Reglas visibles de clasificación y derivación",
      "Alerta automática ante datos incompletos"
    ]
  }
];

export function getDemoBySlug(slug: string): DemonstrationItem | undefined {
  return demonstrations.find((demo) => demo.slug === slug);
}
