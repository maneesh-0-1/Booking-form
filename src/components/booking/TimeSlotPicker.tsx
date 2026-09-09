"use client";

import React, { useState, useEffect } from "react";
import styles from "./booking.module.css";
import { Loader2, Calendar, AlertCircle } from "lucide-react";
import { AvailableSlot, getLocalTodayDateString } from "@/lib/timezone";

interface TimeSlotPickerProps {
  selectedDate: string;
  durationMinutes: number;
  selectedSlot: AvailableSlot | null;
  onDateChange: (date: string) => void;
  onSelectSlot: (slot: AvailableSlot) => void;
}

export const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  selectedDate,
  durationMinutes,
  selectedSlot,
  onDateChange,
  onSelectSlot,
}) => {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [holidayNotice, setHolidayNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch slots whenever selectedDate or durationMinutes changes
  useEffect(() => {
    let isMounted = true;

    async function fetchAvailability() {
      if (!selectedDate || !durationMinutes) return;
      setLoading(true);
      setError(null);
      setHolidayNotice(null);

      try {
        const res = await fetch(
          `/api/booking/availability?date=${selectedDate}&duration=${durationMinutes}`
        );
        const data = await res.json();

        if (isMounted) {
          if (data.success) {
            if (data.isHoliday) {
              setHolidayNotice(data.holidayName || "Clinic Holiday Closure");
              setSlots([]);
            } else {
              setSlots(data.availableSlots || []);
            }
          } else {
            setError(data.error || "Failed to load time slots");
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError("Network connection issue while fetching available times");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchAvailability();

    return () => {
      isMounted = false;
    };
  }, [selectedDate, durationMinutes]);

  const todayStr = getLocalTodayDateString();

  return (
    <div>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="appointment-date-input">
          <Calendar size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
          Select Clinical Date
        </label>
        <input
          id="appointment-date-input"
          type="date"
          min={todayStr}
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className={styles.formInput}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label className={styles.formLabel} style={{ marginBottom: 0 }}>
            Available Time Slots (Mountain Time)
          </label>
          <span style={{ fontSize: 12, color: "var(--accent-teal-glow)", fontWeight: 600 }}>
            {slots.length} available
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "var(--text-secondary)" }}>
            <Loader2 className="spinner" size={24} style={{ margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13 }}>Calculating real-time clinic openings...</p>
          </div>
        ) : holidayNotice ? (
          <div
            className={styles.noSlotsNotice}
            style={{
              background: "rgba(245, 158, 11, 0.1)",
              borderColor: "rgba(245, 158, 11, 0.3)",
              color: "#fbbf24",
            }}
          >
            <AlertCircle size={22} style={{ margin: "0 auto 8px", color: "#f59e0b" }} />
            <p style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 4 }}>
              Clinic Holiday: {holidayNotice}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              The clinic is closed on this date. Please select another date for your reflexology appointment.
            </p>
          </div>
        ) : error ? (
          <div className={styles.noSlotsNotice} style={{ color: "#fb7185" }}>
            <AlertCircle size={20} style={{ margin: "0 auto 6px" }} />
            <p>{error}</p>
          </div>
        ) : slots.length === 0 ? (
          <div className={styles.noSlotsNotice}>
            <p style={{ fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>No available slots on this date</p>
            <p>The practitioner is fully booked or outside clinical hours. Please select another date.</p>
          </div>
        ) : (
          <div className={styles.slotGridContainer}>
            <div className={styles.slotGrid}>
              {slots.map((slot) => {
                const isSelected = selectedSlot?.time === slot.time;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    className={`${styles.slotPill} ${isSelected ? styles.slotPillSelected : ""}`}
                    onClick={() => onSelectSlot(slot)}
                    id={`slot-button-${slot.time.replace(":", "")}`}
                  >
                    {slot.displayTime}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
