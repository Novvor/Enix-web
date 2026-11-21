import { useState } from "react";
import { ArrowRight, Calendar, CheckCircle2, Clock, Package, Sparkles, Workflow } from "lucide-react";
import { saveStarterIdea } from "@/lib/project/storage";
import { demonstrations, type DemoSlug } from "@/content/demonstrations";

interface Props {
  activeSlug?: DemoSlug;
  compact?: boolean;
  darkSurface?: boolean;
}

const SERVICES = [
  { id: "consultoria", name: "Sesión de evaluación", duration: "45 min", team: "Dirección técnica" },
  { id: "revision", name: "Revisión de arquitectura", duration: "60 min", team: "Equipo de diseño" },
  { id: "demo", name: "Demostración guiada", duration: "30 min", team: "Especialista de producto" }
];

const SLOTS_BY_DAY: Record<string, string[]> = {
  "Jueves 26": ["10:00", "11:30", "15:00", "16:30"],
  "Viernes 27": ["09:30", "12:00", "14:30"],
  "Lunes 30": ["10:30", "13:00", "16:00", "17:30"]
};

const ORDER_STAGES = [
  { id: "recibido", label: "Recibido", owner: "Ventas", detail: "Pedido #4821 ingresado por comercial con 14 ítems." },
  { id: "preparacion", label: "En bodega", owner: "Bodega", detail: "Picking completo y verificación de embalaje en curso." },
  { id: "despacho", label: "En despacho", owner: "Logística", detail: "Ruta asignada para entrega durante la tarde." },
  { id: "entregado", label: "Entregado", owner: "Cliente", detail: "Recepción confirmada con comprobante digital." }
];

const AUTO_SCENARIOS = [
  {
    id: "cotizacion",
    label: "Solicitud de cotización B2B",
    input: "Empresa industrial pide cotizar 40 unidades SKU-204 para entrega en Antofagasta.",
    before: [
      "Llega a bandeja genérica y queda sin clasificar.",
      "Un ejecutivo copia datos a Excel manualmente (12 min).",
      "Se reenvía por correo a bodega para consultar stock."
    ],
    after: {
      category: "Cotización prioritaria B2B",
      assignedTo: "Ejecutivo Zona Norte",
      actions: [
        "Valida SKU-204 y cantidad (40) automáticamente.",
        "Crea ficha en CRM y notifica a bodega en 4 segundos.",
        "Prepara borrador de respuesta para aprobación humana."
      ]
    }
  },
  {
    id: "soporte",
    label: "Consulta con datos incompletos",
    input: "Cliente escribe: «Necesito revisar mi último pedido, no llegó completo» (sin número de folio).",
    before: [
      "El correo pasa 3 horas sin dueño claro.",
      "Se intercambian dos correos solo para pedir el folio."
    ],
    after: {
      category: "Soporte postventa · Falta folio",
      assignedTo: "Mesa de Operaciones",
      actions: [
        "Detecta falta de número de pedido antes de derivar.",
        "Solicita folio con enlace directo y etiqueta el ticket.",
        "Alerta a supervisión para seguimiento prioritario."
      ]
    }
  }
];

export default function InteractiveDemos({ activeSlug, compact = false, darkSurface = false }: Props) {
  const [selectedDemo, setSelectedDemo] = useState<DemoSlug>(activeSlug || "bookings");

  // Demo 1: Reservas
  const [serviceId, setServiceId] = useState(SERVICES[0].id);
  const [day, setDay] = useState("Jueves 26");
  const [slot, setSlot] = useState("11:30");
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  // Demo 2: Pedidos
  const [orderStageIdx, setOrderStageIdx] = useState(1);

  // Demo 3: Automatización
  const [scenarioId, setScenarioId] = useState(AUTO_SCENARIOS[0].id);
  const [autoExecuted, setAutoExecuted] = useState(true);

  const currentMeta = demonstrations.find((d) => d.slug === selectedDemo) || demonstrations[0];
  const currentService = SERVICES.find((s) => s.id === serviceId) || SERVICES[0];
  const currentScenario = AUTO_SCENARIOS.find((s) => s.id === scenarioId) || AUTO_SCENARIOS[0];
  const currentOrderStage = ORDER_STAGES[orderStageIdx];

  function handleStartSimilar() {
    saveStarterIdea(currentMeta.starterPrompt, currentMeta.category, currentMeta.slug);
    window.location.href = `/create-project/?category=${currentMeta.category}`;
  }

  const cardBg = darkSurface ? "rgba(255,255,255,0.06)" : "#FFFFFF";
  const innerBg = darkSurface ? "rgba(18,10,24,0.65)" : "#FAF8F6";
  const borderCol = darkSurface ? "rgba(250,248,246,0.14)" : "rgba(48,27,60,0.12)";
  const textMain = darkSurface ? "#FAF8F6" : "#301B3C";
  const textMuted = darkSurface ? "#C9BED1" : "#6B6071";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {!activeSlug && (
        <div
          role="tablist"
          aria-label="Seleccionar demostración interactiva"
          style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
        >
          {demonstrations.map((demo) => {
            const active = demo.slug === selectedDemo;
            return (
              <button
                key={demo.slug}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedDemo(demo.slug)}
                className="btn btn-sm"
                style={{
                  background: active
                    ? darkSurface
                      ? "#F34B21"
                      : "#301B3C"
                    : darkSurface
                      ? "rgba(255,255,255,0.08)"
                      : "#FFFFFF",
                  color: active ? "#FFFFFF" : textMain,
                  borderColor: active ? "transparent" : borderCol
                }}
              >
                {demo.slug === "bookings" && <Calendar size={14} aria-hidden="true" />}
                {demo.slug === "order-management" && <Package size={14} aria-hidden="true" />}
                {demo.slug === "automation" && <Workflow size={14} aria-hidden="true" />}
                <span>{demo.title}</span>
              </button>
            );
          })}
        </div>
      )}

      <div
        style={{
          borderRadius: 24,
          background: cardBg,
          border: `1px solid ${borderCol}`,
          padding: "clamp(1.25rem, 3vw, 2rem)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: "1.5rem",
          alignItems: "start"
        }}
      >
        {/* Left: Business context */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <span
            style={{
              alignSelf: "flex-start",
              padding: "0.28rem 0.72rem",
              borderRadius: 999,
              fontSize: "0.74rem",
              fontWeight: 700,
              background: darkSurface ? "rgba(255,209,180,0.14)" : "#FFF1EB",
              color: darkSurface ? "#FFD1B4" : "#B92F0E",
              border: `1px solid ${darkSurface ? "rgba(255,209,180,0.28)" : "rgba(243,75,33,0.25)"}`
            }}
          >
            {currentMeta.tag}
          </span>

          <h3 className="heading-md" style={{ color: textMain }}>
            {currentMeta.title}
          </h3>

          <p style={{ fontSize: "0.95rem", color: textMain, fontWeight: 500, lineHeight: 1.5 }}>
            {currentMeta.businessNeed}
          </p>

          <p style={{ fontSize: "0.88rem", color: textMuted, lineHeight: 1.55 }}>
            {currentMeta.summary}
          </p>

          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            {currentMeta.highlights.map((h) => (
              <li
                key={h}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  fontSize: "0.84rem",
                  color: textMuted
                }}
              >
                <CheckCircle2 size={15} color="#F34B21" aria-hidden="true" />
                <span>{h}</span>
              </li>
            ))}
          </ul>

          <p style={{ fontSize: "0.76rem", color: textMuted, fontStyle: "italic" }}>
            {currentMeta.disclaimer}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", marginTop: "0.25rem" }}>
            <button
              type="button"
              onClick={handleStartSimilar}
              className={`btn ${darkSurface ? "btn-accent" : "btn-primary"}`}
            >
              <span>Quiero algo así</span>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
            {compact && (
              <a
                href={`/demos/${currentMeta.slug}/`}
                className={`btn ${darkSurface ? "btn-ghost-dark" : "btn-secondary"}`}
              >
                Abrir vista completa
              </a>
            )}
          </div>
        </div>

        {/* Right: Live Interactive Sandbox */}
        <div
          style={{
            borderRadius: 18,
            background: innerBg,
            border: `1px solid ${borderCol}`,
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            color: textMain
          }}
        >
          {selectedDemo === "bookings" && (
            <>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: textMuted }}>
                1. Elige un servicio de ejemplo
              </div>
              <div style={{ display: "grid", gap: "0.45rem" }}>
                {SERVICES.map((srv) => {
                  const active = srv.id === serviceId;
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => {
                        setServiceId(srv.id);
                        setBookingConfirmed(false);
                      }}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.65rem 0.85rem",
                        borderRadius: 12,
                        border: `1.5px solid ${active ? "#F34B21" : borderCol}`,
                        background: active
                          ? darkSurface
                            ? "rgba(243,75,33,0.16)"
                            : "#FFF6F1"
                          : "transparent",
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: "0.86rem", color: textMain }}>{srv.name}</span>
                      <span style={{ fontSize: "0.76rem", color: textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} aria-hidden="true" />
                        {srv.duration}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: textMuted }}>
                2. Disponibilidad de ejemplo
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {Object.keys(SLOTS_BY_DAY).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDay(d);
                      setSlot(SLOTS_BY_DAY[d][0]);
                      setBookingConfirmed(false);
                    }}
                    className="brief-mini-btn"
                    style={{
                      background: day === d ? "#301B3C" : "transparent",
                      color: day === d ? "#FFFFFF" : textMain,
                      borderColor: day === d ? "#301B3C" : borderCol
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {SLOTS_BY_DAY[day].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSlot(s);
                      setBookingConfirmed(false);
                    }}
                    className="brief-mini-btn"
                    style={{
                      background: slot === s ? "#F34B21" : "transparent",
                      color: slot === s ? "#FFFFFF" : textMain,
                      borderColor: slot === s ? "#F34B21" : borderCol
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setBookingConfirmed(true)}
              >
                Simular reserva local
              </button>

              {bookingConfirmed && (
                <div
                  role="status"
                  style={{
                    padding: "0.85rem",
                    borderRadius: 12,
                    background: "rgba(23, 92, 56, 0.14)",
                    border: "1px solid rgba(23, 92, 56, 0.35)",
                    fontSize: "0.82rem",
                    lineHeight: 1.5
                  }}
                >
                  <strong>Resumen local generado:</strong> {currentService.name} ({currentService.duration}) el{" "}
                  <strong>{day}</strong> a las <strong>{slot}</strong> con {currentService.team}.{" "}
                  <span style={{ display: "block", marginTop: 4, opacity: 0.85 }}>
                    Solo demostración: no se agendó una cita real.
                  </span>
                </div>
              )}
            </>
          )}

          {selectedDemo === "order-management" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                <div>
                  <span style={{ fontSize: "0.74rem", color: textMuted }}>Pedido de ejemplo</span>
                  <div style={{ fontWeight: 800, fontSize: "1rem" }}>Folio #4821 · Distribuidora Norte</div>
                </div>
                <span
                  style={{
                    padding: "0.25rem 0.65rem",
                    borderRadius: 999,
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    background: "rgba(243, 75, 33, 0.18)",
                    color: darkSurface ? "#FFD1B4" : "#B92F0E"
                  }}
                >
                  {currentOrderStage.label}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.35rem" }}>
                {ORDER_STAGES.map((st, idx) => {
                  const done = idx <= orderStageIdx;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setOrderStageIdx(idx)}
                      style={{
                        padding: "0.5rem 0.35rem",
                        borderRadius: 10,
                        border: `1.5px solid ${idx === orderStageIdx ? "#F34B21" : borderCol}`,
                        background: done ? "rgba(243, 75, 33, 0.16)" : "transparent",
                        color: textMain,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      {idx + 1}. {st.label}
                    </button>
                  );
                })}
              </div>

              <div
                role="status"
                style={{
                  padding: "0.9rem",
                  borderRadius: 14,
                  background: darkSurface ? "rgba(255,255,255,0.05)" : "#FFFFFF",
                  border: `1px solid ${borderCol}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem"
                }}
              >
                <div style={{ fontSize: "0.75rem", color: textMuted }}>
                  Responsable actual: <strong style={{ color: textMain }}>{currentOrderStage.owner}</strong>
                </div>
                <div style={{ fontSize: "0.86rem", lineHeight: 1.5 }}>{currentOrderStage.detail}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={orderStageIdx === 0}
                  onClick={() => setOrderStageIdx((i) => Math.max(0, i - 1))}
                >
                  ← Estado anterior
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={orderStageIdx === ORDER_STAGES.length - 1}
                  onClick={() => setOrderStageIdx((i) => Math.min(ORDER_STAGES.length - 1, i + 1))}
                >
                  Avanzar estado →
                </button>
              </div>
            </>
          )}

          {selectedDemo === "automation" && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                {AUTO_SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => {
                      setScenarioId(sc.id);
                      setAutoExecuted(true);
                    }}
                    className="brief-mini-btn"
                    style={{
                      background: sc.id === scenarioId ? "#F34B21" : "transparent",
                      color: sc.id === scenarioId ? "#FFFFFF" : textMain,
                      borderColor: sc.id === scenarioId ? "#F34B21" : borderCol
                    }}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>

              <div
                style={{
                  padding: "0.75rem 0.9rem",
                  borderRadius: 12,
                  border: `1px solid ${borderCol}`,
                  fontSize: "0.82rem"
                }}
              >
                <strong style={{ display: "block", fontSize: "0.72rem", color: textMuted, marginBottom: 4 }}>
                  ENTRADA DE EJEMPLO
                </strong>
                «{currentScenario.input}»
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                <div style={{ padding: "0.75rem", borderRadius: 12, border: `1px solid ${borderCol}`, fontSize: "0.78rem" }}>
                  <strong style={{ display: "block", marginBottom: 6, color: textMuted }}>Antes (manual)</strong>
                  <ul style={{ margin: 0, paddingLeft: "1rem", display: "flex", flexDirection: "column", gap: 4 }}>
                    {currentScenario.before.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>

                <div
                  style={{
                    padding: "0.75rem",
                    borderRadius: 12,
                    border: "1px solid rgba(243,75,33,0.4)",
                    background: darkSurface ? "rgba(243,75,33,0.12)" : "#FFF6F1",
                    fontSize: "0.78rem"
                  }}
                >
                  <strong style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6, color: darkSurface ? "#FFD1B4" : "#B92F0E" }}>
                    <Sparkles size={13} aria-hidden="true" />
                    Después (reglas)
                  </strong>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{currentScenario.after.category}</div>
                  <div style={{ fontSize: "0.72rem", color: textMuted, marginBottom: 6 }}>
                    Derivado a: {currentScenario.after.assignedTo}
                  </div>
                  {autoExecuted && (
                    <ul style={{ margin: 0, paddingLeft: "1rem", display: "flex", flexDirection: "column", gap: 4 }}>
                      {currentScenario.after.actions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
