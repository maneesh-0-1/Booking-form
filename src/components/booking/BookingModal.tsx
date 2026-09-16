"use client";

import React, { useState, useEffect } from "react";
import styles from "./booking.module.css";
import {
  X,
  MapPin,
  Globe,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { ServiceTierSelector, Tier } from "./ServiceTierSelector";
import { TimeSlotPicker } from "./TimeSlotPicker";
import { AvailableSlot, getLocalTodayDateString } from "@/lib/timezone";

export interface ServiceItem {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  tiers: Tier[];
}

interface BookingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  isEmbed?: boolean;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose = () => {},
  isEmbed = false,
}) => {
  // Services Data
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState<boolean>(true);

  // Selection States
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  // Patient Intake Form
  const [clientName, setClientName] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");
  const [clientPhone, setClientPhone] = useState<string>("");
  const [clientAddress, setClientAddress] = useState<string>("");

  // Status States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);

  // Load services & preselect first
  useEffect(() => {
    async function loadServices() {
      try {
        const res = await fetch("/api/booking/services");
        const data = await res.json();
        if (data.success && data.services.length > 0) {
          setServices(data.services);
          const firstService = data.services[0];
          setSelectedServiceId(firstService.id);
          if (firstService.tiers.length > 0) {
            setSelectedTier(firstService.tiers[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load services", err);
      } finally {
        setLoadingServices(false);
      }
    }

    if (isOpen) {
      loadServices();
      const todayStr = getLocalTodayDateString();
      setSelectedDate(todayStr);
    }
  }, [isOpen]);

  // Keyboard accessibility: Escape key closes modal & lock body scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  const activeService = services.find((s) => s.id === selectedServiceId) || services[0];

  const handleServiceChange = (serviceId: number) => {
    setSelectedServiceId(serviceId);
    const service = services.find((s) => s.id === serviceId);
    if (service && service.tiers.length > 0) {
      const matchedTier =
        service.tiers.find((t) => t.durationMinutes === selectedTier?.durationMinutes) ||
        service.tiers[0];
      setSelectedTier(matchedTier);
      setSelectedSlot(null);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!selectedTier) {
      errors.tier = "Please select a duration tier";
    }
    if (!selectedSlot) {
      errors.slot = "Please select an available appointment time slot";
    }
    if (!clientName.trim() || clientName.trim().length < 2) {
      errors.name = "Full legal name is required (min 2 characters)";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!clientEmail.trim() || !emailRegex.test(clientEmail.trim())) {
      errors.email = "Please provide a valid email address";
    }
    const canadianPhoneRegex = /^(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}$/;
    if (!clientPhone.trim() || !canadianPhoneRegex.test(clientPhone.trim())) {
      errors.phone = "Valid Canadian phone required (e.g. 403-555-0199)";
    }
    if (!clientAddress.trim() || clientAddress.trim().length < 5) {
      errors.address = "Full address required (e.g. 123 Elm St NW, Calgary)";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConfirmReservation = async () => {
    if (!validateForm()) return;
    if (!selectedTier || !selectedSlot) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/booking/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceTierId: selectedTier.id,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          clientPhone: clientPhone.trim(),
          clientAddress: clientAddress.trim(),
          startTime: selectedSlot.isoString,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setSubmitError(
          data.error || "This time slot was just taken by another patient. Please choose another time slot above."
        );
        setSelectedSlot(null);
        return;
      }

      if (!res.ok || !data.success) {
        setSubmitError(data.error || "Reservation failed. Please check details and try again.");
        return;
      }

      setConfirmedBooking(data.booking);
      setIsSuccess(true);
    } catch (err: any) {
      setSubmitError("Network connection error during reservation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setIsSuccess(false);
    setSelectedSlot(null);
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setClientAddress("");
    setFormErrors({});
    setSubmitError(null);
    setConfirmedBooking(null);
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className={styles.modalDialog}
      style={
        isEmbed
          ? { height: "100vh", maxHeight: "100vh", width: "100vw", maxWidth: "100%", borderRadius: 0, border: "none", boxShadow: "none" }
          : { maxHeight: "820px" }
      }
    >
      {/* Close Button */}
      {!isEmbed && (
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close booking modal"
          id="close-booking-modal"
          disabled={isSubmitting}
        >
          <X size={18} />
        </button>
      )}

        {/* Left Side: Dynamic Receipt Panel */}
        <div className={styles.receiptPanel}>
          <div>
            <div className={styles.clinicBrand}>
              <div className={styles.clinicBadge}>
                <span className={styles.pulseDot} />
                <span>Calgary Clinic</span>
              </div>
              <h2 className={styles.clinicName}>YYC Reflexology</h2>
              <div className={styles.clinicAddress}>
                <MapPin size={13} style={{ flexShrink: 0 }} />
                <span>10880 Hidden Valley DR NW Calgary</span>
              </div>
              <div className={styles.timezoneBadge}>
                <Globe size={13} />
                <span>Mountain Time (America/Edmonton)</span>
              </div>
            </div>

            {/* Reactive Receipt Items */}
            <div className={styles.receiptSection}>
              <div className={styles.receiptHeading}>Appointment Summary</div>

              <div className={styles.receiptItem}>
                <span className={styles.receiptLabel}>Service:</span>
                <span className={styles.receiptValue}>
                  {activeService ? activeService.name : "Reflexology"}
                </span>
              </div>

              <div className={styles.receiptItem}>
                <span className={styles.receiptLabel}>Duration:</span>
                <span className={styles.receiptValue}>
                  {selectedTier ? `${selectedTier.durationMinutes} Minutes` : "—"}
                </span>
              </div>

              <div className={styles.receiptItem}>
                <span className={styles.receiptLabel}>Date:</span>
                <span className={styles.receiptValue}>{selectedDate || "Not chosen"}</span>
              </div>

              <div className={styles.receiptItem}>
                <span className={styles.receiptLabel}>Time Slot:</span>
                <span className={styles.receiptValue}>
                  {selectedSlot ? selectedSlot.displayTime : "Not selected"}
                </span>
              </div>

              {clientName && (
                <div className={styles.receiptItem}>
                  <span className={styles.receiptLabel}>Patient:</span>
                  <span className={styles.receiptValue}>{clientName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Total calculation */}
          <div className={styles.totalCard}>
            <div>
              <div className={styles.totalLabel}>Total Fee</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Inclusive of taxes
              </div>
            </div>
            <div className={styles.totalAmount}>
              ${selectedTier ? Number(selectedTier.price).toFixed(2) : "0.00"}
              <span className={styles.currencyTag}>CAD</span>
            </div>
          </div>
        </div>

        {/* Right Side: Streamlined All-in-One Content */}
        <div className={styles.formPanel}>
          {isSuccess && confirmedBooking ? (
            /* SUCCESS CONFIRMATION SCREEN (No .ics download button as requested) */
            <div className={`${styles.successScreen} animate-fade-in`}>
              <div className={styles.successIcon}>
                <CheckCircle2 size={36} />
              </div>
              <h3 className={styles.successTitle}>Appointment Confirmed!</h3>
              <p className={styles.successDesc}>
                Reference <strong style={{ color: "#166534" }}>{confirmedBooking.referenceNumber || `#${confirmedBooking.id}`}</strong> has been secured in the clinic schedule.
                Confirmation details have been emailed directly to <strong>{confirmedBooking.clientEmail}</strong>.
              </p>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 20,
                  width: "100%",
                  maxWidth: 420,
                  marginBottom: 24,
                  textAlign: "left",
                  fontSize: 13,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ color: "#64748b", fontWeight: 600 }}>Appointment Reference:</span>
                  <span style={{ fontWeight: 800, color: "#15803d", letterSpacing: "0.5px", fontSize: 14 }}>
                    {confirmedBooking.referenceNumber || `#${confirmedBooking.id}`}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#64748b" }}>Service:</span>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>{confirmedBooking.serviceName}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#64748b" }}>Duration:</span>
                  <span style={{ color: "#1e293b" }}>{confirmedBooking.durationMinutes} Minutes</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#64748b" }}>Date & Time:</span>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>
                    {new Date(confirmedBooking.startTime).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    at{" "}
                    {new Date(confirmedBooking.startTime).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}{" "}
                    MT
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Clinic Address:</span>
                  <span style={{ textAlign: "right", maxWidth: 220, color: "#1e293b" }}>10880 Hidden Valley DR NW Calgary</span>
                </div>
              </div>

              <button
                type="button"
                className={styles.btnPrimary}
                onClick={resetAndClose}
                id="done-booking-btn"
                style={{ padding: "12px 36px" }}
              >
                Done
              </button>
            </div>
          ) : (
            /* UNIFIED ALL-IN-ONE BOOKING FORM */
            <div className="animate-fade-in">
              <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--border-subtle)" }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1e293b" }}>
                  Schedule Your Session
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  Select therapy and time slot, then enter your patient details below.
                </p>
              </div>

              {submitError && (
                <div
                  style={{
                    background: "rgba(244, 63, 94, 0.12)",
                    border: "1px solid rgba(244, 63, 94, 0.3)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "#fb7185",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 18,
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{submitError}</span>
                </div>
              )}

              {loadingServices ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <Loader2 className="spinner" size={24} style={{ margin: "0 auto" }} />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                  {/* SECTION 1: Service & Duration Tier */}
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "var(--radius-md)", padding: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#f1f8e9", color: "#689f38", border: "1px solid #c5e1a5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                        1
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                        Therapeutic Focus & Duration
                      </span>
                    </div>

                    <div className={styles.formGroup}>
                      <select
                        id="service-select"
                        value={selectedServiceId || ""}
                        onChange={(e) => handleServiceChange(Number(e.target.value))}
                        className={styles.formSelect}
                      >
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                      {activeService?.description && (
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }}>
                          {activeService.description}
                        </p>
                      )}
                    </div>

                    {activeService && activeService.tiers.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <ServiceTierSelector
                          tiers={activeService.tiers}
                          selectedTierId={selectedTier?.id || null}
                          onSelectTier={(tier) => {
                            setSelectedTier(tier);
                            setSelectedSlot(null);
                          }}
                        />
                        {formErrors.tier && <p className={styles.errorText}>{formErrors.tier}</p>}
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: Date & Available Time Slot */}
                  {selectedTier && (
                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "var(--radius-md)", padding: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#f1f8e9", color: "#689f38", border: "1px solid #c5e1a5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                          2
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                          Choose Appointment Time (Mountain Time)
                        </span>
                      </div>

                      <TimeSlotPicker
                        selectedDate={selectedDate}
                        durationMinutes={selectedTier.durationMinutes}
                        selectedSlot={selectedSlot}
                        onDateChange={(date) => {
                          setSelectedDate(date);
                          setSelectedSlot(null);
                        }}
                        onSelectSlot={(slot) => {
                          setSelectedSlot(slot);
                          if (formErrors.slot) setFormErrors({ ...formErrors, slot: "" });
                        }}
                      />
                      {formErrors.slot && <p className={styles.errorText} style={{ marginTop: 8 }}>{formErrors.slot}</p>}
                    </div>
                  )}

                  {/* SECTION 3: Patient Intake Details */}
                  <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "var(--radius-md)", padding: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#f1f8e9", color: "#689f38", border: "1px solid #c5e1a5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                        3
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                        Patient Intake Details
                      </span>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel} htmlFor="client-name">
                        Full Legal Name *
                      </label>
                      <input
                        id="client-name"
                        type="text"
                        placeholder="e.g. Sarah Jenkins"
                        value={clientName}
                        onChange={(e) => {
                          setClientName(e.target.value);
                          if (formErrors.name) setFormErrors({ ...formErrors, name: "" });
                        }}
                        className={`${styles.formInput} ${formErrors.name ? styles.inputError : ""}`}
                      />
                      {formErrors.name && <p className={styles.errorText}>{formErrors.name}</p>}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="client-email">
                          Email Address *
                        </label>
                        <input
                          id="client-email"
                          type="email"
                          placeholder="sarah@example.ca"
                          value={clientEmail}
                          onChange={(e) => {
                            setClientEmail(e.target.value);
                            if (formErrors.email) setFormErrors({ ...formErrors, email: "" });
                          }}
                          className={`${styles.formInput} ${formErrors.email ? styles.inputError : ""}`}
                        />
                        {formErrors.email && <p className={styles.errorText}>{formErrors.email}</p>}
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.formLabel} htmlFor="client-phone">
                          Mobile Phone (Canada) *
                        </label>
                        <input
                          id="client-phone"
                          type="tel"
                          placeholder="403-555-0199"
                          value={clientPhone}
                          onChange={(e) => {
                            setClientPhone(e.target.value);
                            if (formErrors.phone) setFormErrors({ ...formErrors, phone: "" });
                          }}
                          className={`${styles.formInput} ${formErrors.phone ? styles.inputError : ""}`}
                        />
                        {formErrors.phone && <p className={styles.errorText}>{formErrors.phone}</p>}
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel} htmlFor="client-address">
                        Residential / Appointment Address *
                      </label>
                      <input
                        id="client-address"
                        type="text"
                        placeholder="e.g. 124 14th Ave NW, Calgary, AB"
                        value={clientAddress}
                        onChange={(e) => {
                          setClientAddress(e.target.value);
                          if (formErrors.address) setFormErrors({ ...formErrors, address: "" });
                        }}
                        className={`${styles.formInput} ${formErrors.address ? styles.inputError : ""}`}
                      />
                      {formErrors.address && <p className={styles.errorText}>{formErrors.address}</p>}
                    </div>
                  </div>

                  {/* Submission Action Bar */}
                  <div style={{ paddingTop: 12, borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {selectedSlot ? (
                        <span style={{ color: "var(--accent-teal-glow)" }}>
                          Selected: {selectedSlot.displayTime} on {selectedDate}
                        </span>
                      ) : (
                        <span>Please pick an available time slot</span>
                      )}
                    </div>

                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={handleConfirmReservation}
                      disabled={isSubmitting || !selectedSlot}
                      id="confirm-booking-btn"
                      style={{ padding: "14px 32px", fontSize: 15 }}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="spinner" size={16} />
                          Locking Slot & Reserving...
                        </>
                      ) : (
                        <>
                          Confirm Appointment (${selectedTier ? Number(selectedTier.price).toFixed(2) : "0.00"} CAD)
                          <CheckCircle2 size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  );

  if (isEmbed) {
    return modalContent;
  }

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      {modalContent}
    </div>
  );
};
