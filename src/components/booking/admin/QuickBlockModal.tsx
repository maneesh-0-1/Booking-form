"use client";

import React, { useState } from "react";
import { X, ShieldAlert, Clock, Loader2, Calendar } from "lucide-react";
import styles from "../booking.module.css";

interface QuickBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBlockCreated: () => void;
  adminToken?: string;
}

export const QuickBlockModal: React.FC<QuickBlockModalProps> = ({
  isOpen,
  onClose,
  onBlockCreated,
  adminToken,
}) => {
  const todayStr = new Date().toISOString().split("T")[0];
  const [blockDate, setBlockDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>("13:00");
  const [endTime, setEndTime] = useState<string>("15:00");
  const [reason, setReason] = useState<string>("Doctor unavailable / Personal time");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const startIso = `${blockDate}T${startTime}:00`;
    const endIso = `${blockDate}T${endTime}:00`;

    if (new Date(endIso) <= new Date(startIso)) {
      setError("End time must be later than start time");
      return;
    }

    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminToken) headers["x-admin-token"] = adminToken;

      const res = await fetch("/api/booking/admin/blocks", {
        method: "POST",
        headers,
        body: JSON.stringify({
          startTime: startIso,
          endTime: endIso,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to create practitioner time block");
        return;
      }

      onBlockCreated();
      onClose();
    } catch (err: any) {
      setError("Network error while creating time block");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-active)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg), var(--shadow-glow)",
          padding: "32px",
          width: "100%",
          maxWidth: "480px",
          position: "relative",
        }}
        className="animate-fade-in"
      >
        <button
          className={styles.closeButton}
          onClick={onClose}
          disabled={isSubmitting}
          id="close-quick-block-btn"
        >
          <X size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div
            style={{
              padding: 8,
              borderRadius: 8,
              background: "rgba(245, 158, 11, 0.15)",
              color: "#f59e0b",
            }}
          >
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>Quick Time-Block</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Zero dummy data required. Pure practitioner schedule lock.
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(244, 63, 94, 0.15)",
              color: "#fb7185",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              <Calendar size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Target Date
            </label>
            <input
              type="date"
              value={blockDate}
              onChange={(e) => setBlockDate(e.target.value)}
              className={styles.formInput}
              required
              id="block-date-input"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <Clock size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Start Time (MT)
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={styles.formInput}
                required
                id="block-start-time-input"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <Clock size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                End Time (MT)
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={styles.formInput}
                required
                id="block-end-time-input"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Practitioner Memo / Note</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Clinical meeting, Personal errand, Emergency"
              className={styles.formInput}
              id="block-reason-input"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isSubmitting}
              id="submit-quick-block-btn"
              style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", borderColor: "#fbbf24" }}
            >
              {isSubmitting ? <Loader2 className="spinner" size={16} /> : "Block Interval"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
