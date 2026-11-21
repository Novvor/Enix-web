import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ExternalLink, RotateCcw, Send, Sparkles } from "lucide-react";
import { heroExampleChips, siteConfig } from "@/content/site";
import { ENIXMascot, ENIX_MOOD, type ENIXMood } from "@/components/mascot/ENIXMascot";
import { EnixMascotAnimatedSvg } from "@/components/mascot/EnixMascotAnimatedSvg";
import {
  ASSISTANT_OPEN_EVENT,
  clearProjectDraft,
  notifyChatActiveState,
  subscribeDraftChanges,
  type AssistantOpenDetail
} from "@/lib/project/storage";
import {
  MAX_CLIENT_MESSAGE_CHARS,
  getOrInitDraft,
  makeRequestId,
  sendCommercialMessage
} from "@/lib/project/assistant-client";
import type { ProjectDraft } from "@/lib/project/schema";
import "./assistant.css";

const HERO_TOOLTIP_MESSAGES = [
  "¿Te ayudo?",
  "¡Comencemos un proyecto!",
  "Cuéntame tu idea y la ordenamos juntos",
  "¿Web, app, sistema o marketing? Te guío",
  "Sin registro, directo al grano"
];

interface HomeHeroChatProps {
  hasRiveAsset?: boolean;
}

export default function HomeHeroChat({ hasRiveAsset = false }: HomeHeroChatProps) {
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [inputText, setInputText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [lastAppliedChipPrompt, setLastAppliedChipPrompt] = useState("");
  const [pendingChip, setPendingChip] = useState<{ prompt: string; category: string | null } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [assistantMode, setAssistantMode] = useState<"ai" | "guided" | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [isGreeting, setIsGreeting] = useState(false);
  const [tooltipIndex, setTooltipIndex] = useState(0);
  // Start Hero clean on page load; expand inline only after user sends or clicks "Retomar conversación"
  const [threadExpanded, setThreadExpanded] = useState(false);
  const greetedOnceRef = useRef(false);

  const threadRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

  const inputId = useId();
  const errorId = useId();
  const hintId = useId();

  useEffect(() => {
    const initial = getOrInitDraft();
    setDraft(initial);
    if (initial.unsentText) {
      setInputText(initial.unsentText);
    }

    const unsub = subscribeDraftChanges((updated) => {
      if (updated) {
        setDraft(updated);
      } else {
        setDraft(getOrInitDraft());
      }
    });

    // Listen to "Hablemos de esto" from RotatingServices on Home (no auto-send, no overwrite)
    const onOpenRequest = (ev: Event) => {
      const detail = (ev as CustomEvent<AssistantOpenDetail>).detail || {};
      const incomingPrompt = (detail.promptText || "").trim();
      const incomingCat = detail.category ?? null;

      wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

      if (incomingPrompt) {
        setInputText((current) => {
          const trimmed = current.trim();
          if (trimmed && trimmed !== lastAppliedChipPrompt.trim()) {
            setPendingChip({ prompt: incomingPrompt, category: incomingCat });
            return current;
          }
          setLastAppliedChipPrompt(incomingPrompt);
          setSelectedCategory(incomingCat);
          setPendingChip(null);
          return incomingPrompt;
        });
      }
      setTimeout(() => textareaRef.current?.focus(), 200);
    };

    window.addEventListener(ASSISTANT_OPEN_EVENT, onOpenRequest);
    return () => {
      unsub();
      window.removeEventListener(ASSISTANT_OPEN_EVENT, onOpenRequest);
    };
  }, [lastAppliedChipPrompt]);

  const hasSavedConversation = Boolean(draft && draft.messages.length > 0);
  const hasConversation = hasSavedConversation && threadExpanded;

  useEffect(() => {
    if (hasConversation) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setTooltipIndex((prev) => (prev + 1) % HERO_TOOLTIP_MESSAGES.length);
    }, 3800);
    return () => window.clearInterval(id);
  }, [hasConversation]);

  useEffect(() => {
    notifyChatActiveState(hasConversation || isSending, "hero");
  }, [hasConversation, isSending]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    if (isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [draft?.messages.length, isSending]);

  function handleThreadScroll() {
    const el = threadRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 80;
  }

  function applyChip(prompt: string, category: string | null) {
    setInputText(prompt);
    setLastAppliedChipPrompt(prompt);
    setSelectedCategory(category);
    setPendingChip(null);
    setErrorMsg(null);
    textareaRef.current?.focus();
  }

  function handleChipClick(prompt: string, category: string | null) {
    const current = inputText.trim();
    if (current && current !== lastAppliedChipPrompt.trim()) {
      setPendingChip({ prompt, category });
      return;
    }
    applyChip(prompt, category);
  }

  async function handleSubmitText(textToSend: string, isSelection = false, reuseReqId?: string) {
    const clean = textToSend.trim();
    if (clean.length < 4) {
      setErrorMsg("Cuéntanos en una frase qué tienes en mente o elige uno de los ejemplos.");
      textareaRef.current?.focus();
      return;
    }
    if (clean.length > MAX_CLIENT_MESSAGE_CHARS) {
      setErrorMsg(
        `Tu mensaje supera el máximo de ${MAX_CLIENT_MESSAGE_CHARS} caracteres. Acórtalo un poco para enviarlo.`
      );
      textareaRef.current?.focus();
      return;
    }
    if (isSending) return;

    setErrorMsg(null);
    setPendingChip(null);
    setThreadExpanded(true);
    setIsSending(true);
    isNearBottomRef.current = true;

    const reqId = reuseReqId || makeRequestId();
    setLastRequestId(reqId);
    setLastFailedText(clean);

    const activeDraft = draft || getOrInitDraft(selectedCategory);

    try {
      const result = await sendCommercialMessage({
        text: clean,
        pageId: "/",
        currentDraft: activeDraft,
        categoryHint: selectedCategory,
        isSelection,
        requestId: reqId
      });

      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setDraft(result.draft);
        setAssistantMode(result.response.mode);
        setInputText("");
        setLastAppliedChipPrompt("");
        setLastFailedText(null);
        setLastRequestId(null);
      }
    } finally {
      setIsSending(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    void handleSubmitText(inputText, false);
  }

  function handleReset() {
    clearProjectDraft();
    setDraft(getOrInitDraft());
    setThreadExpanded(false);
    setInputText("");
    setSelectedCategory(null);
    setLastAppliedChipPrompt("");
    setPendingChip(null);
    setErrorMsg(null);
    textareaRef.current?.focus();
  }

  const latestAssistant = draft?.messages
    ? [...draft.messages].reverse().find((m) => m.role === "assistant")
    : undefined;

  const mascotMood: ENIXMood = isSending
    ? ENIX_MOOD.thinking
    : errorMsg
      ? ENIX_MOOD.error
      : isGreeting
        ? ENIX_MOOD.greeting
        : inputText.trim().length > 0
          ? ENIX_MOOD.attentive
          : hasConversation
            ? ENIX_MOOD.ready
            : ENIX_MOOD.idle;

  function triggerGreetingOnce() {
    if (greetedOnceRef.current || hasConversation) return;
    greetedOnceRef.current = true;
    setIsGreeting(true);
    window.setTimeout(() => setIsGreeting(false), 1400);
  }

  const activeTooltipText = isSending
    ? "Pensando la mejor opción para tu caso…"
    : errorMsg
      ? "Ups, revisa este detalle y lo intentamos de nuevo"
      : inputText.trim().length > 0
        ? "¡Te escucho! Pulsa Enter cuando estés listo"
        : hasConversation
          ? "¡Listo! Seguimos afinando tu proyecto"
          : HERO_TOOLTIP_MESSAGES[tooltipIndex];

  return (
    <div className="hero-chat-wrap fade-up" ref={wrapRef} data-hero-composer>
      <div className="hero-mascot-spotlight">
        <div className="hero-mascot-hero-figure" aria-hidden="true">
          <ENIXMascot
            src="/brand/enix-mascot-rive.riv"
            fallbackSvg={<EnixMascotAnimatedSvg mood={mascotMood} />}
            mood={mascotMood}
            paused={!hasRiveAsset}
            size={108}
          />
        </div>

        <div className="hero-mascot-tooltip-wrap">
          <div key={activeTooltipText} className="hero-mascot-tooltip" role="status" aria-live="polite">
            <Sparkles size={14} className="hero-tooltip-icon" aria-hidden="true" />
            <span>{activeTooltipText}</span>
          </div>

          {hasConversation ? (
            <div className="hero-chat-actions-inline">
              <a href="/create-project/" className="btn btn-primary btn-sm">
                Abrir mi proyecto
                <ArrowRight size={14} aria-hidden="true" />
              </a>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleReset}
                title="Empezar una conversación nueva"
              >
                <RotateCcw size={13} aria-hidden="true" />
                <span>Nueva</span>
              </button>
            </div>
          ) : hasSavedConversation ? (
            <div className="hero-chat-actions-inline">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setThreadExpanded(true)}
              >
                Retomar borrador
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleReset}
                title="Limpiar borrador anterior"
              >
                <RotateCcw size={13} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="hero-chat-card" data-assistant-mode={assistantMode || "ready"}>

        {hasConversation && draft && (
          <div
            ref={threadRef}
            className="hero-thread"
            onScroll={handleThreadScroll}
            role="log"
            aria-live="polite"
            aria-label="Conversación con el asesor de ENIX Studio"
          >
            {draft.messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble-row ${msg.role === "user" ? "is-user" : "is-assistant"}`}
              >
                <div className="chat-bubble">{msg.text}</div>

                {msg.role === "assistant" && msg.links && msg.links.length > 0 && (
                  <div className="chat-bubble-links">
                    <a href="/create-project/" className="chat-link-chip is-primary">
                      Abrir mi proyecto →
                    </a>
                    {msg.links.map((link) => (
                      <a key={`${msg.id}-${link.href}`} href={link.href} className="chat-link-chip">
                        <span>{link.label}</span>
                        <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="chat-bubble-row is-assistant">
                <div className="chat-typing" role="status">
                  <span>Pensando la mejor recomendación para tu caso…</span>
                </div>
              </div>
            )}
          </div>
        )}

        {hasConversation && latestAssistant?.options && latestAssistant.options.length > 0 && !isSending && (
          <div className="chat-quick-replies" role="group" aria-label="Respuestas rápidas">
            {latestAssistant.options.slice(0, 3).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="chat-quick-btn"
                onClick={() => {
                  if (opt.value === "__open_submit__" || opt.value === "__open_brief__") {
                    window.location.href = "/create-project/";
                    return;
                  }
                  void handleSubmitText(opt.value, true);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleFormSubmit} noValidate>
          <label htmlFor={inputId} className="visually-hidden">
            Cuéntanos tu idea o pregunta sobre tu proyecto digital
          </label>

          <textarea
            ref={textareaRef}
            id={inputId}
            name="idea"
            rows={hasConversation ? 2 : 3}
            maxLength={MAX_CLIENT_MESSAGE_CHARS + 100}
            className={`hero-chat-textarea ${hasConversation ? "is-compact" : ""}`}
            placeholder={
              hasConversation
                ? "Responde aquí, cambia de tema o pregúntanos lo que necesites…"
                : "Cuéntame qué negocio tienes o qué te gustaría lograr. Ej: «Tengo una peluquería y recibo reservas por WhatsApp, ¿qué recomiendas para empezar?»"
            }
            value={inputText}
            onFocus={triggerGreetingOnce}
            onChange={(e) => {
              setInputText(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmitText(inputText, false);
              }
            }}
            aria-describedby={`${hintId} ${errorId}`}
            aria-invalid={Boolean(errorMsg)}
            disabled={isSending}
          />

          {errorMsg && (
            <div id={errorId} className="hero-chat-error" role="alert">
              <span>{errorMsg}</span>
              {lastFailedText && lastRequestId && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void handleSubmitText(lastFailedText, false, lastRequestId)}
                >
                  Reintentar
                </button>
              )}
            </div>
          )}

          {pendingChip && (
            <div className="hero-replace-bar" role="region" aria-label="Confirmar reemplazo de texto">
              <span>Ya escribiste tu propio texto. ¿Quieres reemplazarlo con esta sugerencia?</span>
              <div className="hero-replace-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => applyChip(pendingChip.prompt, pendingChip.category)}
                >
                  Reemplazar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setPendingChip(null);
                    textareaRef.current?.focus();
                  }}
                >
                  Conservar mi texto
                </button>
              </div>
            </div>
          )}

          <div className="hero-chat-footer">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <p id={hintId} className="composer-micro" style={{ margin: 0 }}>
                <span>Empieza sin registrarte · Responde directo aquí.</span>
              </p>
              {inputText.length > 1400 && (
                <span
                  className={`char-counter ${inputText.length > MAX_CLIENT_MESSAGE_CHARS ? "is-warn" : ""}`}
                >
                  {inputText.length}/{MAX_CLIENT_MESSAGE_CHARS}
                </span>
              )}
            </div>

            <button type="submit" className="btn btn-primary composer-submit" disabled={isSending}>
              <span>{hasConversation ? "Enviar" : "Conversar con el asesor"}</span>
              <Send size={15} aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>

      {!hasConversation && (
        <div className="composer-examples" role="group" aria-label="Ejemplos rápidos para empezar">
          <span className="composer-examples-label">Ejemplos:</span>
          <div className="composer-chips">
            {heroExampleChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className="example-chip"
                onClick={() => handleChipClick(chip.prompt, chip.category)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="hero-chat-privacy-note">
        {siteConfig.responsibilityStatement} Tu borrador queda en este navegador; cuando la IA está activa, tus mensajes se procesan para responderte y solo llegan al equipo de ENIX si decides enviarnos tu proyecto.{" "}
        <a href="/privacy/">Ver privacidad</a>.
      </p>
    </div>
  );
}
