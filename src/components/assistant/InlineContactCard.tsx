import React, { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Mail, Send } from "lucide-react";
import {
  declineInlineContact,
  isValidClientEmail,
  makeRequestId,
  submitInlineContact
} from "@/lib/project/assistant-client";
import type { ProjectDraft } from "@/lib/project/schema";

interface InlineContactCardProps {
  draft: ProjectDraft;
  sourcePage: string;
  prefilledEmail?: string | null;
  onDraftUpdated: (draft: ProjectDraft) => void;
  onContinueChat: () => void;
}

export default function InlineContactCard({
  draft,
  sourcePage,
  prefilledEmail = null,
  onDraftUpdated,
  onContinueChat
}: InlineContactCardProps) {
  const lead = draft.leadCapture;
  const [email, setEmail] = useState(prefilledEmail || lead?.capturedEmail || "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedMsg, setConfirmedMsg] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string>(makeRequestId());
  const emailInputId = useId();

  useEffect(() => {
    const incoming = prefilledEmail || lead?.capturedEmail || "";
    if (incoming && !email) {
      setEmail(incoming);
    }
  }, [prefilledEmail, lead?.capturedEmail]);

  if (lead?.status === "submitted") {
    return (
      <div className="inline-contact-card is-confirmed" role="status" aria-live="polite">
        <div className="inline-contact-ok">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div>
            <strong>Solicitud enviada al equipo de ENIX</strong>
            <p style={{ margin: "0.2rem 0 0" }}>
              {confirmedMsg ||
                `Recibimos tu solicitud con ${lead.capturedEmail || "tu correo"}${lead.referenceId ? ` (referencia ${lead.referenceId})` : ""}. Puedes seguir conversando o ajustar detalles aquí.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (lead?.status === "declined") {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const clean = email.trim();
    if (!isValidClientEmail(clean)) {
      setErrorMsg("Ingresa un correo electrónico válido (personal o de empresa).");
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await submitInlineContact({
        email: clean,
        draft,
        sourcePage,
        idempotencyKey: idempotencyKeyRef.current
      });

      if (!res.ok) {
        setErrorMsg(res.message);
      } else {
        setConfirmedMsg(res.message);
        onDraftUpdated(res.draft);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleDecline() {
    const updated = declineInlineContact(draft);
    onDraftUpdated(updated);
    onContinueChat();
  }

  return (
    <form className="inline-contact-card" onSubmit={handleSubmit} noValidate>
      <div className="inline-contact-head">
        <Mail size={16} aria-hidden="true" />
        <span>
          {prefilledEmail
            ? "Confirma el envío al equipo de ENIX con tu correo:"
            : "¿A qué correo puede escribirte el equipo de ENIX para evaluar esta primera versión?"}
        </span>
      </div>

      <div className="inline-contact-row">
        <label htmlFor={emailInputId} className="visually-hidden">
          Correo electrónico para que el equipo de ENIX te escriba
        </label>
        <input
          id={emailInputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          className="inline-contact-input"
          placeholder="tu@correo.com (personal o de empresa)"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errorMsg) setErrorMsg(null);
          }}
          disabled={submitting}
          required
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm inline-contact-submit"
          disabled={submitting}
        >
          <span>{submitting ? "Enviando…" : "Pedir que me contacten"}</span>
          <Send size={13} aria-hidden="true" />
        </button>
      </div>

      {errorMsg && (
        <div className="inline-contact-error" role="alert">
          {errorMsg}
        </div>
      )}

      <div className="inline-contact-foot">
        <p className="inline-contact-note">
          Enviaremos tu correo y el resumen actual del proyecto al equipo de ENIX solo para responder esta consulta (sin suscribirte a marketing).
        </p>
        <button
          type="button"
          className="inline-contact-skip"
          onClick={handleDecline}
          disabled={submitting}
        >
          Seguir conversando
        </button>
      </div>
    </form>
  );
}
