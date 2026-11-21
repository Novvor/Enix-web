import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
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
  buildSlugFilename,
  downloadTextFile,
  prepareMailto
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
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");
  const [newReqText, setNewReqText] = useState("");
  const [copiedFull, setCopiedFull] = useState(false);
  const [manualFields] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  const previewDialogRef = useRef<HTMLDialogElement | null>(null);

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
  const idempotencyRef = useRef<string>(uid("idem"));

  const stepInputId = useId();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCategory = params.get("category") || params.get("categoria");
    const starter = consumeStarterIdea();
    const { draft } = loadProjectDraft();

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
          interpretation: "Responde unos pasos rápidos y armamos juntos tu ficha lista para evaluar.",
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
    Math.round(((stepIndex + (isSummaryStep ? 1 : 0.35)) / activeSteps.length) * 100)
  );

  const essentialRequirements = useMemo(
    () => brief.requirements.filter((r) => r.priority !== "later"),
    [brief.requirements]
  );
  const laterRequirements = useMemo(
    () => brief.requirements.filter((r) => r.priority === "later"),
    [brief.requirements]
  );

  const compactSummaryChips = useMemo(() => {
    const chips: string[] = [];
    if (brief.category && CATEGORY_LABELS[brief.category]) {
      chips.push(CATEGORY_LABELS[brief.category]);
    }
    if (brief.targetAudienceAndTerritory) {
      chips.push(brief.targetAudienceAndTerritory.slice(0, 36));
    } else if (brief.users[0]?.text) {
      chips.push(brief.users[0].text.slice(0, 36));
    }
    if (brief.declaredTimeline && brief.declaredTimeline !== "Por definir") {
      chips.push(brief.declaredTimeline.slice(0, 32));
    }
    return chips;
  }, [brief]);

  async function submitTurn(answerText: string, displayLabel?: string, isSelection = false) {
    const clean = answerText.trim();
    if (!clean || isSendingTurn) return;

    setTurnError(null);
    setIsSendingTurn(true);

    const userDisplay = displayLabel || clean;
    const stepId = currentStep.id;
    const expectedRev = brief.revision;

    setMessages((prev) => [
      ...prev,
      {
        id: uid("usr"),
        role: "user",
        stage,
        stepId,
        text: userDisplay,
        createdAt: new Date().toISOString()
      }
    ]);
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
          if (data?.ok && data.question) turnResult = data;
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

      setLiveAnnouncement("Avanzaste al siguiente paso.");
      window.scrollTo({ top: 0, behavior: "smooth" });
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
        interpretation: "Tu ficha está lista para revisar y enviar.",
        text: sumQ.question,
        options: [],
        createdAt: new Date().toISOString()
      }
    ]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleResetDraft() {
    clearProjectDraft();
    const init = startGuidedSession("", null);
    setBrief(createEmptyBrief("", null, "development"));
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
  }

  function handleAddManualReq(e: React.FormEvent) {
    e.preventDefault();
    if (!newReqText.trim()) return;
    setBrief((prev) => addManualRequirement(prev, "requirements", newReqText, "initial"));
    setNewReqText("");
  }

  function handleDownloadMd() {
    downloadTextFile(buildSlugFilename(brief.title, "md"), briefToMarkdown(brief), "text/markdown;charset=utf-8");
    trackProjectEvent("enix_project_download", { track: brief.track, format: "md" });
  }

  function handleDownloadTxt() {
    downloadTextFile(buildSlugFilename(brief.title, "txt"), briefToPlainText(brief), "text/plain;charset=utf-8");
    trackProjectEvent("enix_project_download", { track: brief.track, format: "txt" });
  }

  async function handleCopyFullBrief() {
    try {
      await navigator.clipboard.writeText(briefToPlainText(brief));
      setCopiedFull(true);
      setLiveAnnouncement("Ficha completa copiada al portapapeles.");
      window.setTimeout(() => setCopiedFull(false), 2600);
    } catch {
      handleDownloadTxt();
    }
  }

  const mailtoPrepared = useMemo(
    () => prepareMailto(brief, siteConfig.contactEmail),
    [brief]
  );

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
        setSendState({ kind: "success", referenceId: data.referenceId, message: data.message });
      } else if (data?.code === "missing_mail_config") {
        setSendState({
          kind: "unconfigured",
          message: "Este entorno aún no tiene configurada RESEND_API_KEY. Puedes descargar tu resumen o abrirlo en tu correo."
        });
      } else {
        setSendState({
          kind: "error",
          message: data?.message || "No pudimos enviar tu ficha en este momento."
        });
      }
    } catch {
      setSendState({ kind: "error", message: "Error de conexión al intentar enviar. Tu borrador sigue guardado." });
    }
  }

  const renderRequirementList = (
    items: ProjectBrief["requirements"],
    bucket: RequirementBucket,
    showPriorityToggle = false
  ) => (
    <ul className="brief-req-list">
      {items.map((item) => (
        <li key={item.id} className={`brief-req-item ${item.status === "suggested" ? "is-suggested" : ""}`}>
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
                    toggleRequirementPriority(prev, bucket, item.id, item.priority === "later" ? "initial" : "later")
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

  const renderEditableBriefContent = (scope: "main" | "preview") => (
    <>
      <div className="brief-head-meta">
        <span className="eyebrow" style={{ paddingBlock: "0.22rem", fontSize: "0.72rem" }}>
          <span className="eyebrow-dot" aria-hidden="true" />
          Ficha editable · {TRACK_LABELS[brief.track || "development"]}
        </span>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }} className="no-print">
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyFullBrief}>
            <Copy size={13} aria-hidden="true" />
            <span>{copiedFull ? "¡Copiada!" : "Copiar íntegra"}</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadMd}>
            <Download size={13} aria-hidden="true" />
            <span>.md</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadTxt}>
            <FileText size={13} aria-hidden="true" />
            <span>.txt</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={13} aria-hidden="true" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      <div>
        <label htmlFor={`${scope}-title`} className="visually-hidden">
          Título provisional del proyecto
        </label>
        <input
          id={`${scope}-title`}
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
      </div>

      <div className="brief-section">
        <label htmlFor={`${scope}-goal`} className="brief-section-title">
          Objetivo principal (editable)
        </label>
        <textarea
          id={`${scope}-goal`}
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
      </div>

      <div className="brief-kv-grid">
        <div className="brief-kv" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label htmlFor={`${scope}-category`} style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
            {isMarketingOrCombined ? "Línea principal" : "Tipo de solución"}
          </label>
          <select
            id={`${scope}-category`}
            value={brief.category || "undetermined"}
            onChange={(e) => {
              manualFields.add("category");
              setBrief((prev) => ({
                ...prev,
                category: e.target.value,
                revision: prev.revision + 1,
                updatedAt: new Date().toISOString()
              }));
            }}
            style={{
              width: "100%",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "0.3rem 0.45rem",
              background: "var(--bg-surface)",
              fontSize: "0.78rem",
              fontWeight: 700
            }}
          >
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="brief-kv" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label htmlFor={`${scope}-timeline`} style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
            Expectativa de fechas / lanzamiento
          </label>
          <input
            id={`${scope}-timeline`}
            type="text"
            className="brief-add-input"
            value={brief.declaredTimeline || ""}
            placeholder="Por definir"
            onChange={(e) => {
              manualFields.add("declaredTimeline");
              setBrief((prev) => ({
                ...prev,
                declaredTimeline: e.target.value || null,
                revision: prev.revision + 1,
                updatedAt: new Date().toISOString()
              }));
            }}
          />
        </div>

        {isMarketingOrCombined && (
          <div className="brief-kv" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor={`${scope}-modality`} style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
              Modalidad de trabajo
            </label>
            <select
              id={`${scope}-modality`}
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
                padding: "0.3rem 0.45rem",
                background: "var(--bg-surface)",
                fontSize: "0.78rem",
                fontWeight: 700
              }}
            >
              <option value="undecided">{MODALITY_LABELS.undecided}</option>
              <option value="one-time">{MODALITY_LABELS["one-time"]}</option>
              <option value="one-time-then-ongoing">{MODALITY_LABELS["one-time-then-ongoing"]}</option>
              <option value="ongoing">{MODALITY_LABELS.ongoing}</option>
            </select>
          </div>
        )}

        {isMarketingOrCombined && (
          <div className="brief-kv" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor={`${scope}-audience`} style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
              Público y territorio
            </label>
            <input
              id={`${scope}-audience`}
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
        )}
      </div>

      {/* Situación actual / canales declarados (ENX-03: visible y editable igual que en exportación) */}
      {(brief.currentSituation || brief.existingChannelsAndAssets || isMarketingOrCombined) && (
        <div className="brief-kv" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label htmlFor={`${scope}-situation`} style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
            {isMarketingOrCombined ? "Canales y antecedentes declarados" : "Situación actual"}
          </label>
          <input
            id={`${scope}-situation`}
            type="text"
            className="brief-add-input"
            value={isMarketingOrCombined ? brief.existingChannelsAndAssets || brief.currentSituation : brief.currentSituation}
            placeholder="Por definir"
            onChange={(e) => {
              manualFields.add("currentSituation");
              manualFields.add("existingChannelsAndAssets");
              setBrief((prev) => ({
                ...prev,
                currentSituation: e.target.value,
                existingChannelsAndAssets: isMarketingOrCombined ? e.target.value : prev.existingChannelsAndAssets,
                revision: prev.revision + 1,
                updatedAt: new Date().toISOString()
              }));
            }}
          />
        </div>
      )}

      {isMarketingOrCombined && (
        <div className="brief-kv-grid">
          <div className="brief-kv" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor={`${scope}-ad-spend`} style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
              Inversión publicitaria (anuncios)
            </label>
            <input
              id={`${scope}-ad-spend`}
              type="text"
              className="brief-add-input"
              value={brief.adSpendBudget || ""}
              placeholder="Por definir (separado de honorarios)"
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
            <label htmlFor={`${scope}-service-budget`} style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
              Presupuesto de servicios (honorarios ENIX)
            </label>
            <input
              id={`${scope}-service-budget`}
              type="text"
              className="brief-add-input"
              value={brief.serviceBudget || ""}
              placeholder="Por definir según alcance"
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
      )}

      {brief.users.length > 0 && (
        <div className="brief-section">
          <h3 className="brief-section-title">Personas usuarias</h3>
          {renderRequirementList(brief.users, "users", false)}
        </div>
      )}

      <div className="brief-section">
        <h3 className="brief-section-title">Lo esencial para empezar</h3>
        {essentialRequirements.length > 0 ? (
          renderRequirementList(essentialRequirements, "requirements", true)
        ) : (
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            Aún no hay requisitos registrados.
          </p>
        )}

        <form className="brief-add-row no-print" onSubmit={handleAddManualReq}>
          <label htmlFor={`${scope}-add-req`} className="visually-hidden">
            Agregar requisito manual
          </label>
          <input
            id={`${scope}-add-req`}
            type="text"
            className="brief-add-input"
            placeholder="Agregar otro detalle o requisito…"
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
          <h3 className="brief-section-title">Para después</h3>
          {renderRequirementList(laterRequirements, "requirements", true)}
        </div>
      )}

      {brief.integrations.length > 0 && (
        <div className="brief-section">
          <h3 className="brief-section-title">Integraciones y herramientas</h3>
          {renderRequirementList(brief.integrations, "integrations", false)}
        </div>
      )}

      {brief.indicatorsToAgree && brief.indicatorsToAgree.length > 0 && (
        <div className="brief-section">
          <h3 className="brief-section-title">Indicadores por acordar</h3>
          {renderRequirementList(brief.indicatorsToAgree, "indicatorsToAgree", false)}
        </div>
      )}

      {brief.openQuestions.length > 0 && (
        <div className="brief-section">
          <h3 className="brief-section-title">Decisiones pendientes</h3>
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
    </>
  );

  return (
    <div className="ws-shell" id="espacio-proyecto">
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Minimal Header + Progress Bar */}
      <header className="ws-topbar no-print">
        <div className="ws-topbar-inner">
          <div className="ws-brand-group">
            <a href="/" aria-label="Volver a portada de ENIX Studio">
              <img src="/brand/enix-logo.png" alt="ENIX" width="1578" height="447" className="ws-logo-img" />
            </a>
            <span className="ws-divider" aria-hidden="true" />
            <span className="ws-title-pill">Definir mi proyecto</span>
          </div>

          <div className="ws-top-actions">
            {!isSummaryStep && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => previewDialogRef.current?.showModal()}
              >
                <Eye size={14} aria-hidden="true" />
                <span>Ver avance ({brief.requirements.length})</span>
              </button>
            )}
            <a href="/" className="btn btn-secondary btn-sm">
              <ArrowLeft size={14} aria-hidden="true" />
              <span>Portada</span>
            </a>
          </div>
        </div>

        <div
          className="ws-progress-track"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avance de la definición"
        >
          <div className="ws-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </header>

      {/* Single Centered Column */}
      <main className={`ws-main ${isSummaryStep ? "is-summary" : ""}`}>
        {!isSummaryStep ? (
          <div key={`${currentStep.id}-${stepIndex}`} className="step-stage-anim" style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
            {/* Compact Context Chips */}
            <div className="step-context-chips">
              <span className="context-chip is-step">
                Paso {Math.min(stepIndex + 1, activeSteps.length - 1)} de {activeSteps.length - 1} · {STAGE_LABELS[stage]}
              </span>
              {compactSummaryChips.map((chip) => (
                <span key={chip} className="context-chip">
                  ✓ {chip}
                </span>
              ))}
            </div>

            {/* Clean Focused Card */}
            <section className="step-card" aria-label="Paso actual del proyecto">
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
                <div className="step-cards-grid" role="group" aria-label="Opciones">
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
                  O escríbelo con tus propias palabras:
                </label>
                <div className="ws-composer-row">
                  <textarea
                    id={stepInputId}
                    rows={2}
                    maxLength={1000}
                    className="ws-input"
                    placeholder="Cuéntanos un poco más si ninguna opción encaja exacto…"
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
            </section>

            {/* Clean Footer Controls */}
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
                  <span>Reiniciar</span>
                </button>
              </div>

              <button type="button" className="ws-link-btn" onClick={handleJumpToSummary}>
                <span>Saltar al resumen y enviar →</span>
              </button>
            </div>
          </div>
        ) : (
          /* FINAL SCREEN: Editable Brief + Direct Submission */
          <div className="step-stage-anim" style={{ display: "flex", flexDirection: "column", gap: "1.35rem" }}>
            <div className="summary-banner no-print">
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--status-confirmed-ink)", fontWeight: 700, fontSize: "var(--text-xs)" }}>
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>¡Listo! Tu ficha de proyecto está armada</span>
              </div>
              <h1 className="step-question-title" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)" }}>
                Revisa tu resumen y envíalo a ENIX Studio
              </h1>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-secondary)", lineHeight: 1.55 }}>
                Puedes editar cualquier campo, confirmar o quitar las sugerencias en naranja, descargar el archivo o enviarlo ahora mismo para que nuestro equipo evalúe tu proyecto.
              </p>
            </div>

            {/* Direct Submit Card First or Right Below Brief */}
            <section className="summary-brief-card" aria-label="Ficha editable de proyecto">
              {renderEditableBriefContent("main")}
            </section>

            <section className="summary-submit-card no-print" aria-label="Enviar proyecto a ENIX Studio">
              <div>
                <h2 className="heading-md">Solicitar evaluación al equipo</h2>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)", marginTop: 4 }}>
                  {siteConfig.responsibilityStatement}
                </p>
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
                    <strong>¡Proyecto recibido ({sendState.referenceId})!</strong> {sendState.message}
                  </div>
                )}

                {sendState.kind === "unconfigured" && (
                  <div className="send-status-box is-info" role="status">
                    <p style={{ marginBottom: 8 }}>{sendState.message}</p>
                    <a href={mailtoPrepared.href} className="btn btn-secondary btn-sm">
                      {mailtoPrepared.isAbbreviated ? "Abrir correo (resumen breve)" : "Abrir correo con mi resumen"}
                    </a>
                  </div>
                )}

                {sendState.kind === "error" && (
                  <div className="composer-error" role="alert">
                    {sendState.message}
                  </div>
                )}

                <p style={{ fontSize: "0.75rem", color: "var(--ink-secondary)", lineHeight: 1.5 }}>
                  Usaremos tus datos únicamente para evaluar y responder esta solicitud de proyecto (no te suscribimos a listas de marketing). Consulta nuestra{" "}
                  <a href="/privacy/" style={{ color: "var(--accent-deep)", textDecoration: "underline", fontWeight: 600 }}>
                    política de privacidad y uso de datos
                  </a>
                  .
                </p>

                {mailtoPrepared.isAbbreviated && (
                  <p style={{ fontSize: "0.74rem", color: "var(--ink-muted)", lineHeight: 1.45 }}>
                    Nota: como tu ficha es extensa, el enlace «Abrir en correo» prepara un resumen breve para evitar cortes; si eliges correo manual, usa «Copiar íntegra» o descarga <code>.md</code>/<code>.txt</code> para adjuntarla completa.
                  </p>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleStepBack}>
                      <RotateCcw size={13} aria-hidden="true" />
                      <span>Ajustar respuestas</span>
                    </button>
                    <a href={mailtoPrepared.href} className="ws-link-btn">
                      <Mail size={13} aria-hidden="true" />
                      <span>{mailtoPrepared.isAbbreviated ? "Abrir resumen en correo" : "Abrir en correo"}</span>
                    </a>
                  </div>

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
                          ? "Proyecto enviado ✓"
                          : submissionConnected
                            ? "Enviar mi proyecto a ENIX Studio"
                            : "Solicitar evaluación"}
                    </span>
                  </button>
                </div>
              </form>
            </section>

            <div className="step-footer-nav no-print">
              <span style={{ fontSize: "0.74rem", color: "var(--ink-muted)" }}>
                Este documento resume tu alcance inicial; no constituye una propuesta cerrada ni contrato.
              </span>
              <button type="button" className="ws-link-btn" onClick={handleResetDraft}>
                <Trash2 size={13} aria-hidden="true" />
                <span>Empezar otro proyecto</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Optional On-Demand Preview Modal ("Ver avance") — only mounted during steps to prevent duplicate IDs (ENX-05) */}
      {!isSummaryStep && (
        <dialog
          ref={previewDialogRef}
          className="preview-dialog"
          aria-labelledby="preview-dialog-title"
          {...({ closedby: "any" } as Record<string, string>)}
        >
          <div className="preview-dialog-body">
            <div className="preview-dialog-head">
              <h2 id="preview-dialog-title" className="heading-md">
                Avance de tu ficha
              </h2>
              <form method="dialog">
                <button type="submit" className="mobile-close-btn" aria-label="Cerrar vista previa">
                  <X size={18} aria-hidden="true" />
                </button>
              </form>
            </div>

            {renderEditableBriefContent("preview")}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", paddingTop: "0.5rem" }}>
              <form method="dialog">
                <button type="submit" className="btn btn-secondary btn-sm">
                  Seguir respondiendo
                </button>
              </form>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  previewDialogRef.current?.close();
                  handleJumpToSummary();
                }}
              >
                Ir a enviar ficha →
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
