import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  Mail,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import {
  CATEGORY_LABELS,
  MODALITY_LABELS,
  PRIORITY_LABELS,
  STAGE_LABELS,
  STATUS_LABELS,
  TRACK_LABELS,
  type ChatMessage,
  type EngagementModality,
  type ProjectBrief,
  type ProjectStage,
  createEmptyBrief,
  normalizeBrief
} from "@/lib/project/schema";
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
  saveProjectDraft
} from "@/lib/project/storage";
import {
  briefToMarkdown,
  briefToPlainText,
  buildMailtoHref,
  buildSlugFilename,
  downloadTextFile
} from "@/lib/project/export";
import {
  getStepsForTrack,
  processGuidedAnswer,
  startGuidedSession
} from "@/lib/project/guided-engine";
import { siteConfig } from "@/content/site";
import { trackProjectEvent } from "@/lib/analytics/events";
import "./workspace.css";

const STAGES: ProjectStage[] = ["idea", "needs", "priorities", "summary"];

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function ProjectWorkspace() {
  const [brief, setBrief] = useState<ProjectBrief>(() => createEmptyBrief());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stage, setStage] = useState<ProjectStage>("idea");
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputText, setInputText] = useState("");
  const [isSendingTurn, setIsSendingTurn] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [assistantMode, setAssistantMode] = useState<"guided" | "ai">("guided");
  const [submissionConnected, setSubmissionConnected] = useState<boolean>(false);
  const [storageWarning, setStorageWarning] = useState<boolean>(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");
  const [mobileTab, setMobileTab] = useState<"chat" | "brief">("chat");
  const [briefUpdatedUnseen, setBriefUpdatedUnseen] = useState<boolean>(false);
  const [newReqText, setNewReqText] = useState("");
  const [manualFields] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  // Send modal state
  const sendDialogRef = useRef<HTMLDialogElement | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactCompany, setContactCompany] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [sendState, setSendState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "success"; referenceId: string; message: string }
    | { kind: "unconfigured"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const idempotencyRef = useRef<string>(uid("idem"));

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputId = useId();
  const titleInputId = useId();
  const goalInputId = useId();

  // Initialize from starter idea, URL category, or saved draft
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCategory = params.get("category") || params.get("categoria");
    const starter = consumeStarterIdea();
    const { draft, storageAvailable } = loadProjectDraft();
    setStorageWarning(!storageAvailable);

    if (starter && starter.idea) {
      const init = startGuidedSession(starter.idea, starter.category || urlCategory);
      const baseBrief = createEmptyBrief(starter.idea, starter.category || urlCategory, init.track);
      const nextBrief = applyBriefPatch(baseBrief, init.briefPatch);
      const initialMsgs: ChatMessage[] = [
        {
          id: uid("usr"),
          role: "user",
          stage: "idea",
          text: starter.idea,
          createdAt: new Date().toISOString()
        },
        {
          id: uid("ast"),
          role: "assistant",
          stage: init.stage,
          stepId: init.stepId,
          interpretation: init.interpretation,
          text: init.question,
          options: init.options,
          createdAt: new Date().toISOString()
        }
      ];
      setBrief(nextBrief);
      setMessages(initialMsgs);
      setStage(init.stage);
      setStepIndex(init.stepIndex);
      setLiveAnnouncement("Tu idea inicial ya está cargada en la ficha de proyecto.");
      trackProjectEvent("enix_project_start", {
        track: init.track,
        category: nextBrief.category || "undetermined"
      });
    } else if (urlCategory && CATEGORY_LABELS[urlCategory]) {
      const init = startGuidedSession("", urlCategory);
      const baseBrief = createEmptyBrief("", urlCategory, init.track);
      const nextBrief = applyBriefPatch(baseBrief, init.briefPatch);
      setBrief(nextBrief);
      setMessages([
        {
          id: uid("ast"),
          role: "assistant",
          stage: init.stage,
          stepId: init.stepId,
          interpretation: init.interpretation,
          text: init.question,
          options: init.options,
          createdAt: new Date().toISOString()
        }
      ]);
      setStage(init.stage);
      setStepIndex(init.stepIndex);
    } else if (draft) {
      setBrief(normalizeBrief(draft.brief));
      setMessages(draft.messages);
      setStage(draft.stage);
      setStepIndex(draft.currentStepIndex);
      setAnswers(draft.answers || {});
    } else {
      const init = startGuidedSession("", null);
      const baseBrief = createEmptyBrief("", null);
      setBrief(baseBrief);
      setMessages([
        {
          id: uid("ast"),
          role: "assistant",
          stage: init.stage,
          stepId: init.stepId,
          interpretation: "Cuéntame qué tienes en mente o elige una categoría para empezar.",
          text: init.question,
          options: init.options,
          createdAt: new Date().toISOString()
        }
      ]);
      setStage(init.stage);
      setStepIndex(init.stepIndex);
    }

    setHydrated(true);

    // Check server capabilities (AI provider & email submission)
    fetch("/api/project-assistant/")
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => {
        if (!info) return;
        if (info.assistantMode === "ai") setAssistantMode("ai");
        if (info.submissionConnected) setSubmissionConnected(true);
      })
      .catch(() => {
        // Stay honestly in local guided mode
      });
  }, []);

  // Persist draft automatically
  useEffect(() => {
    if (!hydrated) return;
    saveProjectDraft({
      schemaVersion: 1,
      stage,
      currentStepIndex: stepIndex,
      brief,
      messages,
      answers
    });
  }, [hydrated, brief, messages, stage, stepIndex, answers]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  const activeSteps = getStepsForTrack(brief.track || "development");
  const currentStep = activeSteps[stepIndex] || activeSteps[activeSteps.length - 1];
  const isMarketingOrCombined = brief.track === "marketing" || brief.track === "combined";

  const essentialRequirements = useMemo(
    () => brief.requirements.filter((r) => r.priority !== "later"),
    [brief.requirements]
  );
  const laterRequirements = useMemo(
    () => brief.requirements.filter((r) => r.priority === "later"),
    [brief.requirements]
  );

  async function submitTurn(answerText: string, displayLabel?: string, isSelection = false) {
    const clean = answerText.trim();
    if (!clean || isSendingTurn) return;

    setTurnError(null);
    setIsSendingTurn(true);

    const userDisplay = displayLabel || clean;
    const stepId = currentStep.id;
    const expectedRev = brief.revision;

    const userMsg: ChatMessage = {
      id: uid("usr"),
      role: "user",
      stage,
      stepId,
      text: userDisplay,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setAnswers((prev) => ({ ...prev, [stepId]: userDisplay }));

    try {
      let turnResult = processGuidedAnswer(brief, stepId, clean, isSelection);

      if (assistantMode === "ai") {
        const res = await fetch("/api/project-assistant/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief,
            stepId,
            answer: clean,
            isSelection
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.ok && data.question) {
            turnResult = data;
          }
        }
      }

      // Apply patch with revision control so manual edits are never clobbered
      setBrief((prev) =>
        applyBriefPatch(prev, turnResult.patch, {
          expectedRevision: expectedRev,
          manualFields
        })
      );

      const resolvedTrack = turnResult.patch.track || brief.track || "development";
      const nextSteps = getStepsForTrack(resolvedTrack);
      const nextIdx = nextSteps.findIndex((s) => s.id === turnResult.stepId);
      if (nextIdx >= 0) setStepIndex(nextIdx);
      setStage(turnResult.stage);
      if (turnResult.stage === "summary" && stage !== "summary") {
        trackProjectEvent("enix_project_summary", {
          track: resolvedTrack,
          category: turnResult.patch.category || brief.category || "undetermined"
        });
      }

      const assistantMsg: ChatMessage = {
        id: uid("ast"),
        role: "assistant",
        stage: turnResult.stage,
        stepId: turnResult.stepId,
        interpretation: turnResult.interpretation,
        text: turnResult.question,
        options: turnResult.options,
        createdAt: new Date().toISOString()
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (mobileTab === "chat") setBriefUpdatedUnseen(true);
      setLiveAnnouncement("La ficha de proyecto se actualizó con tu respuesta.");
    } catch {
      setTurnError("Hubo un problema al procesar la respuesta, pero tus datos siguen guardados. Puedes reintentar.");
    } finally {
      setIsSendingTurn(false);
    }
  }

  function handleStepBack() {
    if (stepIndex <= 0) return;
    const prevIdx = stepIndex - 1;
    const prevStep = activeSteps[prevIdx];
    setStepIndex(prevIdx);
    setStage(prevStep.stage);
    const prevTurn = processGuidedAnswer(brief, activeSteps[Math.max(0, prevIdx - 1)].id, "__skip__", true);
    setMessages((prev) => [
      ...prev,
      {
        id: uid("ast"),
        role: "assistant",
        stage: prevStep.stage,
        stepId: prevStep.id,
        interpretation: "Volvemos a esta etapa para ajustar lo que necesites.",
        text: prevTurn.question,
        options: prevTurn.options,
        createdAt: new Date().toISOString()
      }
    ]);
  }

  function handleResetDraft() {
    clearProjectDraft();
    const empty = createEmptyBrief();
    const init = startGuidedSession("", null);
    setBrief(empty);
    setStage("idea");
    setStepIndex(0);
    setAnswers({});
    setMessages([
      {
        id: uid("ast"),
        role: "assistant",
        stage: init.stage,
        stepId: init.stepId,
        interpretation: "Empezamos una ficha nueva desde cero.",
        text: init.question,
        options: init.options,
        createdAt: new Date().toISOString()
      }
    ]);
    setLiveAnnouncement("Borrador reiniciado.");
  }

  function handleAddManualReq(e: React.FormEvent) {
    e.preventDefault();
    if (!newReqText.trim()) return;
    setBrief((prev) => addManualRequirement(prev, "requirements", newReqText, "initial"));
    setNewReqText("");
    setLiveAnnouncement("Requisito agregado a Lo esencial.");
  }

  function handleDownloadMd() {
    const md = briefToMarkdown(brief);
    downloadTextFile(buildSlugFilename(brief.title, "md"), md, "text/markdown;charset=utf-8");
    trackProjectEvent("enix_project_download", { track: brief.track, format: "md" });
    setLiveAnnouncement("Resumen descargado en formato Markdown.");
  }

  function handleDownloadTxt() {
    const txt = briefToPlainText(brief);
    downloadTextFile(buildSlugFilename(brief.title, "txt"), txt, "text/plain;charset=utf-8");
    trackProjectEvent("enix_project_download", { track: brief.track, format: "txt" });
    setLiveAnnouncement("Resumen descargado en texto plano.");
  }

  function openSendDialog() {
    setSendState({ kind: "idle" });
    idempotencyRef.current = uid("idem");
    sendDialogRef.current?.showModal();
  }

  async function handleSendSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim()) {
      setSendState({ kind: "error", message: "Ingresa tu nombre y un correo electrónico válido." });
      return;
    }
    setSendState({ kind: "submitting" });
    try {
      const res = await fetch("/api/project-submit/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          company: contactCompany,
          role: contactRole,
          phone: contactPhone,
          idempotencyKey: idempotencyRef.current,
          brief
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        trackProjectEvent("enix_project_submit_confirmed", {
          track: brief.track,
          category: brief.category || "undetermined"
        });
        setSendState({
          kind: "success",
          referenceId: data.referenceId,
          message: data.message
        });
      } else if (data?.code === "missing_mail_config") {
        setSendState({
          kind: "unconfigured",
          message:
            "Este entorno aún no tiene configurada la credencial de envío directo (RESEND_API_KEY). Puedes descargar tu resumen o abrirlo en tu cliente de correo."
        });
      } else {
        setSendState({
          kind: "error",
          message: data?.message || "No pudimos enviar tu ficha en este momento. Puedes descargarla y enviarla por correo."
        });
      }
    } catch {
      setSendState({
        kind: "error",
        message: "Error de conexión al intentar enviar. Tu borrador sigue intacto y puedes descargarlo."
      });
    }
  }

  const renderRequirementList = (
    items: ProjectBrief["requirements"],
    bucket: RequirementBucket,
    showPriorityToggle = false
  ) => (
    <ul className="brief-req-list">
      {items.map((item) => (
        <li
          key={item.id}
          className={`brief-req-item ${item.status === "suggested" ? "is-suggested" : ""}`}
        >
          <div className="brief-req-top">
            <span className="brief-req-text">{item.text}</span>
            <span className={`status-badge ${item.status}`}>
              {STATUS_LABELS[item.status]}
            </span>
          </div>
          <div className="brief-req-actions no-print">
            {item.status !== "confirmed" && (
              <button
                type="button"
                className="brief-mini-btn is-confirm"
                onClick={() => setBrief((prev) => confirmRequirement(prev, bucket, item.id))}
                aria-label={`Confirmar: ${item.text}`}
              >
                <Check size={12} style={{ display: "inline", marginRight: 3 }} aria-hidden="true" />
                Confirmar
              </button>
            )}
            {showPriorityToggle && (
              <button
                type="button"
                className="brief-mini-btn"
                onClick={() =>
                  setBrief((prev) =>
                    toggleRequirementPriority(
                      prev,
                      bucket,
                      item.id,
                      item.priority === "later" ? "initial" : "later"
                    )
                  )
                }
              >
                Mover a {item.priority === "later" ? PRIORITY_LABELS.initial : PRIORITY_LABELS.later}
              </button>
            )}
            <button
              type="button"
              className="brief-mini-btn"
              onClick={() => setBrief((prev) => removeRequirement(prev, bucket, item.id))}
              aria-label={`Quitar: ${item.text}`}
            >
              Quitar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="ws-shell" id="espacio-proyecto">
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Compact Workspace Header */}
      <header className="ws-topbar no-print">
        <div className="ws-topbar-inner">
          <div className="ws-brand-group">
            <a href="/" aria-label="Volver a portada de ENIX Studio">
              <img
                src="/brand/enix-logo.png"
                alt="ENIX"
                width="1578"
                height="447"
                className="ws-logo-img"
              />
            </a>
            <span className="ws-divider" aria-hidden="true" />
            <span className="ws-title-pill">Tu proyecto</span>
            <span className={`ws-mode-badge ${assistantMode === "ai" ? "is-ai" : ""}`}>
              <Sparkles size={12} aria-hidden="true" />
              {assistantMode === "ai" ? "Asistencia con IA" : "Modo guiado local"}
            </span>
          </div>

          <ol className="ws-stepper" aria-label="Etapas de definición">
            {STAGES.map((st, idx) => {
              const currentStageIdx = STAGES.indexOf(stage);
              const isActive = st === stage;
              const isDone = idx < currentStageIdx;
              return (
                <li
                  key={st}
                  className={`ws-step ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""}`}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span>{idx + 1}.</span>
                  <span>{STAGE_LABELS[st]}</span>
                </li>
              );
            })}
          </ol>

          <div className="ws-top-actions">
            <a href="/contact/" className="btn btn-secondary btn-sm">
              Hablar con el equipo
            </a>
            <a href="/" className="btn btn-secondary btn-sm">
              <ArrowLeft size={14} aria-hidden="true" />
              <span>Portada</span>
            </a>
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      <div className="workspace-mobile-tabs no-print" role="tablist" aria-label="Vistas del espacio de proyecto">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "chat"}
          className="ws-tab-btn"
          onClick={() => setMobileTab("chat")}
        >
          Conversación
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "brief"}
          className="ws-tab-btn"
          onClick={() => {
            setMobileTab("brief");
            setBriefUpdatedUnseen(false);
          }}
        >
          <span>Tu proyecto</span>
          {briefUpdatedUnseen && <span className="ws-tab-dot" aria-label="Actualizado" />}
        </button>
      </div>

      {/* Main Split Workspace */}
      <main className="workspace-grid">
        {/* Conversation Column */}
        <section
          className={`workspace-chat-col no-print ${mobileTab !== "chat" ? "is-hidden-mobile" : ""}`}
          aria-label="Asistente de proyectos ENIX"
        >
          <div className="ws-chat-notice">
            <span>
              <strong>{assistantMode === "ai" ? "Asistencia con IA activa:" : "Modo guiado local:"}</strong>{" "}
              {assistantMode === "ai"
                ? "El asistente ayuda a definir tu ficha; el equipo de ENIX diseña y desarrolla la solución."
                : "Preguntas estructuradas sin credenciales externas. Todas tus respuestas y ediciones se guardan en este navegador."}
            </span>
          </div>

          <div className="ws-messages" role="log" aria-label="Historial de conversación">
            {messages.map((msg, idx) => {
              const isLatest = idx === messages.length - 1 && msg.role === "assistant";
              return (
                <div key={msg.id} className={`ws-msg ws-msg-${msg.role}`}>
                  <div className="ws-msg-bubble">
                    {msg.interpretation && <p className="ws-msg-interp">{msg.interpretation}</p>}
                    <p className={msg.role === "assistant" ? "ws-msg-question" : ""}>{msg.text}</p>
                  </div>

                  {isLatest && msg.options && msg.options.length > 0 && (
                    <div className="ws-options-wrap" role="group" aria-label="Opciones sugeridas">
                      {msg.options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={isSendingTurn}
                          className={`ws-option-btn ${opt.kind === "neutral" ? "is-neutral" : ""}`}
                          onClick={() => submitTurn(opt.value, opt.label, true)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form
            className="ws-composer"
            onSubmit={(e) => {
              e.preventDefault();
              submitTurn(inputText, inputText, false);
            }}
          >
            {turnError && (
              <div className="composer-error" role="alert">
                {turnError}
              </div>
            )}
            <label htmlFor={chatInputId} className="visually-hidden">
              Escribe tu respuesta o agrega un detalle a tu ficha
            </label>
            <div className="ws-composer-row">
              <textarea
                id={chatInputId}
                rows={2}
                maxLength={1200}
                className="ws-input"
                placeholder={
                  stage === "summary"
                    ? "Agrega otro detalle o requisito para sumarlo a tu ficha…"
                    : "Escribe tu respuesta con tus propias palabras…"
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitTurn(inputText, inputText, false);
                  }
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSendingTurn || !inputText.trim()}
                aria-label="Enviar respuesta"
              >
                <Send size={16} aria-hidden="true" />
                <span>Enviar</span>
              </button>
            </div>
            <div className="ws-composer-meta">
              <span>
                {storageWarning
                  ? "Almacenamiento local restringido: tu sesión sigue activa mientras mantengas esta pestaña."
                  : "Borrador guardado automáticamente en este navegador."}
              </span>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {stepIndex > 0 && (
                  <button type="button" className="ws-link-btn" onClick={handleStepBack}>
                    <RotateCcw size={12} style={{ display: "inline", marginRight: 3 }} aria-hidden="true" />
                    Etapa anterior
                  </button>
                )}
                <button type="button" className="ws-link-btn" onClick={handleResetDraft}>
                  <Trash2 size={12} style={{ display: "inline", marginRight: 3 }} aria-hidden="true" />
                  Empezar de nuevo
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Live Editable Project Brief Column */}
        <aside
          className={`workspace-brief-col ${mobileTab !== "brief" ? "is-hidden-mobile" : ""}`}
          aria-label="Ficha editable de proyecto"
        >
          <div className="brief-head">
            <div className="brief-head-meta">
              <span className="eyebrow" style={{ paddingBlock: "0.25rem", fontSize: "0.74rem" }}>
                <span className="eyebrow-dot" aria-hidden="true" />
                Ficha de proyecto
              </span>
              <span className="brief-rev">Revisión #{brief.revision}</span>
            </div>

            <label htmlFor={titleInputId} className="visually-hidden">
              Título provisional del proyecto
            </label>
            <input
              id={titleInputId}
              type="text"
              className="brief-editable-title"
              value={brief.title}
              placeholder="Título provisional de tu proyecto"
              onChange={(e) => {
                manualFields.add("title");
                setBrief((prev) => ({
                  ...prev,
                  title: e.target.value,
                  revision: prev.revision + 1,
                  updatedAt: new Date().toISOString()
                }));
              }}
            />

            <label htmlFor={goalInputId} className="brief-section-title">
              Objetivo principal (editable)
            </label>
            <textarea
              id={goalInputId}
              rows={2}
              className="brief-editable-goal"
              value={brief.goal}
              placeholder="Resume en una o dos frases qué quieres lograr…"
              onChange={(e) => {
                manualFields.add("goal");
                setBrief((prev) => ({
                  ...prev,
                  goal: e.target.value,
                  revision: prev.revision + 1,
                  updatedAt: new Date().toISOString()
                }));
              }}
            />

            <div className="brief-legend" aria-label="Significado de los estados">
              <span className="status-badge confirmed">Confirmado</span>
              <span className="status-badge suggested">Sugerido (por validar)</span>
              <span className="status-badge pending">Por definir</span>
            </div>
          </div>

          <dl className="brief-kv-grid">
            <div className="brief-kv">
              <dt>Enfoque</dt>
              <dd>{TRACK_LABELS[brief.track || "development"]}</dd>
            </div>
            <div className="brief-kv">
              <dt>{isMarketingOrCombined ? "Línea principal" : "Tipo de solución"}</dt>
              <dd>{brief.category ? CATEGORY_LABELS[brief.category] || brief.category : "Por definir"}</dd>
            </div>
            <div className="brief-kv">
              <dt>Fechas / plazo</dt>
              <dd>{brief.declaredTimeline || "Por definir"}</dd>
            </div>
            {isMarketingOrCombined && (
              <div className="brief-kv">
                <dt>Modalidad</dt>
                <dd>
                  <select
                    aria-label="Modalidad de trabajo"
                    value={brief.engagementModality || "undecided"}
                    onChange={(e) => {
                      manualFields.add("engagementModality");
                      setBrief((prev) => ({
                        ...prev,
                        engagementModality: e.target.value as EngagementModality,
                        revision: prev.revision + 1,
                        updatedAt: new Date().toISOString()
                      }));
                    }}
                    style={{
                      width: "100%",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 8,
                      padding: "0.2rem 0.4rem",
                      background: "var(--bg-surface)",
                      fontSize: "0.76rem",
                      fontWeight: 700
                    }}
                  >
                    <option value="undecided">{MODALITY_LABELS.undecided}</option>
                    <option value="one-time">{MODALITY_LABELS["one-time"]}</option>
                    <option value="ongoing">{MODALITY_LABELS.ongoing}</option>
                  </select>
                </dd>
              </div>
            )}
          </dl>

          {isMarketingOrCombined && (
            <div className="brief-section" style={{ gap: "0.7rem" }}>
              <h2 className="brief-section-title">Contexto comercial y presupuestos separados</h2>

              <div className="brief-kv" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label htmlFor="brief-audience-territory" style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
                  Público y territorio (editable)
                </label>
                <input
                  id="brief-audience-territory"
                  type="text"
                  className="brief-add-input"
                  value={brief.targetAudienceAndTerritory || ""}
                  placeholder="Ej: Clientes locales en Santiago / Empresas B2B en Chile"
                  onChange={(e) => {
                    manualFields.add("targetAudienceAndTerritory");
                    setBrief((prev) => ({
                      ...prev,
                      targetAudienceAndTerritory: e.target.value,
                      revision: prev.revision + 1,
                      updatedAt: new Date().toISOString()
                    }));
                  }}
                />
              </div>

              <div className="brief-kv" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label htmlFor="brief-existing-channels" style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
                  Canales y activos existentes (editable)
                </label>
                <input
                  id="brief-existing-channels"
                  type="text"
                  className="brief-add-input"
                  value={brief.existingChannelsAndAssets || ""}
                  placeholder="Ej: Instagram activo, web básica, sin campañas previas"
                  onChange={(e) => {
                    manualFields.add("existingChannelsAndAssets");
                    setBrief((prev) => ({
                      ...prev,
                      existingChannelsAndAssets: e.target.value,
                      revision: prev.revision + 1,
                      updatedAt: new Date().toISOString()
                    }));
                  }}
                />
              </div>

              <div className="brief-kv-grid">
                <div className="brief-kv" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label htmlFor="brief-ad-spend" style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
                    Inversión publicitaria (anuncios)
                  </label>
                  <input
                    id="brief-ad-spend"
                    type="text"
                    className="brief-add-input"
                    value={brief.adSpendBudget || ""}
                    placeholder="Por definir"
                    onChange={(e) => {
                      manualFields.add("adSpendBudget");
                      setBrief((prev) => ({
                        ...prev,
                        adSpendBudget: e.target.value || null,
                        revision: prev.revision + 1,
                        updatedAt: new Date().toISOString()
                      }));
                    }}
                  />
                </div>
                <div className="brief-kv" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label htmlFor="brief-service-budget" style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
                    Presupuesto de servicios (honorarios)
                  </label>
                  <input
                    id="brief-service-budget"
                    type="text"
                    className="brief-add-input"
                    value={brief.serviceBudget || ""}
                    placeholder="Por definir"
                    onChange={(e) => {
                      manualFields.add("serviceBudget");
                      setBrief((prev) => ({
                        ...prev,
                        serviceBudget: e.target.value || null,
                        revision: prev.revision + 1,
                        updatedAt: new Date().toISOString()
                      }));
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {brief.indicatorsToAgree && brief.indicatorsToAgree.length > 0 && (
            <div className="brief-section">
              <h2 className="brief-section-title">Indicadores por acordar</h2>
              {renderRequirementList(brief.indicatorsToAgree, "indicatorsToAgree", false)}
            </div>
          )}

          {brief.currentSituation && (
            <div className="brief-section">
              <h2 className="brief-section-title">Situación actual</h2>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)" }}>
                {brief.currentSituation}
              </p>
            </div>
          )}

          {brief.users.length > 0 && (
            <div className="brief-section">
              <h2 className="brief-section-title">Personas usuarias</h2>
              {renderRequirementList(brief.users, "users", false)}
            </div>
          )}

          <div className="brief-section">
            <h2 className="brief-section-title">Lo esencial para empezar</h2>
            {essentialRequirements.length > 0 ? (
              renderRequirementList(essentialRequirements, "requirements", true)
            ) : (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                A medida que respondas aparecerán aquí tus prioridades y sugerencias editables.
              </p>
            )}

            <form className="brief-add-row no-print" onSubmit={handleAddManualReq}>
              <label htmlFor="add-req-input" className="visually-hidden">
                Agregar requisito manual
              </label>
              <input
                id="add-req-input"
                type="text"
                className="brief-add-input"
                placeholder="Agregar requisito confirmado…"
                value={newReqText}
                onChange={(e) => setNewReqText(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary btn-sm">
                <Plus size={14} aria-hidden="true" />
                <span>Agregar</span>
              </button>
            </form>
          </div>

          {laterRequirements.length > 0 && (
            <div className="brief-section">
              <h2 className="brief-section-title">Para después</h2>
              {renderRequirementList(laterRequirements, "requirements", true)}
            </div>
          )}

          {brief.integrations.length > 0 && (
            <div className="brief-section">
              <h2 className="brief-section-title">Integraciones y herramientas</h2>
              {renderRequirementList(brief.integrations, "integrations", false)}
            </div>
          )}

          {brief.openQuestions.length > 0 && (
            <div className="brief-section">
              <h2 className="brief-section-title">Por definir</h2>
              <ul className="brief-req-list">
                {brief.openQuestions.map((q) => (
                  <li key={q} className="brief-req-item">
                    <div className="brief-req-top">
                      <span className="brief-req-text">{q}</span>
                      <span className="status-badge pending">Por definir</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Export & Submit Actions */}
          <div className="brief-actions-bar no-print">
            <div className="brief-export-row">
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadMd}>
                <Download size={14} aria-hidden="true" />
                <span>Descargar .md</span>
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadTxt}>
                <FileText size={14} aria-hidden="true" />
                <span>Descargar .txt</span>
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                <Printer size={14} aria-hidden="true" />
                <span>Imprimir / PDF</span>
              </button>
            </div>

            <button type="button" className="btn btn-primary" onClick={openSendDialog}>
              <Mail size={16} aria-hidden="true" />
              <span>Solicitar evaluación a ENIX Studio</span>
            </button>

            <p className="brief-disclaimer">
              {siteConfig.responsibilityStatement} Este documento resume tu alcance inicial y no constituye una propuesta comercial cerrada.
            </p>
          </div>
        </aside>
      </main>

      {/* Native <dialog> for Reviewing and Submitting Brief */}
      <dialog
        ref={sendDialogRef}
        aria-labelledby="send-dialog-title"
        {...({ closedby: "any" } as Record<string, string>)}
      >
        <div className="send-dialog-body">
          <div className="send-dialog-head">
            <div>
              <h2 id="send-dialog-title" className="heading-md">
                Enviar ficha a ENIX Studio
              </h2>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)", marginTop: 4 }}>
                Revisa exactamente qué información se compartirá antes de enviar.
              </p>
            </div>
            <form method="dialog">
              <button type="submit" className="mobile-close-btn" aria-label="Cerrar ventana">
                <X size={18} aria-hidden="true" />
              </button>
            </form>
          </div>

          <form onSubmit={handleSendSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="send-form-grid">
              <div className="send-field">
                <label htmlFor="send-name">Tu nombre *</label>
                <input
                  id="send-name"
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Nombre y apellido"
                />
              </div>
              <div className="send-field">
                <label htmlFor="send-email">Correo electrónico *</label>
                <input
                  id="send-email"
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="nombre@empresa.com"
                />
              </div>
              <div className="send-field">
                <label htmlFor="send-company">Empresa o negocio (opcional)</label>
                <input
                  id="send-company"
                  type="text"
                  value={contactCompany}
                  onChange={(e) => setContactCompany(e.target.value)}
                />
              </div>
              <div className="send-field">
                <label htmlFor="send-phone">Teléfono o WhatsApp (opcional)</label>
                <input
                  id="send-phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
              <div className="send-field full">
                <label htmlFor="send-role">Cargo o rol (opcional)</label>
                <input
                  id="send-role"
                  type="text"
                  value={contactRole}
                  onChange={(e) => setContactRole(e.target.value)}
                />
              </div>
            </div>

            <div>
              <p className="brief-section-title" style={{ marginBottom: 6 }}>
                Resumen que se incluirá
              </p>
              <div className="send-preview-box">{briefToPlainText(brief)}</div>
            </div>

            {sendState.kind === "success" && (
              <div className="send-status-box is-ok" role="status">
                <strong>Recepción confirmada ({sendState.referenceId}):</strong> {sendState.message}
              </div>
            )}

            {sendState.kind === "unconfigured" && (
              <div className="send-status-box is-info" role="status">
                <p style={{ marginBottom: 8 }}>{sendState.message}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadMd}>
                    Descargar resumen (.md)
                  </button>
                  <a
                    href={buildMailtoHref(brief, siteConfig.contactEmail)}
                    className="btn btn-secondary btn-sm"
                  >
                    Abrir correo con mi resumen
                  </a>
                </div>
                <p style={{ fontSize: "0.7rem", marginTop: 6, color: "var(--ink-secondary)" }}>
                  Nota: abrir tu cliente de correo no equivale a una recepción confirmada hasta que envíes el mensaje.
                </p>
              </div>
            )}

            {sendState.kind === "error" && (
              <div className="composer-error" role="alert">
                {sendState.message}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem" }}>
              <a
                href={buildMailtoHref(brief, siteConfig.contactEmail)}
                className="btn btn-secondary btn-sm"
              >
                Abrir correo con mi resumen
              </a>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={sendState.kind === "submitting" || sendState.kind === "success"}
              >
                {sendState.kind === "submitting"
                  ? "Enviando…"
                  : submissionConnected
                    ? "Enviar ficha al equipo"
                    : "Intentar envío directo"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}
