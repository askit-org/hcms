"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Copy, Check, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "./Toast";

interface UpiQrCodeProps {
  upiId?: string;
  payeeName?: string;
  amount: number;
  note?: string;
  onUpiIdChange?: (newUpiId: string) => void;
}

export default function UpiQrCode({
  upiId = "",
  payeeName = "Clinic OPD",
  amount,
  note = "OPD Medical Bill",
  onUpiIdChange,
}: UpiQrCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [editingUpi, setEditingUpi] = useState(!upiId);
  const [tempUpi, setTempUpi] = useState(upiId);

  useEffect(() => {
    setTempUpi(upiId);
    if (!upiId) {
      setEditingUpi(true);
    }
  }, [upiId]);

  const activeUpiId = (editingUpi ? tempUpi : upiId).trim();

  useEffect(() => {
    if (!activeUpiId || amount <= 0) {
      setQrDataUrl("");
      return;
    }

    const upiUrl = `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(
      payeeName || "Clinic"
    )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note || "OPD Bill")}`;

    QRCode.toDataURL(upiUrl, {
      width: 220,
      margin: 1.5,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => {
        console.error("Failed to generate UPI QR:", err);
        setQrDataUrl("");
      });
  }, [activeUpiId, payeeName, amount, note]);

  const copyUpiId = () => {
    if (!activeUpiId) return;
    navigator.clipboard.writeText(activeUpiId);
    setCopied(true);
    toast("UPI ID copied to clipboard", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveUpi = () => {
    if (!tempUpi.trim()) {
      toast("Please enter a valid UPI ID (e.g. clinic@okhdfcbank)", "error");
      return;
    }
    setEditingUpi(false);
    onUpiIdChange?.(tempUpi.trim());
    toast("UPI ID updated", "success");
  };

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        maxWidth: 380,
        margin: "0 auto",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          color: "var(--text-primary)",
          fontWeight: 700,
          fontSize: "0.95rem",
        }}
      >
        <QrCode size={18} style={{ color: "var(--accent)" }} />
        <span>Scan & Pay via UPI</span>
      </div>

      {!activeUpiId || editingUpi ? (
        <div
          style={{
            width: "100%",
            background: "var(--surface-2)",
            padding: 16,
            borderRadius: 10,
            border: "1px dashed var(--border)",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.82rem",
              color: "var(--text-secondary)",
              marginBottom: 8,
              justifyContent: "center",
            }}
          >
            <AlertCircle size={14} style={{ color: "#f59e0b" }} />
            <span>Enter Clinic / Doctor UPI ID for QR code</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              placeholder="e.g. doctor@okhdfcbank"
              className="form-input"
              value={tempUpi}
              onChange={(e) => setTempUpi(e.target.value)}
              style={{ fontSize: "0.85rem", height: 36 }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveUpi}
              style={{ height: 36, whiteSpace: "nowrap" }}
            >
              Set <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* QR Code Container */}
          <div
            style={{
              background: "#ffffff",
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
              marginBottom: 14,
              display: "inline-block",
            }}
          >
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="UPI Payment QR Code"
                width={190}
                height={190}
                style={{ display: "block", borderRadius: 6 }}
              />
            ) : (
              <div
                style={{
                  width: 190,
                  height: 190,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.82rem",
                }}
              >
                Generating QR...
              </div>
            )}
          </div>

          {/* Amount Badge */}
          <div
            style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              color: "var(--accent)",
              marginBottom: 6,
              letterSpacing: "-0.02em",
            }}
          >
            ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>

          {/* UPI ID Pill with Copy & Edit */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface-2)",
              padding: "4px 10px",
              borderRadius: 20,
              border: "1px solid var(--border)",
              fontSize: "0.78rem",
              marginBottom: 10,
              color: "var(--text-secondary)",
            }}
          >
            <span style={{ fontWeight: 600 }}>UPI ID:</span>
            <span style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>
              {activeUpiId}
            </span>
            <button
              type="button"
              onClick={copyUpiId}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: copied ? "#10b981" : "var(--text-muted)",
                display: "inline-flex",
                alignItems: "center",
              }}
              title="Copy UPI ID"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
            <button
              type="button"
              onClick={() => setEditingUpi(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "0.72rem",
                color: "var(--accent)",
                textDecoration: "underline",
                marginLeft: 4,
              }}
            >
              Change
            </button>
          </div>

          <p
            style={{
              fontSize: "0.74rem",
              color: "var(--text-muted)",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Scan using PhonePe, Google Pay, Paytm, BHIM, or any bank UPI app.
          </p>
        </>
      )}
    </div>
  );
}
