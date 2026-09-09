"use client";

import React, { useState } from "react";
import { DollarSign, Check, Loader2, Edit3 } from "lucide-react";
import styles from "../booking.module.css";
import { ServiceItem } from "../BookingModal";

interface ServicePriceMatrixEditorProps {
  services: ServiceItem[];
  onRefresh: () => void;
  adminToken?: string;
}

export const ServicePriceMatrixEditor: React.FC<ServicePriceMatrixEditorProps> = ({
  services,
  onRefresh,
  adminToken,
}) => {
  const [editingTierId, setEditingTierId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [updatingTierId, setUpdatingTierId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const startEdit = (tierId: number, currentPrice: number) => {
    setEditingTierId(tierId);
    setEditPrice(currentPrice.toString());
  };

  const savePrice = async (tierId: number) => {
    const numericPrice = parseFloat(editPrice);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      alert("Please enter a valid positive price");
      return;
    }

    setUpdatingTierId(tierId);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminToken) headers["x-admin-token"] = adminToken;

      const res = await fetch("/api/booking/admin/services", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          tierId,
          price: numericPrice,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback(`Updated fee: $${numericPrice.toFixed(2)} CAD`);
        setEditingTierId(null);
        onRefresh();
        setTimeout(() => setFeedback(null), 3000);
      } else {
        alert(data.error || "Failed to update price");
      }
    } catch (err) {
      alert("Network error updating price");
    } finally {
      setUpdatingTierId(null);
    }
  };

  return (
    <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Service Pricing & Duration Matrix</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Live clinical rate matrix. Click any fee to modify price directly without code changes.
          </p>
        </div>
        {feedback && (
          <span style={{ fontSize: 13, color: "var(--accent-teal-glow)", display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(20, 184, 166, 0.15)", padding: "4px 12px", borderRadius: 20 }}>
            <Check size={14} />
            {feedback}
          </span>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "12px 16px" }}>Clinical Service</th>
              <th style={{ padding: "12px 16px", textAlign: "center" }}>30 Min Fee</th>
              <th style={{ padding: "12px 16px", textAlign: "center" }}>45 Min Fee</th>
              <th style={{ padding: "12px 16px", textAlign: "center" }}>60 Min Fee</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => {
              const tier30 = service.tiers.find((t) => t.durationMinutes === 30);
              const tier45 = service.tiers.find((t) => t.durationMinutes === 45);
              const tier60 = service.tiers.find((t) => t.durationMinutes === 60);

              const renderCell = (tier?: { id: number; price: number; currency: string }) => {
                if (!tier) return <span style={{ color: "var(--text-muted)" }}>N/A</span>;
                const isEditing = editingTierId === tier.id;
                const isSaving = updatingTierId === tier.id;

                if (isEditing) {
                  return (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>$</span>
                      <input
                        type="number"
                        step="5"
                        min="1"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        style={{
                          width: "70px",
                          padding: "4px 8px",
                          background: "#090d16",
                          border: "1px solid var(--accent-teal-glow)",
                          borderRadius: 6,
                          color: "#fff",
                          fontSize: 13,
                          outline: "none",
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => savePrice(tier.id)}
                        disabled={isSaving}
                        style={{
                          padding: "4px 8px",
                          background: "var(--accent-teal)",
                          borderRadius: 6,
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {isSaving ? <Loader2 size={12} className="spinner" /> : "Save"}
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    type="button"
                    onClick={() => startEdit(tier.id, tier.price)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--border-subtle)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(45, 212, 191, 0.1)";
                      e.currentTarget.style.borderColor = "var(--accent-teal-glow)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                      e.currentTarget.style.borderColor = "var(--border-subtle)";
                    }}
                    title="Click to edit fee"
                  >
                    <span style={{ color: "var(--accent-teal-glow)" }}>${Number(tier.price).toFixed(2)}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>CAD</span>
                    <Edit3 size={11} style={{ color: "var(--text-muted)", marginLeft: 2 }} />
                  </button>
                );
              };

              return (
                <tr key={service.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "16px" }}>
                    <div style={{ fontWeight: 600, color: "#fff" }}>{service.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 360, marginTop: 2 }}>
                      {service.description}
                    </div>
                  </td>
                  <td style={{ padding: "16px", textAlign: "center" }}>{renderCell(tier30)}</td>
                  <td style={{ padding: "16px", textAlign: "center" }}>{renderCell(tier45)}</td>
                  <td style={{ padding: "16px", textAlign: "center" }}>{renderCell(tier60)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
