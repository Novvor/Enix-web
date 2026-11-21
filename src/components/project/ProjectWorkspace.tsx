import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Sparkles,
  Trash2
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
  getQuestionForStep,
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
  const [mobileTab, setMobileTab] = useState<"step" | "brief">("step");
  const [briefUpdatedUnseen, setBriefUpdatedUnseen] = useState<boolean>(false);
  const [briefPulse, setBriefPulse] = useState<boolean>(false);
  const [newReqText, setNewReqText] = useState("");
  const [manualFields] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  // Direct submit form state (shown directly on Summary step for zero friction)
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
  const idempotencyRef = useRef<string>(uid("idem"));

  const stepInputId = useId();
  const titleInputId = useId();
  const goalInputId = useId();

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
      setBrief(nextBrief);
      setMessages([
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
      ]);
      setStage(init.stage);
      setStepIndex(init.stepIndex);
      setLiveAnnouncement("Tu idea inicial ya está cargada en tu ficha de proyecto.");
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
      setBrief(createEmptyBrief("", null, "development"));
      setMessages([
        {
          id: uid("ast"),
          role: "assistant",
          stage: init.stage,
          stepId: init.stepId,
          interpretation: "Elige una opción o cuéntanos tu idea con tus palabras para armar tu ficha paso a paso.",
          text: init.question,
          options: init.options,
          createdAt: new Date().toISOString()
        }
      ]);
      setStage(init.stage);
      setStepIndex(init.stepIndex);
    }

    setHydrated(true);

    fetch("/api/project-assistant/")
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => {
        if (!info) return;
        if (info.assistantMode === "ai") setAssistantMode("ai");
        if (info.submissionConnected) setSubmissionConnected(true);
      })
      .catch(() => {});
  }, []);

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

  const activeSteps = getStepsForTrack(brief.track || "development");
  const currentStep = activeSteps[stepIndex] || activeSteps[activeSteps.length - 1];
  const isSummaryStep = currentStep.id === "summary" || stage === "summary";
  const isMarketingOrCombined = brief.track === "marketing" || brief.track === "combined";

  const latestAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const fallbackQuestion = getQuestionForStep(currentStep.id, brief);
  const activeQuestion = latestAssistantMsg?.text || fallbackQuestion.question;
  const activeInterpretation = latestAssistantMsg?.interpretation || "";
  const activeOptions = latestAssistantMsg?.options || fallbackQuestion.options;

  const progressPct = Math.min(
    100,
    Math.round(((stepIndex + (isSummaryStep ? 1 : 0.4)) / activeSteps.length) * 100)
  );

  const essentialRequirements = useMemo(
    () => brief.requirements.filter((r) => r.priority !== "later"),
    [brief.requirements]
  );
  const laterRequirements = useMemo(
    () => brief.requirements.filter((r) => r.priority === "later"),
    [brief.requirements]
  );

  function triggerBriefPulse() {
    setBriefPulse(true);
    window.setTimeout(() => setBriefPulse(false), 520);
  }

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
            isSelection,
            turnCount: messages.filter((m) => m.role === "user").length
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.ok && data.question) {
            turnResult = data;
          }
        }
      }

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

      setMessages((prev) => [
        ...prev,
        {
          id: uid("ast"),
          role: "assistant",
          stage: turnResult.stage,
          stepId: turnResult.stepId,
          interpretation: turnResult.interpretation,
          text: turnResult.question,
          options: turnResult.options,
          createdAt: new Date().toISOString()
        }
      ]);

      triggerBriefPulse();
      if (mobileTab === "step") setBriefUpdatedUnseen(true);
      setLiveAnnouncement("Avanzaste al siguiente paso y tu ficha se actualizó.");
    } catch {
      setTurnError("Hubo un problema al procesar este paso, pero tus respuestas siguen guardadas.");
    } finally {
      setIsSendingTurn(false);
    }
  }

  function handleStepBack() {
    if (stepIndex <= 0) return;
    const prevIdx = stepIndex - 1;
    const prevStep = activeSteps[prevIdx];
    const prevQ = getQuestionForStep(prevStep.id, brief);
    setStepIndex(prevIdx);
    setStage(prevStep.stage);
    setMessages((prev) => [
      ...prev,
      {
        id: uid("ast"),
        role: "assistant",
        stage: prevStep.stage,
        stepId: prevStep.id,
        interpretation: "Volviste al paso anterior para ajustar tu respuesta.",
        text: prevQ.question,
        options: prevQ.options,
        createdAt: new Date().toISOString()
      }
    ]);
  }

  function handleJumpToSummary() {
    const lastIdx = activeSteps.length - 1;
    const sumQ = getQuestionForStep("summary", brief);
    setStepIndex(lastIdx);
    setStage("summary");
    setMessages((prev) => [
      ...prev,
      {
        id: uid("ast"),
        role: "assistant",
        stage: "summary",
        stepId: "summary",
        interpretation: "Puedes revisar tu ficha y enviarla ahora mismo al equipo de ENIX Studio.",
        text: sumQ.question,
        options: [],
        createdAt: new Date().toISOString()
      }
    ]);
  }

  function handleResetDraft() {
    clearProjectDraft();
    const empty = createEmptyBrief("", null, "development");
    const init = startGuidedSession("", null);
    setBrief(empty);
    setStage("idea");
    setStepIndex(0);
    setAnswers({});
    setSendState({ kind: "idle" });
    setMessages([
      {
        id: uid("ast"),
        role: "assistant",
        stage: init.stage,
        stepId: init.stepId,
        interpretation: "Empezamos un proyecto nuevo desde cero.",
        text: init.question,
        options: init.options,
        createdAt: new Date().toISOString()
      }
    ]);
    setLiveAnnouncement("Proyecto reiniciado.");
  }

  function handleAddManualReq(e: React.FormEvent) {
    e.preventDefault();
    if (!newReqText.trim()) return;
    setBrief((prev) => addManualRequirement(prev, "requirements", newReqText, "initial"));
    setNewReqText("");
    triggerBriefPulse();
  }

  function handleDownloadMd() {
    downloadTextFile(buildSlugFilename(brief.title, "md"), briefToMarkdown(brief), "text/markdown;charset=utf-8");
    trackProjectEvent("enix_project_download", { track: brief.track, format: "md" });
  }

  function handleDownloadTxt() {
    downloadTextFile(buildSlugFilename(brief.title, "txt"), briefToPlainText(brief), "text/plain;charset=utf-8");
    trackProjectEvent("enix_project_download", { track: brief.track, format: "txt" });
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
            "Este entorno aún no tiene configurada RESEND_API_KEY. Puedes descargar tu resumen o abrirlo en tu correo."
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
        message: "Error de conexión al intentar enviar. Tu borrador sigue guardado."
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
            <span className={`status-badge ${item.status}`}>{STATUS_LABELS[item.status]}</span>
          </div>
          <div className="brief-req-actions no-print">
            {item.status !== "confirmed" && (
              <button
                type="button"
                className="brief-mini-btn is-confirm"
                onClick={() => setBrief((prev) => confirmRequirement(prev, bucket, item.id))}
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

      {/* Header + Animated Progress Bar */}
      <header className="ws-topbar no-print">
        <div className="ws-topbar-inner">
          <div className="ws-brand-group">
            <a href="/" aria-label="Volver a portada de ENIX Studio">
              <img src="/brand/enix-logo.png" alt="ENIX" width="1578" height="447" className="ws-logo-img" />
            </a>
            <span className="ws-divider" aria-hidden="true" />
            <span className="ws-title-pill">Tu proyecto</span>
            <span className={`ws-mode-badge ${assistantMode === "ai" ? "is-ai" : ""}`}>
              <Sparkles size={12} aria-hidden="true" />
              {assistantMode === "ai" ? "Asesor IA activo" : "Guía interactiva"}
            </span>
          </div>

          <ol className="ws-stepper" aria-label="Etapas del proyecto">
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
                  <span>{isDone ? "✓" : `${idx + 1}.`}</span>
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

        <div className="ws-progress-track" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la definición del proyecto">
          <div className="ws-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </header>

      {/* Mobile View Switcher */}
      <div className="workspace-mobile-tabs no-print" role="tablist" aria-label="Vistas del espacio de proyecto">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "step"}
          className="ws-tab-btn"
          onClick={() => setMobileTab("step")}
        >
          Paso {Math.min(stepIndex + 1, activeSteps.length)} de {activeSteps.length}
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
          <span>Tu ficha ({brief.requirements.length})</span>
          {briefUpdatedUnseen && <span className="ws-tab-dot" aria-label="Actualizado" />}
        </button>
      </div>

      {/* Main Split Workspace */}
      <main className="workspace-grid">
        {/* Left: Focused Interactive Step Screen */}
        <section
          key={`${currentStep.id}-${stepIndex}`}
          className={`workspace-step-col step-stage-anim no-print ${mobileTab !== "step" ? "is-hidden-mobile" : ""}`}
          aria-label="Asistente de proyectos paso a paso"
        >
          <div className="step-header-meta">
            <span className="step-counter-pill">
              Paso {Math.min(stepIndex + 1, activeSteps.length)} de {activeSteps.length} · {STAGE_LABELS[stage]}
            </span>

            {!isSummaryStep && (
              <button type="button" className="ws-link-btn" onClick={handleJumpToSummary}>
                Ir directo a enviar mi ficha →
              </button>
            )}
          </div>

          {!isSummaryStep ? (
            <>
              {activeInterpretation && (
                <div className="step-advisor-note">
                  <span className="step-advisor-icon" aria-hidden="true">
                    <Sparkles size={15} />
                  </span>
                  <span>{activeInterpretation}</span>
                </div>
              )}

              <h1 className="step-question-title">{activeQuestion}</h1>

              {activeOptions.length > 0 && (
                <div className="step-cards-grid" role="group" aria-label="Opciones rápidas">
                  {activeOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isSendingTurn}
                      className={`step-option-card ${opt.kind === "neutral" ? "is-neutral" : ""}`}
                      onClick={() => submitTurn(opt.value, opt.label, true)}
                    >
                      <span>{opt.label}</span>
                      <span className="step-option-arrow" aria-hidden="true">
                        <ArrowRight size={14} />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <form
                className="step-custom-form"
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

                <label htmlFor={stepInputId} className="step-custom-label">
                  ¿Prefieres explicarlo con tus propias palabras?
                </label>
                <div className="ws-composer-row">
                  <textarea
                    id={stepInputId}
                    rows={2}
                    maxLength={1000}
                    className="ws-input"
                    placeholder="Escribe aquí los detalles de tu proyecto o negocio…"
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
                  >
                    <span>{isSendingTurn ? "Guardando…" : "Continuar"}</span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </form>

              <div className="step-footer-nav">
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  {stepIndex > 0 && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleStepBack}>
                      <RotateCcw size={13} aria-hidden="true" />
                      <span>Paso anterior</span>
                    </button>
                  )}
                  <button type="button" className="ws-link-btn" onClick={handleResetDraft}>
                    <Trash2 size={13} aria-hidden="true" />
                    <span>Empezar de nuevo</span>
                  </button>
                </div>
                <span style={{ fontSize: "0.74rem", color: "var(--ink-muted)" }}>
                  {storageWarning ? "Sesión activa en esta pestaña" : "Guardado automático en tu navegador"}
                </span>
              </div>
            </>
          ) : (
            /* FINAL STEP SCREEN: Summary + Direct Send to ENIX Studio */
            <>
              <div className="summary-hero-box">
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--status-confirmed-ink)", fontWeight: 700, fontSize: "var(--text-xs)" }}>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>Ficha lista para revisión comercial</span>
                </div>
                <h1 className="step-question-title" style={{ fontSize: "clamp(1.4rem, 2.2vw, 1.85rem)" }}>
                  Envía tu proyecto al equipo de ENIX Studio
                </h1>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-secondary)", lineHeight: 1.55 }}>
                  Revisa o edita cualquier punto de tu ficha al costado. Al enviarla, nuestro equipo revisará tu alcance para proponerte el siguiente paso concreto.
                </p>
              </div>

              <form className="summary-submit-card" onSubmit={handleSendSubmit}>
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
                      placeholder="Nombre de tu negocio"
                    />
                  </div>
                  <div className="send-field">
                    <label htmlFor="send-phone">WhatsApp o teléfono (opcional)</label>
                    <input
                      id="send-phone"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+56 9 …"
                    />
                  </div>
                </div>

                {sendState.kind === "success" && (
                  <div className="send-status-box is-ok" role="status">
                    <strong>¡Solicitud recibida ({sendState.referenceId})!</strong> {sendState.message}
                  </div>
                )}

                {sendState.kind === "unconfigured" && (
                  <div className="send-status-box is-info" role="status">
                    <p style={{ marginBottom: 8 }}>{sendState.message}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadMd}>
                        Descargar resumen (.md)
                      </button>
                      <a href={buildMailtoHref(brief, siteConfig.contactEmail)} className="btn btn-secondary btn-sm">
                        Abrir correo con mi resumen
                      </a>
                    </div>
                  </div>
                )}

                {sendState.kind === "error" && (
                  <div className="composer-error" role="alert">
                    {sendState.message}
                  </div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleStepBack}>
                    <RotateCcw size={13} aria-hidden="true" />
                    <span>Volver al paso anterior</span>
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={sendState.kind === "submitting" || sendState.kind === "success"}
                  >
                    <Send size={15} aria-hidden="true" />
                    <span>
                      {sendState.kind === "submitting"
                        ? "Enviando proyecto…"
                        : sendState.kind === "success"
                          ? "Proyecto enviado"
                          : submissionConnected
                            ? "Enviar mi proyecto a ENIX Studio"
                            : "Solicitar evaluación"}
                    </span>
                  </button>
                </div>
              </form>

              <div className="step-footer-nav">
                <a href={buildMailtoHref(brief, siteConfig.contactEmail)} className="ws-link-btn">
                  <Mail size={13} aria-hidden="true" />
                  <span>Abrir resumen en mi correo</span>
                </a>
                <button type="button" className="ws-link-btn" onClick={handleResetDraft}>
                  <Trash2 size={13} aria-hidden="true" />
                  <span>Iniciar otro proyecto</span>
                </button>
              </div>
            </>
          )}
        </section>

        {/* Right: Live Editable Brief Sidebar */}
        <aside
          className={`workspace-brief-col ${briefPulse ? "is-pulsing" : ""} ${mobileTab !== "brief" ? "is-hidden-mobile" : ""}`}
          aria-label="Ficha editable de proyecto"
        >
          <div className="brief-head">
            <div className="brief-head-meta">
              <span className="eyebrow" style={{ paddingBlock: "0.22rem", fontSize: "0.72rem" }}>
                <span className="eyebrow-dot" aria-hidden="true" />
                Tu ficha en vivo
              </span>
              <span className="brief-rev">Rev. #{brief.revision}</span>
            </div>

            <label htmlFor={titleInputId} className="visually-hidden">
              Título provisional del proyecto
            </label>
            <input
              id={titleInputId}
              type="text"
              className="brief-editable-title"
              value={brief.title}
              placeholder="Título de tu proyecto"
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
              placeholder="Resume qué quieres lograr…"
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

            <div className="brief-legend">
              <span className="status-badge confirmed">Confirmado</span>
              <span className="status-badge suggested">Sugerido</span>
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
                      fontSize: "0.75rem",
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
            <div className="brief-section">
              <h2 className="brief-section-title">Contexto comercial y presupuestos</h2>
              <div className="brief-kv" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label htmlFor="brief-audience-territory" style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>
                  Público y territorio
                </label>
                <input
                  id="brief-audience-territory"
                  type="text"
                  className="brief-add-input"
                  value={brief.targetAudienceAndTerritory || ""}
                  placeholder="Ej: Clientes locales en Santiago"
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

              <div className="brief-kv-grid">
                <div className="brief-kv" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label htmlFor="brief-ad-spend" style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>
                    Inversión en anuncios
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
                  <label htmlFor="brief-service-budget" style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>
                    Presupuesto servicios
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
                Tus respuestas y sugerencias irán apareciendo aquí paso a paso.
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
                <span>Sumar</span>
              </button>
            </form>
          </div>

          {laterRequirements.length > 0 && (
            <div className="brief-section">
              <h2 className="brief-section-title">Para después</h2>
              {renderRequirementList(laterRequirements, "requirements", true)}
            </div>
          )}

          {brief.indicatorsToAgree && brief.indicatorsToAgree.length > 0 && (
            <div className="brief-section">
              <h2 className="brief-section-title">Indicadores por acordar</h2>
              {renderRequirementList(brief.indicatorsToAgree, "indicatorsToAgree", false)}
            </div>
          )}

          <div className="brief-actions-bar no-print">
            <div className="brief-export-row">
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadMd}>
                <Download size={14} aria-hidden="true" />
                <span>.md</span>
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadTxt}>
                <FileText size={14} aria-hidden="true" />
                <span>.txt</span>
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                <Printer size={14} aria-hidden="true" />
                <span>PDF</span>
              </button>
            </div>
            <p className="brief-disclaimer">{siteConfig.responsibilityStatement}</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
