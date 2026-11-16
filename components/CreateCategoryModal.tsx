"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, X, Plus, Sparkles } from "lucide-react";
import { useAppOptionMutations } from "@/lib/hooks/useQueries";
import { toast } from "./Toast";
import { getErrorMessage } from "@/lib/utils/error";

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCategories?: string[];
  onSuccess: (newCategory: string) => void;
}

const SUGGESTED_CATEGORIES = [
  "Dental",
  "Minor Surgery",
  "Vaccination",
  "Physiotherapy",
  "Dermatology",
  "Ophthalmology",
  "Antenatal (ANC)",
  "Health Checkup",
];

export default function CreateCategoryModal({
  isOpen,
  onClose,
  existingCategories = [],
  onSuccess,
}: CreateCategoryModalProps) {
  const [mounted, setMounted] = useState(false);
  const { create: createOption } = useAppOptionMutations();

  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setName("");
      setError(null);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a category name.");
      return;
    }

    const alreadyExists = existingCategories.some(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyExists) {
      setError(`"${trimmed}" category already exists.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createOption.mutateAsync({
        optionType: "CATEGORY",
        value: trimmed,
      });
      toast(`Category "${trimmed}" added successfully!`, "success");
      onSuccess(trimmed);
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to create category.");
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
            maxWidth: 480,
            width: "100%",
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
                <Tag size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
                  Create Visit Category
                </h3>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Add a custom department or clinical visit type
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
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
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

            <form id="create-category-form" onSubmit={handleSubmit}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: "0.84rem" }}>
                  Category Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Dental, Vaccination, Minor Surgery"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  autoFocus
                  required
                />
              </div>
            </form>

            {/* Quick Suggestions */}
            <div>
              <div
                style={{
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Sparkles size={12} style={{ color: "var(--accent)" }} />
                <span>Quick Suggestions:</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SUGGESTED_CATEGORIES.filter(
                  (s) => !existingCategories.some((c) => c.toLowerCase() === s.toLowerCase())
                ).map((sugg) => (
                  <button
                    key={sugg}
                    type="button"
                    onClick={() => {
                      setName(sugg);
                      if (error) setError(null);
                    }}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontSize: "0.74rem",
                      background: name === sugg ? "var(--accent)" : "var(--surface-2, rgba(0,0,0,0.05))",
                      color: name === sugg ? "#ffffff" : "var(--text-secondary)",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    + {sugg}
                  </button>
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
              disabled={isSubmitting || !name.trim()}
              style={{ fontWeight: 700, minWidth: 120 }}
            >
              <Plus size={14} />
              <span>{isSubmitting ? "Adding..." : "Add Category"}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
