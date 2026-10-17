"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ShieldAlert, Trash2, UserX, CheckCircle2 } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info" | "success";
  isLoading?: boolean;
  children?: React.ReactNode;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
  children,
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const iconBg =
    variant === "danger"
      ? "rgba(239, 68, 68, 0.15)"
      : variant === "warning"
      ? "rgba(245, 158, 11, 0.15)"
      : variant === "success"
      ? "rgba(16, 185, 129, 0.15)"
      : "rgba(13, 148, 136, 0.15)";

  const iconColor =
    variant === "danger"
      ? "var(--red, #ef4444)"
      : variant === "warning"
      ? "var(--amber, #f59e0b)"
      : variant === "success"
      ? "var(--emerald, #10b981)"
      : "var(--accent, #0d9488)";

  const btnBg =
    variant === "danger"
      ? "linear-gradient(135deg, #ef4444, #dc2626)"
      : variant === "warning"
      ? "linear-gradient(135deg, #f59e0b, #d97706)"
      : "linear-gradient(135deg, var(--accent), var(--accent-light))";

  return createPortal(
    <AnimatePresence>
      <div
        className="modal-overlay"
        style={{
          zIndex: 1000050,
          background: "rgba(10, 15, 30, 0.85)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
        onClick={onClose}
      >
        <motion.div
          className="modal"
          style={{
            maxWidth: "460px",
            width: "100%",
            padding: "24px",
            borderRadius: "16px",
            background: "var(--surface-solid)",
            border: "1px solid var(--border)",
            boxShadow: "var(--modal-shadow), 0 20px 50px rgba(0, 0, 0, 0.4)",
            position: "relative",
            zIndex: 1000060,
          }}
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Icon */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>

          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            {/* Alert Icon Badge */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: iconBg,
                color: iconColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: `1px solid ${iconColor}40`,
              }}
            >
              {variant === "danger" ? (
                <Trash2 size={24} />
              ) : variant === "warning" ? (
                <UserX size={24} />
              ) : variant === "success" ? (
                <CheckCircle2 size={24} />
              ) : (
                <AlertTriangle size={24} />
              )}
            </div>

            <div style={{ flex: 1 }}>
              <h3
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  margin: "0 0 6px 0",
                  color: "var(--text-primary)",
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontSize: "0.86rem",
                  color: "var(--text-secondary)",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {description}
              </p>
              {children && <div style={{ marginTop: 12 }}>{children}</div>}
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 24,
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: "9px 18px",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "0.88rem",
              }}
            >
              {cancelText}
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onConfirm();
              }}
              disabled={isLoading}
              style={{
                padding: "9px 20px",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "0.88rem",
                background: btnBg,
                border: "none",
                color: "#ffffff",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.3)",
              }}
            >
              {isLoading ? "Processing…" : confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
