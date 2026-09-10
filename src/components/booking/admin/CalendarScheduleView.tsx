"use client";

import React from "react";
import { Trash2, Clock, Calendar, Lock, UserCheck, Shield } from "lucide-react";
import { format } from "date-fns";

export interface TimeBlockItem {
  id: number;
  startTime: string;
  endTime: string;
  blockType: "BOOKED" | "BLOCKED";
  reason: string | null;
  bookingId: number | null;
}

interface CalendarScheduleViewProps {
  blocks: TimeBlockItem[];
  onDeleteBlock: (blockId: number) => void;
}

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = ({
  blocks,
  onDeleteBlock,
}) => {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Active Schedule & Time Blocks</h3>
          <p style={{ fontSize: 13, color: "#64748b" }}>
            Real-time status of practitioner blocks vs patient reservations.
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#689f38" }} />
            <span style={{ color: "#475569" }}>Booked Appointment</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#f59e0b" }} />
            <span style={{ color: "#475569" }}>Doctor Block</span>
          </div>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 16px", color: "#64748b", background: "#f8fafc", borderRadius: 12, border: "1px dashed #cbd5e1" }}>
          <Calendar size={28} style={{ margin: "0 auto 8px", opacity: 0.6, color: "#689f38" }} />
          <p style={{ fontWeight: 600, color: "#1e293b" }}>No active blocks or bookings</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>All clinical slots within clinic hours are currently available.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto", paddingRight: 6 }}>
          {blocks.map((block) => {
            const isBooked = block.blockType === "BOOKED";
            const formatSafe = (d: any, fmt: string) => {
              try {
                const dt = new Date(d);
                if (isNaN(dt.getTime())) return "N/A";
                return format(dt, fmt);
              } catch {
                return "N/A";
              }
            };

            return (
              <div
                key={block.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  borderRadius: 10,
                  background: isBooked ? "#f1f8e9" : "#fffbeb",
                  borderLeft: `4px solid ${isBooked ? "#689f38" : "#f59e0b"}`,
                  borderTop: `1px solid ${isBooked ? "#dcedc8" : "#fde68a"}`,
                  borderRight: `1px solid ${isBooked ? "#dcedc8" : "#fde68a"}`,
                  borderBottom: `1px solid ${isBooked ? "#dcedc8" : "#fde68a"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      background: isBooked ? "#dcedc8" : "#fef3c7",
                      color: isBooked ? "#33691e" : "#b45309",
                    }}
                  >
                    {isBooked ? <UserCheck size={18} /> : <Lock size={18} />}
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
                        {formatSafe(block.startTime, "EEE, MMM d, yyyy")}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: isBooked ? "#dcfce7" : "#fef3c7",
                          color: isBooked ? "#15803d" : "#b45309",
                        }}
                      >
                        {block.blockType}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, fontSize: 13, color: "#475569" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} />
                        {formatSafe(block.startTime, "h:mm a")} – {formatSafe(block.endTime, "h:mm a")} (MT)
                      </span>
                      {block.reason && (
                        <span style={{ color: "#64748b" }}>• {block.reason}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  {!isBooked && (
                    <button
                      type="button"
                      onClick={() => onDeleteBlock(block.id)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "rgba(244, 63, 94, 0.12)",
                        border: "1px solid rgba(244, 63, 94, 0.3)",
                        color: "#fb7185",
                        fontSize: 12,
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                      }}
                      title="Release this blocked time"
                    >
                      <Trash2 size={13} />
                      Unblock
                    </button>
                  )}
                  {isBooked && (
                    <span style={{ fontSize: 12, color: "var(--accent-teal-glow)", fontWeight: 600 }}>
                      Confirmed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
