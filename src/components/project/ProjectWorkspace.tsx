import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Lightbulb,
  Mail,
  MessageSquare,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Sparkles,
  Trash2
} from "lucide-react";
import {
  CATEGORY_LABELS,
  COMMERCIAL_STAGE_LABELS,
  COMMERCIAL_STAGE_ORDER,
  MODALITY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TRACK_LABELS,
  computeBriefReadiness,
  createEmptyBrief,
  createInitialLeadCapture,
  normalizeBrief,
  normalizeLeadCapture,
  type ChatMessage,
  type CommercialStage,
  type EngagementModality,
  type LeadCaptureState,
  type ProjectBrief,
  type ProjectDraft
} from "@/lib/project/schema";
import QuickReplyPanel from "@/components/assistant/QuickReplyPanel";
import InlineContactCard from "@/components/assistant/InlineContactCard";
import "@/components/assistant/assistant.css";
import {
  addManualRequirement,
  applyBriefPatch,
  confirmRequirement,
  removeRequirement,
  toggleRequirementPriority,
  type RequirementBucket
} from "@/lib/project/state";
import {
  clearProjectDraft,
  consumeStarterIdea,
  loadProjectDraft,
  notifyChatActiveState,
  saveProjectDraft
} from "@/lib/project/storage";
import {
  MAX_CLIENT_MESSAGE_CHARS,
  makeRequestId,
  sendCommercialMessage
} from "@/lib/project/assistant-client";
import {
  briefToMarkdown,
  briefToPlainText,
  buildSlugFilename,
  downloadTextFile,
  prepareMailto
} from "@/lib/project/export";
import { siteConfig } from "@/content/site";
import { trackProjectEvent } from "@/lib/analytics/events";
import { ENIXMascot, ENIX_MOOD, type ENIXMood } from "@/components/mascot/ENIXMascot";
import { EnixMascotAnimatedSvg } from "@/components/mascot/EnixMascotAnimatedSvg";
import "./workspace.css";

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

type StudioView = "chat" | "brief" | "submit";

const VIEW_TIPS: Record<StudioView, string[]> = {
  chat: [
    "Cuéntame tu idea como se la explicarías a un socio. Yo la ordeno contigo.",
    "¿Tienes dudas de alcance, plazos o inversión? Pregúntame directo aquí.",
    "Mientras conversamos, tu ficha se arma en vivo sin que tengas que llenar formularios eternos.",
    "Si ya probaste algo antes (web, anuncios o Excel), cuéntamelo para partir con criterio."
  ],
  brief: [
    "¡Aquí mandas tú! Cualquier campo que edites a mano queda protegido frente a cambios automáticos.",
    "Usa «Para después» para separar lo que puede esperar a una segunda etapa.",
    "Confirma las sugerencias naranjas que sí te sirvan y quita las que no apliquen.",
    "Puedes copiar tu ficha completa o descargarla en Markdown o PDF en cualquier momento."
  ],
  submit: [
    "¡Excelente avance! El equipo real de ENIX Studio revisará tu ficha para proponerte el siguiente paso.",
    "Tu correo se usa solo para responderte sobre este proyecto, sin boletines automáticos.",
    "Si prefieres revisarla antes con tu equipo, puedes descargarla en PDF o Markdown aquí mismo."
  ]
};

interface ProjectWorkspaceProps {
  hasRiveAsset?: boolean;
}

export default function ProjectWorkspace({ hasRiveAsset = false }: ProjectWorkspaceProps) {
  const [activeView, setActiveView] = useState<StudioView>("chat");
  const [tipIndex, setTipIndex] = useState(0);
  const [viewGreeting, setViewGreeting] = useState(false);

  const [brief, setBrief] = useState<ProjectBrief>(() => createEmptyBrief());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [manualFields, setManualFields] = useState<string[]>([]);
  const [leadCapture, setLeadCapture] = useState<LeadCaptureState>(() => createInitialLeadCapture());
  const [incompatibleRaw, setIncompatibleRaw] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [assistantMode, setAssistantMode] = useState<"guided" | "ai">("guided");
  const [submissionConnected, setSubmissionConnected] = useState<boolean>(false);
  const [newReqText, setNewReqText] = useState("");
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [copiedFull, setCopiedFull] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Direct submit form state
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactCompany, setContactCompany] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [sendState, setSendState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "success"; referenceId: string; message: string }
    | { kind: "unconfigured"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const idempotencyRef = useRef<string>("");
  const threadRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const isNearBottomRef = useRef(true);

  const chatInputId = useId();
  const titleInputId = useId();
  const goalInputId = useId();
  const situationInputId = useId();
  const territoryInputId = useId();
  const channelsInputId = useId();
  const modalityInputId = useId();
  const adSpendInputId = useId();
  const serviceBudgetInputId = useId();
  const timelineInputId = useId();
  const newReqInputId = useId();

  useEffect(() => {
    idempotencyRef.current = uid("idem");
    notifyChatActiveState(true, "workspace");
    const params = new URLSearchParams(window.location.search);
    const urlCategory = params.get("category") || params.get("categoria");
    const starter = consumeStarterIdea();
    const { draft, incompatibleRaw: rawIncompatible } = loadProjectDraft();

    if (rawIncompatible) {
      setIncompatibleRaw(rawIncompatible);
    }

    if (draft && (draft.messages.length > 0 || draft.brief.idea)) {
      setBrief(normalizeBrief(draft.brief));
      setMessages(draft.messages || []);
      setManualFields(draft.manualFields || []);
      const hydratedLead = normalizeLeadCapture(draft.leadCapture);
      setLeadCapture(hydratedLead);
      if (hydratedLead.capturedEmail) setContactEmail(hydratedLead.capturedEmail);
      if (draft.unsentText) setInputText(draft.unsentText);
    } else if (starter && starter.idea) {
      const cat = starter.category || urlCategory;
      const baseBrief = createEmptyBrief(starter.idea, cat, "development");
      setBrief(baseBrief);
      setInputText(starter.idea);
      trackProjectEvent("enix_project_start", {
        track: baseBrief.track,
        category: cat || "undetermined"
      });
    } else if (urlCategory && CATEGORY_LABELS[urlCategory]) {
      setBrief(createEmptyBrief("", urlCategory, "development"));
    }

    setHydrated(true);

    fetch("/api/project-assistant/", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => {
        if (!info) return;
        if (info.assistantMode === "ai") setAssistantMode("ai");
        if (info.submissionConnected) setSubmissionConnected(true);
      })
      .catch(() => {});

    return () => notifyChatActiveState(false, "workspace");
  }, []);

  // Rotate mascot tips gently per view (zero AI calls, respects reduced motion)
  useEffect(() => {
    setTipIndex(0);
    setViewGreeting(true);
    const greetTimer = window.setTimeout(() => setViewGreeting(false), 1400);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return () => window.clearTimeout(greetTimer);
    }
    const interval = window.setInterval(() => {
      setTipIndex((prev) => (prev + 1) % VIEW_TIPS[activeView].length);
    }, 5200);
    return () => {
      window.clearTimeout(greetTimer);
      window.clearInterval(interval);
    };
  }, [activeView]);

  useEffect(() => {
    if (!hydrated) return;
    saveProjectDraft({
      schemaVersion: 1,
      stage: brief.requirements.length > 1 ? "priorities" : "needs",
      currentStepIndex: 0,
      brief,
      messages,
      answers: {},
      unsentText: inputText,
      lastPageId: "/create-project/",
      manualFields,
      leadCapture
    });
  }, [hydrated, brief, messages, inputText, manualFields, leadCapture]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el || !isNearBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, isSending, activeView]);

  const readiness = useMemo(() => computeBriefReadiness(brief), [brief]);
  const isMarketingOrCombined = brief.track === "marketing" || brief.track === "combined";

  const essentialRequirements = useMemo(
    () => brief.requirements.filter((r) => r.priority !== "later"),
    [brief.requirements]
  );
  const laterRequirements = useMemo(
    () => brief.requirements.filter((r) => r.priority === "later"),
    [brief.requirements]
  );

  function markManualField(field: string) {
    setManualFields((prev) => (prev.includes(field) ? prev : [...prev, field]));
  }

  function editBriefField(field: keyof ProjectBrief, value: string | null) {
    markManualField(String(field));
    setBrief((prev) =>
      applyBriefPatch(
        prev,
        { [field]: value } as Record<string, unknown>,
        { isManual: true }
      )
    );
  }

  async function handleSendMessage(textToSend: string, isSelection = false) {
    const clean = textToSend.trim();
    if (clean.length < 3) {
      setTurnError("Escribe tu idea, pregunta o ajuste para continuar.");
      inputRef.current?.focus();
      return;
    }
    if (clean.length > MAX_CLIENT_MESSAGE_CHARS) {
      setTurnError(`El mensaje supera el máximo de ${MAX_CLIENT_MESSAGE_CHARS} caracteres.`);
      return;
    }
    if (isSending) return;

    setTurnError(null);
    setPendingUserText(clean);
    setInputText("");
    setIsSending(true);
    isNearBottomRef.current = true;

    const currentDraft: ProjectDraft = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 86400_000).toISOString(),
      stage: brief.requirements.length > 1 ? "priorities" : "needs",
      currentStepIndex: 0,
      brief,
      messages,
      answers: {},
      unsentText: clean,
      lastPageId: "/create-project/",
      manualFields,
      leadCapture
    };

    try {
      const result = await sendCommercialMessage({
        text: clean,
        pageId: "/create-project/",
        currentDraft,
        categoryHint: brief.category,
        isSelection,
        requestId: makeRequestId()
      });

      if (result.error) {
        setTurnError(result.error);
        setInputText(clean);
      } else {
        setBrief(result.draft.brief);
        setMessages(result.draft.messages);
        const nextLead = normalizeLeadCapture(result.draft.leadCapture);
        setLeadCapture(nextLead);
        if (nextLead.capturedEmail && !contactEmail) setContactEmail(nextLead.capturedEmail);
        setAssistantMode(result.response.mode);
      }
    } finally {
      setPendingUserText(null);
      setIsSending(false);
    }
  }

  function handleAddRequirement(e: React.FormEvent) {
    e.preventDefault();
    const clean = newReqText.trim();
    if (!clean) return;
    setBrief((prev) => addManualRequirement(prev, "requirements", clean, "initial"));
    setNewReqText("");
  }

  function handleRequirementAction(
    bucket: RequirementBucket,
    id: string,
    action: "confirm" | "initial" | "later" | "remove"
  ) {
    setBrief((prev) => {
      if (action === "confirm") return confirmRequirement(prev, bucket, id);
      if (action === "remove") return removeRequirement(prev, bucket, id);
      return toggleRequirementPriority(prev, bucket, id, action);
    });
  }

  async function handleCopyFullBrief() {
    try {
      await navigator.clipboard.writeText(briefToPlainText(brief));
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2500);
    } catch {
      downloadTextFile(briefToPlainText(brief), buildSlugFilename(brief.title, "txt"), "text/plain");
    }
  }

  function handleResetWorkspace() {
    clearProjectDraft();
    setBrief(createEmptyBrief());
    setMessages([]);
    setManualFields([]);
    setInputText("");
    setTurnError(null);
    setIncompatibleRaw(null);
    setSendState({ kind: "idle" });
    setActiveView("chat");
    idempotencyRef.current = uid("idem");
  }

  async function handleSubmitProject(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim()) {
      setSendState({ kind: "error", message: "Indica tu nombre y correo para poder responderte." });
      return;
    }

    setSendState({ kind: "submitting" });
    try {
      const res = await fetch("/api/project-submit/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyRef.current,
          name: contactName.trim(),
          email: contactEmail.trim(),
          company: contactCompany.trim(),
          phone: contactPhone.trim(),
          brief
        })
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        code?: string;
        referenceId?: string;
        message?: string;
      } | null;

      if (res.ok && data?.ok && data.referenceId) {
        setSendState({
          kind: "success",
          referenceId: data.referenceId,
          message:
            data.message ||
            "Tu ficha fue enviada al servicio de correo para el equipo de ENIX Studio."
        });
        trackProjectEvent("enix_project_submit_confirmed", {
          track: brief.track,
          category: brief.category || "undetermined"
        });
      } else if (data?.code === "mail_not_configured" || data?.code === "missing_mail_config" || res.status === 503) {
        setSendState({
          kind: "unconfigured",
          message:
            data?.message ||
            "El envío directo no está conectado en este entorno. Puedes descargar tu ficha o enviarla por correo."
        });
      } else {
        setSendState({
          kind: "error",
          message: data?.message || "No pudimos enviar tu ficha. Intenta nuevamente o descárgala."
        });
      }
    } catch {
      setSendState({
        kind: "error",
        message: "Error de conexión al enviar. Tu ficha sigue segura aquí para reintentar o descargar."
      });
    }
  }

  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const mailtoInfo = useMemo(() => prepareMailto(brief, siteConfig.contactEmail), [brief]);

  const mascotMood: ENIXMood = isSending || sendState.kind === "submitting"
    ? ENIX_MOOD.thinking
    : turnError || sendState.kind === "error"
      ? ENIX_MOOD.error
      : sendState.kind === "success"
        ? ENIX_MOOD.ready
        : viewGreeting
          ? ENIX_MOOD.greeting
          : inputText.trim().length > 0
            ? ENIX_MOOD.attentive
            : messages.length > 0
              ? ENIX_MOOD.ready
              : ENIX_MOOD.idle;

  const currentTip = isSending
    ? "Steve está pensando la mejor recomendación y actualizando tu ficha…"
    : sendState.kind === "success"
      ? "¡Enviada! Guarda tu referencia o descarga una copia si la necesitas."
      : VIEW_TIPS[activeView][tipIndex];

  return (
    <div id="espacio-proyecto" className="studio-page" data-active-view={activeView}>
      <div className="studio-atmosphere" aria-hidden="true">
        <div className="studio-glow studio-glow-a" />
        <div className="studio-glow studio-glow-b" />
      </div>

      <div className="studio-container">
        {/* Top Studio Bar */}
        <header className="studio-topbar no-print">
          <div className="studio-topbar-left">
            <a href="/" className="ws-brand-link" aria-label="Volver a la portada de ENIX Studio">
              <img
                src="/brand/enix-logo-320.webp"
                alt="ENIX Studio"
                width="320"
                height="91"
                className="ws-brand-logo"
              />
            </a>
            <a href="/" className="studio-back-link">
              ← Portada
            </a>
          </div>

          <nav className="studio-view-switcher" role="tablist" aria-label="Vistas de tu proyecto">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "chat"}
              className={`studio-view-tab ${activeView === "chat" ? "is-active" : ""}`}
              onClick={() => setActiveView("chat")}
            >
              <MessageSquare size={15} aria-hidden="true" />
              <span>Conversar</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "brief"}
              className={`studio-view-tab ${activeView === "brief" ? "is-active" : ""}`}
              onClick={() => setActiveView("brief")}
            >
              <FileText size={15} aria-hidden="true" />
              <span>Mi ficha ({readiness.defined.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "submit"}
              className={`studio-view-tab ${activeView === "submit" ? "is-active" : ""}`}
              onClick={() => setActiveView("submit")}
            >
              <Send size={15} aria-hidden="true" />
              <span>Evaluar con ENIX</span>
            </button>
          </nav>

          <div className="studio-topbar-right">
            <span className="ws-mode-chip">
              <Sparkles size={13} aria-hidden="true" />
              {assistantMode === "ai" ? "IA activa" : "Modo guiado"}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetWorkspace}
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Reiniciar</span>
            </button>
          </div>
        </header>

        {incompatibleRaw && (
          <div className="ws-recovery-banner no-print" role="alert">
            <div>
              <strong>Encontramos un borrador de una versión anterior incompatible.</strong>
              <p>No lo borramos automáticamente: puedes descargarlo como respaldo antes de empezar de nuevo.</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  downloadTextFile(incompatibleRaw, "enix-borrador-respaldo.json", "application/json")
                }
              >
                Descargar respaldo
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleResetWorkspace}>
                Empezar limpio
              </button>
            </div>
          </div>
        )}

        {/* 6-Stage Commercial Journey Rail */}
        {(() => {
          const latestStage: CommercialStage =
            activeView === "submit"
              ? "evaluation"
              : latestAssistant?.commercialStage ||
                (messages.length === 0 ? "discover" : readiness.defined.length >= 4 ? "summary" : "possibilities");
          const currentIdx = COMMERCIAL_STAGE_ORDER.indexOf(latestStage);
          return (
            <div className="studio-stage-rail no-print" aria-label="Progreso de definición del proyecto">
              {COMMERCIAL_STAGE_ORDER.map((st, idx) => (
                <span
                  key={st}
                  className={`studio-stage-step ${
                    idx === currentIdx ? "is-current" : idx < currentIdx ? "is-done" : ""
                  }`}
                >
                  <span className="studio-stage-dot" aria-hidden="true" />
                  <span>{COMMERCIAL_STAGE_LABELS[st]}</span>
                </span>
              ))}
            </div>
          );
        })()}

        {/* Real status bar: Ya definido vs Por aclarar */}
        <div className="studio-readiness-bar no-print">
          <div className="ws-readiness-pill is-defined">
            <CheckCircle2 size={14} aria-hidden="true" />
            <span>Ya definido ({readiness.defined.length}):</span>
            <strong>
              {readiness.defined.length > 0 ? readiness.defined.slice(0, 3).join(" · ") : "Empezando"}
            </strong>
          </div>
          {readiness.toClarify.length > 0 && (
            <div className="ws-readiness-pill is-clarify">
              <span>Por aclarar ({readiness.toClarify.length}):</span>
              <span>{readiness.toClarify.slice(0, 3).join(" · ")}</span>
            </div>
          )}
        </div>

        {/* ============================================================
            VIEW 1: CONVERSAR — Mascot is LEFT protagonist + live preview
            ============================================================ */}
        <section
          className={`studio-stage-chat no-print ${activeView === "chat" ? "is-view-visible" : "is-view-hidden"}`}
          aria-label="Conversación con el asesor comercial de ENIX Studio"
        >
          {/* Left Mascot Stage */}
          <aside className="studio-mascot-column">
            <div className="studio-mascot-hero-card">
              <div className="studio-mascot-bubble" key={`chat-${currentTip}`} role="status">
                <span className="studio-tip-tag">
                  <Lightbulb size={13} aria-hidden="true" />
                  Tip de Steve
                </span>
                <p>{currentTip}</p>
              </div>

              <div className="studio-mascot-pedestal" aria-hidden="true">
                <ENIXMascot
                  src="/brand/enix-mascot-rive.riv"
                  fallbackSvg={<EnixMascotAnimatedSvg mood={mascotMood} />}
                  mood={mascotMood}
                  paused={!hasRiveAsset || activeView !== "chat"}
                  size={132}
                />
              </div>

              <div className="studio-mini-brief-card">
                <div className="studio-mini-brief-head">
                  <strong>{brief.title || "Tu proyecto en construcción"}</strong>
                  <span className="studio-track-tag">{TRACK_LABELS[brief.track]}</span>
                </div>
                <p className="studio-mini-brief-meta">
                  {brief.category
                    ? `Enfoque: ${CATEGORY_LABELS[brief.category] || brief.category}`
                    : "Cuéntame tu idea para identificar el mejor punto de partida."}
                </p>
                <div className="studio-mini-brief-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveView("brief")}
                  >
                    Editar mi ficha
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveView("submit")}
                  >
                    Evaluar
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Conversation Canvas */}
          <div className="studio-chat-card">
            <div
              ref={threadRef}
              className="studio-thread"
              onScroll={() => {
                const el = threadRef.current;
                if (!el) return;
                isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
              role="log"
              aria-live="polite"
            >
              {messages.length === 0 && !pendingUserText && (
                <div className="studio-empty-chat">
                  <h1 className="studio-empty-title">¿Qué proyecto vamos a diseñar juntos hoy?</h1>
                  <p className="studio-empty-sub">
                    Escribe libremente lo que necesitas, haz preguntas directas sobre enfoque o elige un punto de partida:
                  </p>
                  <div className="studio-starter-grid">
                    {[
                      "Tengo una peluquería y recibo reservas por WhatsApp, ¿qué recomiendas para empezar?",
                      "Quiero atraer más clientes con publicidad digital y una web que convierta.",
                      "Necesito un sistema a medida para dejar de coordinar pedidos en Excel."
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="studio-starter-card"
                        onClick={() => void handleSendMessage(prompt, false)}
                      >
                        <span>{prompt}</span>
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`ws-msg-row ${msg.role === "user" ? "is-user" : "is-assistant"}`}
                >
                  <div className="ws-msg-bubble">{msg.text}</div>
                  {msg.role === "assistant" && msg.blueprintHighlights && msg.blueprintHighlights.length > 0 && (
                    <div className="blueprint-highlights-row" aria-label="Actualizaciones en tu ficha">
                      {msg.blueprintHighlights.map((hl) => (
                        <span key={`${msg.id}-${hl}`} className="blueprint-pill">
                          ✦ {hl}
                        </span>
                      ))}
                    </div>
                  )}
                  {msg.role === "assistant" && msg.links && msg.links.length > 0 && (
                    <div className="ws-msg-links">
                      {msg.links.map((link) => (
                        <a key={`${msg.id}-${link.href}`} href={link.href} className="ws-msg-link">
                          <span>{link.label}</span>
                          <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {isSending && pendingUserText && (
                <div className="ws-msg-row is-user">
                  <div className="ws-msg-bubble">{pendingUserText}</div>
                </div>
              )}

              {isSending && (
                <div className="ws-msg-row is-assistant">
                  <div className="ws-msg-typing" role="status" aria-live="polite">
                    <span>Steve está pensando</span>
                    <span className="ws-thinking-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {!isSending && (latestAssistant?.offerContact || leadCapture.status === "submitted") && leadCapture.status !== "declined" && (
              <div style={{ padding: "0 1.25rem 0.5rem" }}>
                <InlineContactCard
                  draft={{
                    schemaVersion: 1,
                    savedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 14 * 86400_000).toISOString(),
                    stage: brief.requirements.length > 1 ? "priorities" : "needs",
                    currentStepIndex: 0,
                    brief,
                    messages,
                    answers: {},
                    unsentText: inputText,
                    lastPageId: "/create-project/",
                    manualFields,
                    leadCapture
                  }}
                  sourcePage="/create-project/"
                  prefilledEmail={latestAssistant?.detectedEmail}
                  onDraftUpdated={(updated) => {
                    const nextLead = normalizeLeadCapture(updated.leadCapture);
                    setLeadCapture(nextLead);
                    if (nextLead.capturedEmail) setContactEmail(nextLead.capturedEmail);
                  }}
                  onContinueChat={() => inputRef.current?.focus()}
                />
              </div>
            )}

            {latestAssistant?.options && latestAssistant.options.length > 0 && !isSending && (
              <div className="ws-quick-bar">
                <QuickReplyPanel
                  messageId={latestAssistant.id}
                  options={latestAssistant.options}
                  selectionMode={latestAssistant.selectionMode}
                  disabled={isSending}
                  onSelectValue={(val) => void handleSendMessage(val, true)}
                  onRequestOther={() => inputRef.current?.focus()}
                  onSpecialAction={(act) => {
                    if (act === "__open_submit__") setActiveView("submit");
                    else if (act === "__open_brief__") setActiveView("brief");
                  }}
                />
              </div>
            )}

            <form
              className="ws-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage(inputText, false);
              }}
            >
              {turnError && (
                <div className="ws-error-box" role="alert">
                  {turnError}
                </div>
              )}
              <label htmlFor={chatInputId} className="visually-hidden">
                Escribe tu mensaje para el asesor de ENIX Studio
              </label>
              <textarea
                ref={inputRef}
                id={chatInputId}
                rows={3}
                maxLength={MAX_CLIENT_MESSAGE_CHARS + 100}
                className="ws-textarea"
                placeholder="Escribe tu respuesta, cambia de tema o pregunta lo que necesites…"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (turnError) setTurnError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage(inputText, false);
                  }
                }}
                disabled={isSending}
              />
              <div className="ws-composer-foot">
                <span className="ws-composer-note">
                  {inputText.length > 1400
                    ? `${inputText.length}/${MAX_CLIENT_MESSAGE_CHARS} caracteres`
                    : "Tus ediciones manuales en la ficha siempre tienen prioridad."}
                </span>
                <button type="submit" className="btn btn-primary" disabled={isSending}>
                  <span>{isSending ? "Steve está pensando…" : "Enviar"}</span>
                  <Send size={15} aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ============================================================
            VIEW 2: MI FICHA — Mascot moves to TOP-RIGHT spotlight!
            ============================================================ */}
        <section
          className={`studio-stage-brief ${activeView === "brief" ? "is-view-visible" : "is-view-hidden"}`}
          aria-label="Ficha editable de tu proyecto"
        >
          <div className="studio-brief-mascot-banner no-print">
            <div className="studio-brief-banner-copy">
              <div className="studio-mascot-bubble is-right" key={`brief-${currentTip}`} role="status">
                <span className="studio-tip-tag">
                  <Lightbulb size={13} aria-hidden="true" />
                  Tip de edición
                </span>
                <p>{currentTip}</p>
              </div>
              <div className="studio-export-row">
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyFullBrief}>
                  {copiedFull ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  <span>{copiedFull ? "Copiada" : "Copiar texto"}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    downloadTextFile(briefToMarkdown(brief), buildSlugFilename(brief.title, "md"), "text/markdown")
                  }
                >
                  <Download size={14} aria-hidden="true" />
                  <span>Descargar .md</span>
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                  <Printer size={14} aria-hidden="true" />
                  <span>Guardar PDF</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveView("submit")}
                >
                  Listo para evaluar →
                </button>
              </div>
            </div>

            <div className="studio-brief-mascot-figure" aria-hidden="true">
              <ENIXMascot
                src="/brand/enix-mascot-rive.riv"
                fallbackSvg={<EnixMascotAnimatedSvg mood={mascotMood} />}
                mood={mascotMood}
                paused={!hasRiveAsset || activeView !== "brief"}
                size={122}
              />
            </div>
          </div>

          <div className="studio-brief-grid">
            <div className="ws-brief-pane">
              <div className="ws-pane-header">
                <div>
                  <h2 className="ws-pane-title">Definición general</h2>
                  <p className="ws-pane-sub">
                    {TRACK_LABELS[brief.track]} · {brief.category ? CATEGORY_LABELS[brief.category] || brief.category : "Enfoque por definir"}
                  </p>
                </div>
              </div>
              <div className="ws-brief-body">
                <div className="ws-field-grid">
                  <div className="ws-field">
                    <label htmlFor={titleInputId}>Título provisional</label>
                    <input
                      id={titleInputId}
                      type="text"
                      value={brief.title}
                      placeholder="Ej: Web con reservas para mi peluquería"
                      onChange={(e) => editBriefField("title", e.target.value)}
                    />
                  </div>

                  <div className="ws-field">
                    <label htmlFor={goalInputId}>Objetivo principal</label>
                    <textarea
                      id={goalInputId}
                      rows={3}
                      value={brief.goal}
                      placeholder="Qué resultado concreto quieres lograr con este proyecto"
                      onChange={(e) => editBriefField("goal", e.target.value)}
                    />
                  </div>

                  <div className="ws-field">
                    <label htmlFor={situationInputId}>Situación actual</label>
                    <input
                      id={situationInputId}
                      type="text"
                      value={brief.currentSituation}
                      placeholder="Ej: Hoy coordinamos todo por WhatsApp y Excel"
                      onChange={(e) => editBriefField("currentSituation", e.target.value)}
                    />
                  </div>

                  {isMarketingOrCombined && (
                    <>
                      <div className="ws-field">
                        <label htmlFor={territoryInputId}>Público y territorio</label>
                        <input
                          id={territoryInputId}
                          type="text"
                          value={brief.targetAudienceAndTerritory || ""}
                          placeholder="Ej: Clientes locales en Providencia / Santiago"
                          onChange={(e) => editBriefField("targetAudienceAndTerritory", e.target.value)}
                        />
                      </div>
                      <div className="ws-field">
                        <label htmlFor={channelsInputId}>Canales y activos actuales</label>
                        <input
                          id={channelsInputId}
                          type="text"
                          value={brief.existingChannelsAndAssets || ""}
                          placeholder="Ej: Instagram activo, sin sitio web"
                          onChange={(e) => editBriefField("existingChannelsAndAssets", e.target.value)}
                        />
                      </div>
                      <div className="ws-field">
                        <label htmlFor={modalityInputId}>Modalidad de trabajo</label>
                        <select
                          id={modalityInputId}
                          value={brief.engagementModality || "undecided"}
                          onChange={(e) =>
                            editBriefField("engagementModality", e.target.value as EngagementModality)
                          }
                        >
                          {Object.entries(MODALITY_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="ws-field-row-2">
                        <div className="ws-field">
                          <label htmlFor={adSpendInputId}>Inversión publicitaria (plataformas)</label>
                          <input
                            id={adSpendInputId}
                            type="text"
                            value={brief.adSpendBudget || ""}
                            placeholder="Separada de honorarios"
                            onChange={(e) => editBriefField("adSpendBudget", e.target.value || null)}
                          />
                        </div>
                        <div className="ws-field">
                          <label htmlFor={serviceBudgetInputId}>Presupuesto de servicios ENIX</label>
                          <input
                            id={serviceBudgetInputId}
                            type="text"
                            value={brief.serviceBudget || ""}
                            placeholder="Por definir"
                            onChange={(e) => editBriefField("serviceBudget", e.target.value || null)}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="ws-field">
                    <label htmlFor={timelineInputId}>Plazo de referencia</label>
                    <input
                      id={timelineInputId}
                      type="text"
                      value={brief.declaredTimeline || ""}
                      placeholder="Ej: Próximo mes · Sin fecha cerrada"
                      onChange={(e) => editBriefField("declaredTimeline", e.target.value || null)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="ws-brief-pane">
              <div className="ws-pane-header">
                <div>
                  <h2 className="ws-pane-title">Alcance y prioridades ({brief.requirements.length})</h2>
                  <p className="ws-pane-sub">Verde = Confirmado · Naranja = Sugerido</p>
                </div>
              </div>
              <div className="ws-brief-body">
                {essentialRequirements.length > 0 ? (
                  <ul className="ws-req-list">
                    {essentialRequirements.map((req) => (
                      <li key={req.id} className={`ws-req-item is-${req.status}`}>
                        <div className="ws-req-main">
                          <span className={`ws-status-dot is-${req.status}`}>
                            {STATUS_LABELS[req.status]}
                          </span>
                          <span className="ws-req-text">{req.text}</span>
                        </div>
                        <div className="ws-req-controls no-print">
                          {req.status !== "confirmed" && (
                            <button
                              type="button"
                              className="ws-mini-btn"
                              onClick={() => handleRequirementAction("requirements", req.id, "confirm")}
                            >
                              Confirmar
                            </button>
                          )}
                          <button
                            type="button"
                            className="ws-mini-btn"
                            onClick={() => handleRequirementAction("requirements", req.id, "later")}
                          >
                            {PRIORITY_LABELS.later}
                          </button>
                          <button
                            type="button"
                            className="ws-mini-btn is-danger"
                            onClick={() => handleRequirementAction("requirements", req.id, "remove")}
                            aria-label={`Quitar ${req.text}`}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ws-pane-sub">
                    Todavía no hay puntos agregados. Conversa con la mascota o suma el primer requisito abajo.
                  </p>
                )}

                {laterRequirements.length > 0 && (
                  <>
                    <h4 className="ws-req-subhead">Para una segunda etapa</h4>
                    <ul className="ws-req-list">
                      {laterRequirements.map((req) => (
                        <li key={req.id} className={`ws-req-item is-${req.status}`}>
                          <div className="ws-req-main">
                            <span className={`ws-status-dot is-${req.status}`}>
                              {STATUS_LABELS[req.status]}
                            </span>
                            <span className="ws-req-text">{req.text}</span>
                          </div>
                          <div className="ws-req-controls no-print">
                            <button
                              type="button"
                              className="ws-mini-btn"
                              onClick={() => handleRequirementAction("requirements", req.id, "initial")}
                            >
                              Subir a esencial
                            </button>
                            <button
                              type="button"
                              className="ws-mini-btn is-danger"
                              onClick={() => handleRequirementAction("requirements", req.id, "remove")}
                              aria-label={`Quitar ${req.text}`}
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <form className="ws-add-req-form no-print" onSubmit={handleAddRequirement}>
                  <label htmlFor={newReqInputId} className="visually-hidden">
                    Agregar necesidad manual a la ficha
                  </label>
                  <input
                    id={newReqInputId}
                    type="text"
                    value={newReqText}
                    onChange={(e) => setNewReqText(e.target.value)}
                    placeholder="Agregar un punto o requisito manualmente…"
                  />
                  <button type="submit" className="btn btn-secondary btn-sm">
                    <Plus size={14} aria-hidden="true" />
                    <span>Agregar</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            VIEW 3: EVALUAR CON ENIX — Mascot moves to CENTER-TOP stage!
            ============================================================ */}
        <section
          className={`studio-stage-submit no-print ${activeView === "submit" ? "is-view-visible" : "is-view-hidden"}`}
          aria-label="Enviar ficha al equipo de ENIX Studio"
        >
          <div className="studio-submit-center">
            <div className="studio-submit-mascot-stage">
              <div className="studio-mascot-bubble is-center" key={`submit-${currentTip}`} role="status">
                <span className="studio-tip-tag">
                  <Sparkles size={13} aria-hidden="true" />
                  Último paso opcional
                </span>
                <p>{currentTip}</p>
              </div>
              <div className="studio-mascot-pedestal" aria-hidden="true">
                <ENIXMascot
                  src="/brand/enix-mascot-rive.riv"
                  fallbackSvg={<EnixMascotAnimatedSvg mood={mascotMood} />}
                  mood={mascotMood}
                  paused={!hasRiveAsset || activeView !== "submit"}
                  size={136}
                />
              </div>
            </div>

            <div className="ws-submit-card is-elevated">
              <div className="studio-submit-summary-strip">
                <div>
                  <span className="studio-track-tag">{TRACK_LABELS[brief.track]}</span>
                  <h3>{brief.title || "Tu ficha de proyecto"}</h3>
                </div>
                <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyFullBrief}>
                    {copiedFull ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    <span>{copiedFull ? "Copiada" : "Copiar"}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      downloadTextFile(briefToMarkdown(brief), buildSlugFilename(brief.title, "md"), "text/markdown")
                    }
                  >
                    <Download size={14} aria-hidden="true" />
                    <span>.md</span>
                  </button>
                </div>
              </div>

              <p className="ws-submit-note">
                El asistente te ayuda a ordenar el proyecto; el equipo real de ENIX Studio revisa tu ficha y te responde desde{" "}
                <strong>{siteConfig.contactEmail}</strong>. Tu borrador solo se envía cuando pulsas el botón.
              </p>

              {sendState.kind === "success" ? (
                <div className="ws-submit-success" role="status">
                  <CheckCircle2 size={20} aria-hidden="true" />
                  <div>
                    <strong>Ficha enviada ({sendState.referenceId})</strong>
                    <p>{sendState.message}</p>
                  </div>
                </div>
              ) : (
                <form className="ws-submit-form" onSubmit={handleSubmitProject}>
                  <div className="ws-field-row-2">
                    <div className="ws-field">
                      <label htmlFor="ws-contact-name">Tu nombre *</label>
                      <input
                        id="ws-contact-name"
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Nombre y apellido"
                      />
                    </div>
                    <div className="ws-field">
                      <label htmlFor="ws-contact-email">Correo de contacto *</label>
                      <input
                        id="ws-contact-email"
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="tu@empresa.cl"
                      />
                    </div>
                  </div>
                  <div className="ws-field-row-2">
                    <div className="ws-field">
                      <label htmlFor="ws-contact-company">Negocio o empresa (opcional)</label>
                      <input
                        id="ws-contact-company"
                        type="text"
                        value={contactCompany}
                        onChange={(e) => setContactCompany(e.target.value)}
                      />
                    </div>
                    <div className="ws-field">
                      <label htmlFor="ws-contact-phone">Teléfono o WhatsApp (opcional)</label>
                      <input
                        id="ws-contact-phone"
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  {sendState.kind === "error" && (
                    <div className="ws-error-box" role="alert">
                      {sendState.message}
                    </div>
                  )}

                  {sendState.kind === "unconfigured" && (
                    <div className="ws-error-box" role="status">
                      <span>{sendState.message}</span>
                      <a href={mailtoInfo.href} className="btn btn-secondary btn-sm" style={{ marginInlineStart: "0.5rem" }}>
                        <Mail size={14} aria-hidden="true" />
                        <span>Abrir correo</span>
                      </a>
                    </div>
                  )}

                  <div className="ws-submit-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={sendState.kind === "submitting"}
                    >
                      <span>
                        {sendState.kind === "submitting"
                          ? "Enviando ficha…"
                          : submissionConnected
                            ? "Enviar ficha a ENIX Studio →"
                            : "Preparar envío al equipo →"}
                      </span>
                    </button>
                    <a href="/privacy/" className="ws-privacy-link">
                      Privacidad y uso de datos
                    </a>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
