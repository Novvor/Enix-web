import { useEffect, useState } from "react";
import { Check, HelpCircle, PenLine, Send } from "lucide-react";
import type { ChatOption, SelectionMode } from "@/lib/project/schema";

interface QuickReplyPanelProps {
  messageId: string;
  options: ChatOption[];
  selectionMode?: SelectionMode;
  disabled?: boolean;
  onSelectValue: (value: string) => void;
  onRequestOther: () => void;
  onSpecialAction?: (action: "__open_submit__" | "__open_brief__") => void;
}

export default function QuickReplyPanel({
  messageId,
  options,
  selectionMode = "single",
  disabled = false,
  onSelectValue,
  onRequestOther,
  onSpecialAction
}: QuickReplyPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds([]);
  }, [messageId]);

  if (!options || options.length === 0) return null;

  const isMulti = selectionMode === "multi";

  function handleOptionClick(opt: ChatOption) {
    if (disabled) return;

    if (opt.value === "__open_submit__" || opt.value === "__open_brief__") {
      if (onSpecialAction) {
        onSpecialAction(opt.value);
      } else {
        window.location.href = "/create-project/";
      }
      return;
    }

    if (opt.value === "__other__" || opt.kind === "other") {
      onRequestOther();
      return;
    }

    if (opt.value === "__unsure__" || opt.kind === "unsure") {
      onSelectValue("No estoy seguro");
      return;
    }

    if (!isMulti) {
      onSelectValue(opt.value);
      return;
    }

    setSelectedIds((prev) =>
      prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
    );
  }

  function handleConfirmMulti() {
    if (disabled || selectedIds.length === 0) return;
    const chosen = options.filter((o) => selectedIds.includes(o.id));
    if (chosen.length === 0) return;
    const combined =
      chosen.length === 1
        ? chosen[0].value
        : `Me interesa priorizar: ${chosen.map((c) => c.label).join(", ")}.`;
    setSelectedIds([]);
    onSelectValue(combined);
  }

  return (
    <div className="qr-panel" role="group" aria-label="Opciones rápidas sugeridas por Steve">
      {isMulti && (
        <div className="qr-multi-hint">
          <span>Puedes elegir una o varias opciones:</span>
        </div>
      )}

      <div className="qr-grid">
        {options.slice(0, 5).map((opt) => {
          const isSpecial =
            opt.value === "__open_submit__" ||
            opt.value === "__open_brief__" ||
            opt.value === "__other__" ||
            opt.value === "__unsure__" ||
            opt.kind === "other" ||
            opt.kind === "unsure";
          const isChecked = isMulti && !isSpecial && selectedIds.includes(opt.id);
          const isPrimary = opt.kind === "primary" || opt.value === "__open_submit__";
          const isOther = opt.kind === "other" || opt.value === "__other__";
          const isUnsure = opt.kind === "unsure" || opt.value === "__unsure__";

          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              aria-pressed={isMulti && !isSpecial ? isChecked : undefined}
              className={[
                "qr-chip",
                isPrimary ? "is-primary" : "",
                isChecked ? "is-selected" : "",
                isOther ? "is-other" : "",
                isUnsure ? "is-unsure" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleOptionClick(opt)}
            >
              {isMulti && !isSpecial && (
                <span className={`qr-check ${isChecked ? "is-on" : ""}`} aria-hidden="true">
                  {isChecked && <Check size={11} strokeWidth={3} />}
                </span>
              )}
              {isOther && <PenLine size={13} aria-hidden="true" />}
              {isUnsure && <HelpCircle size={13} aria-hidden="true" />}
              <span className="qr-chip-label">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {isMulti && selectedIds.length > 0 && (
        <div className="qr-confirm-row">
          <button
            type="button"
            className="btn btn-primary btn-sm qr-confirm-btn"
            disabled={disabled}
            onClick={handleConfirmMulti}
          >
            <span>
              Enviar selección ({selectedIds.length})
            </span>
            <Send size={13} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
