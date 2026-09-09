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
    <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Active Schedule & Time Blocks</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Real-time status of practitioner blocks vs patient reservations.
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent-teal)" }} />
            <span style={{ color: "var(--text-secondary)" }}>Booked Appointment</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#f59e0b" }} />
            <span style={{ color: "var(--text-secondary)" }}>Doctor Block</span>
          </div>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-muted)", background: "rgba(255, 255, 255, 0.02)", borderRadius: 12, border: "1px dashed var(--border-subtle)" }}>
          <Calendar size={28} style={{ margin: "0 auto 8px", opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: "#fff" }}>No active blocks or bookings</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>All clinical slots within 09:00 - 18:00 MT are currently available.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto", paddingRight: 6 }}>
          {blocks.map((block) => {
            const isBooked = block.blockType === "BOOKED";
            const sDate = new Date(block.startTime);
            const eDate = new Date(block.endTime);

            return (
              <div
                key={block.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  borderRadius: 10,
                  background: isBooked ? "rgba(20, 184, 166, 0.08)" : "rgba(245, 158, 11, 0.08)",
                  borderLeft: `4px solid ${isBooked ? "var(--accent-teal)" : "#f59e0b"}`,
                  borderTop: "1px solid var(--border-subtle)",
                  borderRight: "1px solid var(--border-subtle)",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      background: isBooked ? "rgba(20, 184, 166, 0.2)" : "rgba(245, 158, 11, 0.2)",
                      color: isBooked ? "var(--accent-teal-glow)" : "#fbbf24",
                    }}
                  >
                    {isBooked ? <UserCheck size={18} /> : <Lock size={18} />}
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>
                        {format(sDate, "EEE, MMM d, yyyy")}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: isBooked ? "rgba(20, 184, 166, 0.25)" : "rgba(245, 158, 11, 0.25)",
                          color: isBooked ? "var(--accent-teal-glow)" : "#fbbf24",
                        }}
                      >
                        {block.blockType}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, fontSize: 13, color: "var(--text-secondary)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} />
                        {format(sDate, "h:mm a")} – {format(eDate, "h:mm a")} (MT)
                      </span>
                      {block.reason && (
                        <span style={{ color: "var(--text-muted)" }}>• {block.reason}</span>
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
