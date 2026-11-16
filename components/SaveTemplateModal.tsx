"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BookmarkPlus, X, Save, Pill, Check, FileText } from "lucide-react";
import { useTemplateMutations } from "@/lib/hooks/useQueries";
import { toast } from "./Toast";
import { getErrorMessage } from "@/lib/utils/error";
import type { PrescribedMedicine, Template } from "@/lib/providers/types";
import { DoseDisplay } from "./DoseSelector";

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  initialDiagnosis?: string;
  initialNotes?: string;
  medicines: PrescribedMedicine[];
  onSuccess?: (newTemplate: Template) => void;
}

export default function SaveTemplateModal({
  isOpen,
  onClose,
  initialName = "",
  initialDiagnosis = "",
  initialNotes = "",
  medicines,
  onSuccess,
}: SaveTemplateModalProps) {
  const [mounted, setMounted] = useState(false);
  const { create: createTemplateMut } = useTemplateMutations();

  const [name, setName] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const defaultName = initialName
        ? initialName
        : initialDiagnosis
        ? `${initialDiagnosis.trim()} Protocol`
        : "";
      setName(defaultName);
      setDiagnosis(initialDiagnosis || "");
      setNotes(initialNotes || "");
      setError(null);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, initialName, initialDiagnosis, initialNotes]);

  if (!mounted || !isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please provide a name for this template.");
      return;
    }
    if (!medicines || medicines.length === 0) {
      setError("No medicines selected to save in this template.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: trimmedName,
        diagnosis: diagnosis.trim(),
        notes: notes.trim(),
        medicines: medicines.map((m) => ({
          medicineId: m.medicineId,
          name: m.name || "",
          category: m.category || "Other",
          strength: m.strength || "",
          unit: m.unit || "Tablet",
          dose: m.dose || "1-0-1",
          duration: m.duration || "5 days",
          instructions: m.instructions || "",
          instructionKeys: m.instructionKeys || [],
          customInstruction: m.customInstruction || m.instructions || "",
          instructionLangs: m.instructionLangs || ["en", "hi"],
        })),
      };

      const created = await createTemplateMut.mutateAsync(payload);
      toast(`Template "${trimmedName}" saved successfully!`, "success");
      onSuccess?.(created as Template);
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to save template.");
      setError(msg);
      toast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0, 0, 0, 0.55)",
          backdropFilter: "blur(6px)",
          padding: 16,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSubmitting) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          style={{
            background: "var(--surface-solid, #ffffff)",
            color: "var(--text-primary)",
            borderRadius: 16,
            maxWidth: 580,
            width: "100%",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            border: "1px solid var(--border)",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--surface-card, #ffffff)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--accent-glow, rgba(13, 148, 136, 0.12))",
                  color: "var(--accent, #0d9488)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BookmarkPlus size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
                  Save Prescription Template
                </h3>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Store currently selected medicines as a 1-click reusable template
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ color: "var(--text-muted)" }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              padding: "18px 20px",
              overflowY: "auto",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Notice / Count badge */}
            <div
              style={{
                background: "rgba(13, 148, 136, 0.08)",
                border: "1px solid rgba(13, 148, 136, 0.25)",
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem" }}>
                <Pill size={16} style={{ color: "var(--accent)" }} />
                <span>
                  <strong>{medicines.length}</strong> medicine{medicines.length === 1 ? "" : "s"} will be stored in this template.
                </span>
              </div>
              <span className="badge badge-teal" style={{ fontSize: "0.72rem" }}>
                Ready to Save
              </span>
            </div>

            {error && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid #ef4444",
                  borderRadius: 8,
                  padding: "8px 12px",
                  color: "#ef4444",
                  fontSize: "0.82rem",
                }}
              >
                {error}
              </div>
            )}

            {/* Template Form */}
            <form id="save-template-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: "0.84rem" }}>
                  Template Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Viral Fever 3-Day Protocol, Hypertension Starter"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: "0.84rem" }}>
                  Diagnosis / Indication (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acute Viral Fever, Gastritis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: "0.84rem" }}>
                  Advice &amp; Instructions (Optional)
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Dietary instructions, precautions, lifestyle advice..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>
            </form>

            {/* Configured Medicines Preview List */}
            <div>
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "var(--text-muted)",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Included Medicines ({medicines.length})</span>
                <span style={{ fontSize: "0.72rem", textTransform: "none", color: "var(--text-secondary)" }}>
                  Dose · Duration · Instruction
                </span>
              </div>

              <div
                style={{
                  maxHeight: 180,
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  background: "var(--surface-1, #f9fafb)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {medicines.map((m, idx) => (
                  <div
                    key={`${m.name}-${idx}`}
                    style={{
                      padding: "8px 12px",
                      borderBottom: idx < medicines.length - 1 ? "1px solid var(--border)" : "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      fontSize: "0.82rem",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {m.name}
                        {m.strength ? ` (${m.strength})` : ""}
                      </div>
                      {m.instructions && (
                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 1 }}>
                          {m.instructions}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      {m.dose && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "var(--accent-glow, rgba(13,148,136,0.1))",
                            color: "var(--accent, #0d9488)",
                            fontWeight: 600,
                          }}
                        >
                          {m.dose}
                        </span>
                      )}
                      {m.duration && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "var(--surface-2, rgba(0,0,0,0.05))",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {m.duration}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--border)",
              background: "var(--surface-card, #ffffff)",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 10,
            }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleSubmit()}
              disabled={isSubmitting || !name.trim() || medicines.length === 0}
              style={{ fontWeight: 700, minWidth: 120 }}
            >
              <Save size={14} />
              <span>{isSubmitting ? "Saving..." : "Save Template"}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
