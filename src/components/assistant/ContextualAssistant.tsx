import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ExternalLink, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { getPageContext, normalizePageId } from "@/lib/project/catalog";
import { ENIXMascot, ENIX_MOOD, type ENIXMood } from "@/components/mascot/ENIXMascot";
import { EnixMascotAnimatedSvg } from "@/components/mascot/EnixMascotAnimatedSvg";
import {
  ASSISTANT_OPEN_EVENT,
  CHAT_ACTIVE_EVENT,
  getContextualHintState,
  notifyChatActiveState,
  setContextualHintState,
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

interface ContextualAssistantProps {
  currentPath: string;
  hasRiveAsset?: boolean;
}

export default function ContextualAssistant({
  currentPath,
  hasRiveAsset = false
}: ContextualAssistantProps) {
  const safePageId = normalizePageId(currentPath);
  const isHome = safePageId === "/";
  const pageCtx = getPageContext(safePageId);

  const [isOpen, setIsOpen] = useState(false);
  // On Home, appear only after scrolling past the Hero composer
  const [heroInView, setHeroInView] = useState(isHome);
  const [showHintBubble, setShowHintBubble] = useState(false);
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [barText, setBarText] = useState("");
  const [inputText, setInputText] = useState("");
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [assistantMode, setAssistantMode] = useState<"ai" | "guided" | null>(null);
  const [isGreeting, setIsGreeting] = useState(false);

  const threadRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const barInputRef = useRef<HTMLInputElement | null>(null);
  const isNearBottomRef = useRef(true);
  const drawerTitleId = useId();
  const inputId = useId();
  const barInputId = useId();

  useEffect(() => {
    setDraft(getOrInitDraft(pageCtx.categoryHint));

    const unsub = subscribeDraftChanges((updated) => {
      setDraft(updated || getOrInitDraft(pageCtx.categoryHint));
    });

    // On Home, watch [data-hero-composer] visibility so the floating bar appears only when scrolling past it
    let heroObserver: IntersectionObserver | null = null;
    if (isHome) {
      const heroEl = document.querySelector("[data-hero-composer]");
      if (heroEl && "IntersectionObserver" in window) {
        heroObserver = new IntersectionObserver(
          ([entry]) => {
            setHeroInView(Boolean(entry?.isIntersecting));
          },
          { threshold: 0.08 }
        );
        heroObserver.observe(heroEl);
      } else {
        const onScroll = () => setHeroInView(window.scrollY < 460);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
          unsub();
          window.removeEventListener("scroll", onScroll);
        };
      }
    }

    const onOpenReq = (ev: Event) => {
      if (isHome && heroInView) return;
      const detail = (ev as CustomEvent<AssistantOpenDetail>).detail || {};
      setIsOpen(true);
      if (detail.promptText) {
        setInputText((cur) => {
          if (cur.trim()) {
            setPendingPrompt(detail.promptText || null);
            return cur;
          }
          return detail.promptText || "";
        });
      }
    };

    window.addEventListener(ASSISTANT_OPEN_EVENT, onOpenReq);

    // Show at most 1 discrete static contextual hint per session on inner pages (ZERO AI calls)
    let hintTimer: number | undefined;
    if (!isHome) {
      const hintState = getContextualHintState();
      if (!hintState.shown && !hintState.dismissed) {
        hintTimer = window.setTimeout(() => {
          setShowHintBubble(true);
          setContextualHintState({ shown: true });
        }, 3200);
      }
    }

    return () => {
      unsub();
      heroObserver?.disconnect();
      window.removeEventListener(ASSISTANT_OPEN_EVENT, onOpenReq);
      if (hintTimer) window.clearTimeout(hintTimer);
    };
  }, [isHome, pageCtx.categoryHint]);

  useEffect(() => {
    notifyChatActiveState(isOpen, "drawer");
    if (isOpen) {
      setShowHintBubble(false);
      setIsGreeting(true);
      const greetTimer = window.setTimeout(() => setIsGreeting(false), 1400);
      setTimeout(() => textareaRef.current?.focus(), 60);
      return () => window.clearTimeout(greetTimer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        barInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el || !isNearBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [draft?.messages.length, isSending, isOpen]);

  function handleDismissHint() {
    setShowHintBubble(false);
    setContextualHintState({ shown: true, dismissed: true });
  }

  function handleSelectQuickPrompt(prompt: string) {
    if (inputText.trim() && inputText.trim() !== prompt.trim()) {
      setPendingPrompt(prompt);
      return;
    }
    setInputText(prompt);
    setPendingPrompt(null);
    textareaRef.current?.focus();
  }

  async function handleSend(textToSend: string, isSelection = false) {
    const clean = textToSend.trim();
    if (clean.length < 4) {
      setErrorMsg("Escribe una breve pregunta o idea para ayudarte.");
      textareaRef.current?.focus();
      return;
    }
    if (clean.length > MAX_CLIENT_MESSAGE_CHARS) {
      setErrorMsg(`El mensaje supera el máximo de ${MAX_CLIENT_MESSAGE_CHARS} caracteres.`);
      return;
    }
    if (isSending) return;

    setErrorMsg(null);
    setPendingPrompt(null);
    setIsSending(true);
    isNearBottomRef.current = true;

    const activeDraft = draft || getOrInitDraft(pageCtx.categoryHint);
    try {
      const result = await sendCommercialMessage({
        text: clean,
        pageId: safePageId,
        currentDraft: activeDraft,
        categoryHint: pageCtx.categoryHint,
        isSelection,
        requestId: makeRequestId()
      });

      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setDraft(result.draft);
        setAssistantMode(result.response.mode);
        setInputText("");
        setBarText("");
      }
    } finally {
      setIsSending(false);
    }
  }

  function handleFloatingBarSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = barText.trim();
    setIsOpen(true);
    if (clean.length >= 4) {
      setBarText("");
      void handleSend(clean, false);
    } else if (clean.length > 0) {
      setInputText(clean);
      setBarText("");
    }
  }

  // Hide floating bar on Home while Hero composer is visible in viewport (never duplicate on Home)
  if (isHome && heroInView && !isOpen) {
    return null;
  }

  const messages = draft?.messages || [];

  const mascotMood: ENIXMood = isSending
    ? ENIX_MOOD.thinking
    : errorMsg
      ? ENIX_MOOD.error
      : isGreeting || showHintBubble
        ? ENIX_MOOD.greeting
        : barText.trim().length > 0 || inputText.trim().length > 0
          ? ENIX_MOOD.attentive
          : isOpen && messages.length > 0
            ? ENIX_MOOD.ready
            : isOpen
              ? ENIX_MOOD.attentive
              : ENIX_MOOD.idle;

  return (
    <>
      {!isOpen && (
        <div className="ctx-assistant-root no-print" data-contextual-assistant>
          {showHintBubble && (
            <div className="ctx-hint-bubble" role="status">
              <div className="ctx-hint-head">
                <span>Asesor de ENIX Studio</span>
                <button
                  type="button"
                  className="ctx-hint-close"
                  onClick={handleDismissHint}
                  aria-label="Cerrar sugerencia"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              <p style={{ margin: 0 }}>{pageCtx.hint}</p>
            </div>
          )}

          <form
            className="ctx-search-dock"
            onSubmit={handleFloatingBarSubmit}
            role="search"
            aria-label="Preguntar al asesor comercial de ENIX Studio"
          >
            <button
              type="button"
              className="ctx-dock-mascot-btn"
              onClick={() => setIsOpen(true)}
              aria-label="Abrir panel del asesor comercial de ENIX Studio"
            >
              <ENIXMascot
                src="/brand/enix-mascot-rive.riv"
                fallbackSvg={<EnixMascotAnimatedSvg mood={mascotMood} />}
                mood={mascotMood}
                paused={!hasRiveAsset}
                size={76}
              />
              {messages.length > 0 && (
                <span className="ctx-dock-badge" aria-label={`${messages.length} mensajes`}>
                  {messages.length}
                </span>
              )}
            </button>

            <div className="ctx-dock-field">
              <label htmlFor={barInputId} className="visually-hidden">
                Escribe tu idea o consulta al asesor de ENIX Studio
              </label>
              <input
                ref={barInputRef}
                id={barInputId}
                type="text"
                className="ctx-dock-input"
                placeholder={
                  messages.length > 0
                    ? "Continuar conversación…"
                    : "Pregúntale al asesor de ENIX…"
                }
                value={barText}
                onChange={(e) => setBarText(e.target.value)}
                maxLength={MAX_CLIENT_MESSAGE_CHARS}
              />
            </div>

            <button
              type="submit"
              className="ctx-dock-send"
              aria-label={barText.trim() ? "Enviar consulta" : "Abrir asesor"}
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      )}

      {isOpen && (
        <div
          className="ctx-drawer-backdrop no-print"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
              barInputRef.current?.focus();
            }
          }}
        >
          <aside
            className="ctx-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby={drawerTitleId}
          >
            <div className="ctx-drawer-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                <ENIXMascot
                  src="/brand/enix-mascot-rive.riv"
                  fallbackSvg={<EnixMascotAnimatedSvg mood={mascotMood} />}
                  mood={mascotMood}
                  paused={!hasRiveAsset || !isOpen}
                  size={62}
                />
                <div className="ctx-drawer-title-group">
                  <h2 id={drawerTitleId} className="ctx-drawer-title">
                    Asesor comercial de ENIX
                  </h2>
                  <span className="ctx-drawer-subtitle">
                    {assistantMode === "ai"
                      ? "IA activa"
                      : assistantMode === "guided"
                        ? "Modo guiado"
                        : `Contexto: ${pageCtx.pageTitle}`}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <a href="/create-project/" className="btn btn-primary btn-sm">
                  Mi proyecto
                  <ArrowRight size={13} aria-hidden="true" />
                </a>
                <button
                  type="button"
                  className="ctx-hint-close"
                  onClick={() => {
                    setIsOpen(false);
                    barInputRef.current?.focus();
                  }}
                  aria-label="Cerrar panel del asesor"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div
              ref={threadRef}
              className="ctx-drawer-body"
              onScroll={() => {
                const el = threadRef.current;
                if (!el) return;
                isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
              role="log"
              aria-live="polite"
            >
              <div className="ctx-page-context-card">
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, color: "var(--accent-deep)" }}>
                  <Sparkles size={13} aria-hidden="true" />
                  <span>{pageCtx.pageTitle}</span>
                </div>
                <p style={{ margin: 0, lineHeight: 1.5 }}>{pageCtx.hint}</p>

                {messages.length === 0 && pageCtx.quickPrompts.length > 0 && (
                  <div className="chat-quick-replies">
                    {pageCtx.quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="chat-quick-btn"
                        onClick={() => handleSelectQuickPrompt(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-bubble-row ${msg.role === "user" ? "is-user" : "is-assistant"}`}
                >
                  <div className="chat-bubble">{msg.text}</div>
                  {msg.role === "assistant" && msg.links && msg.links.length > 0 && (
                    <div className="chat-bubble-links">
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
                    <span>Revisando tu consulta…</span>
                  </div>
                </div>
              )}
            </div>

            <form
              className="ctx-drawer-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend(inputText, false);
              }}
            >
              {pendingPrompt && (
                <div className="hero-replace-bar">
                  <span>¿Reemplazar tu texto actual por esta sugerencia?</span>
                  <div className="hero-replace-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setInputText(pendingPrompt);
                        setPendingPrompt(null);
                        textareaRef.current?.focus();
                      }}
                    >
                      Reemplazar
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setPendingPrompt(null)}
                    >
                      Conservar
                    </button>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="hero-chat-error" role="alert">
                  <span>{errorMsg}</span>
                </div>
              )}

              <label htmlFor={inputId} className="visually-hidden">
                Escribe tu consulta para el asesor de ENIX Studio
              </label>
              <div className="ctx-drawer-input-row">
                <textarea
                  ref={textareaRef}
                  id={inputId}
                  rows={2}
                  maxLength={MAX_CLIENT_MESSAGE_CHARS + 100}
                  className="ctx-drawer-textarea"
                  placeholder="Pregúntame sobre este servicio o cuéntame tu caso…"
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend(inputText, false);
                    }
                  }}
                  disabled={isSending}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ minBlockSize: "46px", paddingInline: "0.95rem" }}
                  disabled={isSending}
                  aria-label="Enviar mensaje"
                >
                  <Send size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="ctx-drawer-footer-bar">
                <span>
                  <MessageSquare size={11} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: "4px" }} aria-hidden="true" />
                  Misma conversación que en /create-project/
                </span>
                <a href="/privacy/" style={{ color: "var(--accent-deep)", fontWeight: 600 }}>
                  Privacidad
                </a>
              </div>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
