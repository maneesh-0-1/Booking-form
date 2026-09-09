"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Lock,
  DollarSign,
  UserCheck,
  Plus,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  Clock,
  MapPin,
  LogOut,
  ExternalLink,
  Trash2,
  Settings,
  Palmtree,
  Check,
  Edit3,
} from "lucide-react";
import { QuickBlockModal } from "@/components/booking/admin/QuickBlockModal";
import { CalendarScheduleView, TimeBlockItem } from "@/components/booking/admin/CalendarScheduleView";
import { ServiceItem } from "@/components/booking/BookingModal";
import styles from "@/components/booking/booking.module.css";
import { format } from "date-fns";

export default function BookingAdminPage() {
  // Auth state
  const [token, setToken] = useState<string>("");
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"appointments" | "schedule" | "services" | "settings">("appointments");

  // Data states
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [blocks, setBlocks] = useState<TimeBlockItem[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [workingHours, setWorkingHours] = useState<{ startTime: string; endTime: string }>({
    startTime: "09:00",
    endTime: "18:00",
  });
  const [holidays, setHolidays] = useState<{ id: number; holidayDate: string; name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals & Forms State
  const [isQuickBlockOpen, setIsQuickBlockOpen] = useState<boolean>(false);
  const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Add Service Form Modal
  const [isAddServiceOpen, setIsAddServiceOpen] = useState<boolean>(false);
  const [newServiceName, setNewServiceName] = useState<string>("");
  const [newServiceDesc, setNewServiceDesc] = useState<string>("");
  const [isAddingService, setIsAddingService] = useState<boolean>(false);

  // Add Custom Tier Modal
  const [isAddTierOpen, setIsAddTierOpen] = useState<boolean>(false);
  const [targetServiceId, setTargetServiceId] = useState<number | null>(null);
  const [customDuration, setCustomDuration] = useState<string>("45");
  const [customPrice, setCustomPrice] = useState<string>("90");
  const [isAddingTier, setIsAddingTier] = useState<boolean>(false);

  // Working Hours Form
  const [startHourInput, setStartHourInput] = useState<string>("09:00");
  const [endHourInput, setEndHourInput] = useState<string>("18:00");
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  // Holiday Form
  const [newHolidayDate, setNewHolidayDate] = useState<string>("");
  const [newHolidayName, setNewHolidayName] = useState<string>("");
  const [isAddingHoliday, setIsAddingHoliday] = useState<boolean>(false);
  const [holidayNotice, setHolidayNotice] = useState<string | null>(null);

  // Inline Tier Edit
  const [editingTierId, setEditingTierId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");

  useEffect(() => {
    const savedToken = localStorage.getItem("yyc_admin_token");
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      const activeToken =
        token || (typeof window !== "undefined" ? localStorage.getItem("yyc_admin_token") : null) || "";
      if (activeToken) headers["x-admin-token"] = activeToken;

      const [servRes, blockRes, apptRes, settRes, holRes] = await Promise.all([
        fetch("/api/booking/admin/services", { headers }),
        fetch("/api/booking/admin/blocks", { headers }),
        fetch("/api/booking/admin/appointments", { headers }),
        fetch("/api/booking/admin/settings", { headers }),
        fetch("/api/booking/admin/holidays", { headers }),
      ]);

      if (servRes.status === 401 || blockRes.status === 401 || apptRes.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem("yyc_admin_token");
        return;
      }

      const servData = await servRes.json();
      const blockData = await blockRes.json();
      const apptData = await apptRes.json();
      const settData = await settRes.json();
      const holData = await holRes.json();

      if (servData.success) setServices(servData.services || []);
      if (blockData.success) setBlocks(blockData.blocks || []);
      if (apptData.success) setAppointments(apptData.bookings || []);
      if (settData.success && settData.settings) {
        setWorkingHours(settData.settings);
        setStartHourInput(settData.settings.startTime);
        setEndHourInput(settData.settings.endTime);
      }
      if (holData.success) setHolidays(holData.holidays || []);
    } catch (err) {
      console.error("Error fetching admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    try {
      const res = await fetch("/api/booking/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setToken(data.token);
        localStorage.setItem("yyc_admin_token", data.token);
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || "Invalid username or password");
      }
    } catch (err) {
      setAuthError("Network error during login");
    }
  };

  const handleLogout = () => {
    setToken("");
    localStorage.removeItem("yyc_admin_token");
    setIsAuthenticated(false);
  };

  // 1. Delete Practitioner Block
  const handleDeleteBlock = async (blockId: number) => {
    if (!confirm("Are you sure you want to release this time block?")) return;
    try {
      const headers: Record<string, string> = {};
      if (token) headers["x-admin-token"] = token;
      const res = await fetch(`/api/booking/admin/blocks?id=${blockId}`, { method: "DELETE", headers });
      const data = await res.json();
      if (res.ok && data.success) fetchData();
      else alert(data.error || "Failed to delete block");
    } catch {
      alert("Error deleting block");
    }
  };

  // 2. Confirm Appointment Cancellation
  const handleConfirmCancel = async () => {
    if (!cancellingBookingId) return;
    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      setCancelError("Please provide a valid cancellation reason (min 3 characters)");
      return;
    }
    setIsCancelling(true);
    setCancelError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-admin-token"] = token;
      const res = await fetch(`/api/booking/admin/appointments/${cancellingBookingId}/cancel`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCancellingBookingId(null);
        setCancelReason("");
        fetchData();
      } else {
        setCancelError(data.error || "Failed to cancel appointment");
      }
    } catch {
      setCancelError("Network error while cancelling");
    } finally {
      setIsCancelling(false);
    }
  };

  // 3. Create New Service
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    setIsAddingService(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-admin-token"] = token;
      const res = await fetch("/api/booking/admin/services", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "add_service",
          name: newServiceName.trim(),
          description: newServiceDesc.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAddServiceOpen(false);
        setNewServiceName("");
        setNewServiceDesc("");
        fetchData();
      } else {
        alert(data.error || "Failed to create service");
      }
    } catch {
      alert("Network error creating service");
    } finally {
      setIsAddingService(false);
    }
  };

  // 4. Delete Service
  const handleDeleteService = async (serviceId: number) => {
    if (!confirm("Are you sure you want to remove this service and all its duration tiers?")) return;
    try {
      const headers: Record<string, string> = {};
      if (token) headers["x-admin-token"] = token;
      const res = await fetch(`/api/booking/admin/services?type=service&id=${serviceId}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (res.ok && data.success) fetchData();
      else alert(data.error || "Failed to delete service");
    } catch {
      alert("Error deleting service");
    }
  };

  // 5. Add Custom Duration Tier
  const handleAddCustomTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetServiceId) return;
    setIsAddingTier(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-admin-token"] = token;
      const res = await fetch("/api/booking/admin/services", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "add_tier",
          serviceId: targetServiceId,
          durationMinutes: parseInt(customDuration, 10),
          price: parseFloat(customPrice),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAddTierOpen(false);
        fetchData();
      } else {
        alert(data.error || "Failed to add duration tier");
      }
    } catch {
      alert("Network error adding tier");
    } finally {
      setIsAddingTier(false);
    }
  };

  // 6. Delete Tier
  const handleDeleteTier = async (tierId: number) => {
    if (!confirm("Delete this duration tier?")) return;
    try {
      const headers: Record<string, string> = {};
      if (token) headers["x-admin-token"] = token;
      const res = await fetch(`/api/booking/admin/services?type=tier&id=${tierId}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (res.ok && data.success) fetchData();
      else alert(data.error || "Failed to delete tier");
    } catch {
      alert("Error deleting tier");
    }
  };

  // 7. Save Working Hours
  const handleSaveWorkingHours = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsNotice(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-admin-token"] = token;
      const res = await fetch("/api/booking/admin/settings", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          startTime: startHourInput,
          endTime: endHourInput,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSettingsNotice(data.message);
        setWorkingHours({ startTime: startHourInput, endTime: endHourInput });
        setTimeout(() => setSettingsNotice(null), 3000);
      } else {
        alert(data.error || "Failed to save working hours");
      }
    } catch {
      alert("Network error saving working hours");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 8. Add Holiday
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName.trim()) return;
    setIsAddingHoliday(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-admin-token"] = token;
      const res = await fetch("/api/booking/admin/holidays", {
        method: "POST",
        headers,
        body: JSON.stringify({
          holidayDate: newHolidayDate,
          name: newHolidayName.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHolidayNotice(`Added holiday: ${newHolidayName}`);
        setNewHolidayDate("");
        setNewHolidayName("");
        fetchData();
        setTimeout(() => setHolidayNotice(null), 3000);
      } else {
        alert(data.error || "Failed to add holiday");
      }
    } catch {
      alert("Network error adding holiday");
    } finally {
      setIsAddingHoliday(false);
    }
  };

  // 9. Delete Holiday
  const handleDeleteHoliday = async (holidayId: number) => {
    if (!confirm("Remove this clinic closure holiday?")) return;
    try {
      const headers: Record<string, string> = {};
      if (token) headers["x-admin-token"] = token;
      const res = await fetch(`/api/booking/admin/holidays?id=${holidayId}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (res.ok && data.success) fetchData();
      else alert(data.error || "Failed to delete holiday");
    } catch {
      alert("Error deleting holiday");
    }
  };

  // Inline Tier Price Save
  const handleSaveTierPrice = async (tierId: number) => {
    const numericPrice = parseFloat(editPrice);
    if (isNaN(numericPrice) || numericPrice <= 0) return;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-admin-token"] = token;
      const res = await fetch("/api/booking/admin/services", {
        method: "PUT",
        headers,
        body: JSON.stringify({ tierId, price: numericPrice }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingTierId(null);
        fetchData();
      } else {
        alert(data.error || "Failed to update price");
      }
    } catch {
      alert("Network error");
    }
  };

  // If unauthenticated: Login Gate
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "#f8fafc" }}>
        <div style={{ width: "100%", maxWidth: 440, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 36, boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)" }} className="animate-fade-in">
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f1f8e9", border: "2px solid #689f38", color: "#689f38", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Shield size={28} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b" }}>Admin Practitioner Portal</h2>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
              YYC Reflexology Clinic • Calgary, AB
            </p>
          </div>

          {authError && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#b91c1c", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 18, fontWeight: 500 }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="admin-username">
                Username / Email
              </label>
              <input
                id="admin-username"
                type="text"
                placeholder="info@yycreflexology.ca"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className={styles.formInput}
                required
                autoFocus
              />
            </div>

            <div className={styles.formGroup} style={{ marginTop: 14 }}>
              <label className={styles.formLabel} htmlFor="admin-pass">
                Password
              </label>
              <input
                id="admin-pass"
                type="password"
                placeholder="••••••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className={styles.formInput}
                required
              />
            </div>

            <button
              type="submit"
              className={styles.btnPrimary}
              style={{
                width: "100%",
                justifyContent: "center",
                marginTop: 20,
                backgroundColor: "#7cb342",
                color: "#ffffff",
                fontWeight: 700,
                padding: "12px",
                borderRadius: 8,
              }}
              id="admin-login-submit"
            >
              Sign In to Admin Dashboard
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Link href="/" style={{ fontSize: 13, color: "#689f38", textDecoration: "none", fontWeight: 600 }}>
              ← Return to Public Booking Site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", width: "100%" }}>
      {/* Top Navbar */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 24, borderBottom: "1px solid var(--border-subtle)", marginBottom: 32 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ padding: "4px 10px", borderRadius: 20, background: "var(--accent-teal-subtle)", color: "var(--accent-teal-glow)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
              Practitioner Workspace
            </span>
            <span style={{ fontSize: 12, color: "#38bdf8", display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={12} />
              Mountain Time ({workingHours.startTime} - {workingHours.endTime} MT)
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>
            YYC Reflexology Admin Dashboard
          </h1>
          <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <MapPin size={12} />
            10880 Hidden Valley DR NW Calgary
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" target="_blank" className={styles.btnSecondary} style={{ fontSize: 13, padding: "8px 16px" }}>
            <ExternalLink size={14} />
            Client View
          </Link>
          <button type="button" className={styles.btnSecondary} onClick={fetchData} style={{ fontSize: 13, padding: "8px 16px" }} title="Refresh database records">
            <RefreshCw size={14} className={loading ? "spinner" : ""} />
            Refresh
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => setIsQuickBlockOpen(true)} id="open-quick-block-btn" style={{ fontSize: 13, padding: "8px 18px", background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", borderColor: "#fbbf24" }}>
            <Plus size={14} />
            Quick Time-Block
          </button>
          <button type="button" className={styles.btnSecondary} onClick={handleLogout} style={{ fontSize: 13, padding: "8px 14px", color: "#fb7185" }} title="Log out">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28, borderBottom: "1px solid #e2e8f0", paddingBottom: 12, overflowX: "auto" }}>
        <button
          type="button"
          onClick={() => setActiveTab("appointments")}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            background: activeTab === "appointments" ? "#f1f8e9" : "#ffffff",
            color: activeTab === "appointments" ? "#558b2f" : "#475569",
            border: activeTab === "appointments" ? "1px solid #c5e1a5" : "1px solid #e2e8f0",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
          id="tab-appointments"
        >
          <UserCheck size={16} />
          Patient Bookings ({appointments.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("schedule")}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            background: activeTab === "schedule" ? "#f1f8e9" : "#ffffff",
            color: activeTab === "schedule" ? "#558b2f" : "#475569",
            border: activeTab === "schedule" ? "1px solid #c5e1a5" : "1px solid #e2e8f0",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
          id="tab-schedule"
        >
          <Calendar size={16} />
          Schedule & Blocks ({blocks.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("services")}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            background: activeTab === "services" ? "#f1f8e9" : "#ffffff",
            color: activeTab === "services" ? "#558b2f" : "#475569",
            border: activeTab === "services" ? "1px solid #c5e1a5" : "1px solid #e2e8f0",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
          id="tab-services"
        >
          <DollarSign size={16} />
          Services & Custom Tiers ({services.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            background: activeTab === "settings" ? "#f1f8e9" : "#ffffff",
            color: activeTab === "settings" ? "#558b2f" : "#475569",
            border: activeTab === "settings" ? "1px solid #c5e1a5" : "1px solid #e2e8f0",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
          id="tab-settings"
        >
          <Settings size={16} />
          Working Hours & Holidays
        </button>
      </div>

      {/* TAB 1: Appointments List */}
      {activeTab === "appointments" && (
        <div className="animate-fade-in">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Confirmed Patient Bookings</h2>
              <p style={{ fontSize: 13, color: "#64748b" }}>
                View client intake details and manage appointment cancellations with automated mail alerts.
              </p>
            </div>
          </div>

          {appointments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", background: "#ffffff", borderRadius: 12, border: "1px dashed #cbd5e1" }}>
              <UserCheck size={36} style={{ margin: "0 auto 12px", opacity: 0.7, color: "#689f38" }} />
              <h3 style={{ fontSize: 16, color: "#1e293b", marginBottom: 4, fontWeight: 700 }}>No Bookings Yet</h3>
              <p style={{ fontSize: 13, color: "#64748b", maxWidth: 360, margin: "0 auto" }}>
                Appointments booked through the client modal will appear here in real-time.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {appointments.map((appt) => {
                const isCancelled = appt.status === "CANCELLED";
                const sDate = new Date(appt.startTime);
                const refCode = appt.referenceNumber || `#${appt.id}`;

                return (
                  <div
                    key={appt.id}
                    style={{
                      background: isCancelled ? "#fff1f2" : "#ffffff",
                      border: `1px solid ${isCancelled ? "#fecdd3" : "#e2e8f0"}`,
                      borderRadius: 12,
                      padding: "20px 24px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 20,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 6, background: "#f1f5f9", color: "#0f172a", border: "1px solid #cbd5e1", letterSpacing: 0.5 }}>
                          Ref: {refCode}
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                          {appt.clientName}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: 12,
                            background: isCancelled ? "#fee2e2" : "#dcfce7",
                            color: isCancelled ? "#b91c1c" : "#15803d",
                            border: `1px solid ${isCancelled ? "#fca5a5" : "#bbf7d0"}`
                          }}
                        >
                          {appt.status}
                        </span>
                      </div>

                      <div style={{ fontSize: 13, color: "#475569", display: "flex", flexWrap: "wrap", gap: 16 }}>
                        <span>
                          <strong style={{ color: "#1e293b" }}>Service:</strong> {appt.serviceName} ({appt.durationMinutes}m)
                        </span>
                        <span>
                          <strong style={{ color: "#1e293b" }}>Date & Time:</strong> {format(sDate, "EEE, MMM d, yyyy")} at {format(sDate, "h:mm a")} MT
                        </span>
                        <span>
                          <strong style={{ color: "#1e293b" }}>Fee:</strong> ${Number(appt.totalPrice).toFixed(2)} {appt.currency}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, display: "flex", flexWrap: "wrap", gap: 16 }}>
                        <span>📧 {appt.clientEmail}</span>
                        <span>📞 {appt.clientPhone}</span>
                        <span>📍 {appt.clientAddress}</span>
                      </div>

                      {isCancelled && appt.cancellationReason && (
                        <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c", background: "#fee2e2", border: "1px solid #fca5a5", padding: "6px 12px", borderRadius: 6 }}>
                          Cancellation Reason: {appt.cancellationReason}
                        </div>
                      )}
                    </div>

                    <div>
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => {
                            setCancellingBookingId(appt.id);
                            setCancelReason("Practitioner schedule conflict");
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            background: "#fff1f2",
                            border: "1px solid #fecdd3",
                            color: "#e11d48",
                            fontSize: 13,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            cursor: "pointer"
                          }}
                          id={`cancel-booking-btn-${appt.id}`}
                        >
                          <XCircle size={14} />
                          Cancel Appointment
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Schedule & Time Blocks View */}
      {activeTab === "schedule" && (
        <div className="animate-fade-in">
          <CalendarScheduleView blocks={blocks} onDeleteBlock={handleDeleteBlock} />
        </div>
      )}

      {/* TAB 3: Services & Custom Tiers Manager */}
      {activeTab === "services" && (
        <div className="animate-fade-in">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Clinical Services & Custom Duration Tiers</h2>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Add new therapeutic services, create custom duration time slots (30m, 45m, 60m, 75m, etc.), and adjust fees.
              </p>
            </div>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setIsAddServiceOpen(true)}
              id="open-add-service-btn"
              style={{ fontSize: 13, padding: "8px 18px" }}
            >
              <Plus size={14} />
              Add New Service
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {services.map((service) => (
              <div
                key={service.id}
                style={{
                  background: "rgba(15, 23, 42, 0.7)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: 24,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>{service.name}</h3>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, maxWidth: 600 }}>
                      {service.description || "No description provided."}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => {
                        setTargetServiceId(service.id);
                        setIsAddTierOpen(true);
                      }}
                      style={{ fontSize: 12, padding: "6px 14px", color: "var(--accent-teal-glow)", borderColor: "var(--accent-teal)" }}
                      id={`add-tier-btn-${service.id}`}
                    >
                      <Plus size={12} />
                      Add Custom Duration
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => handleDeleteService(service.id)}
                      style={{ fontSize: 12, padding: "6px 12px", color: "#fb7185" }}
                      title="Remove service"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Duration Tiers Table */}
                <div style={{ background: "rgba(10, 15, 29, 0.6)", borderRadius: 10, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                        <th style={{ padding: "10px 16px" }}>Duration (Minutes)</th>
                        <th style={{ padding: "10px 16px" }}>Clinical Fee</th>
                        <th style={{ padding: "10px 16px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {service.tiers.map((tier) => {
                        const isEditing = editingTierId === tier.id;
                        return (
                          <tr key={tier.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                            <td style={{ padding: "12px 16px", fontWeight: 600, color: "#fff" }}>
                              <Clock size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 6, color: "var(--accent-teal-glow)" }} />
                              {tier.durationMinutes} Minutes
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              {isEditing ? (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span>$</span>
                                  <input
                                    type="number"
                                    value={editPrice}
                                    onChange={(e) => setEditPrice(e.target.value)}
                                    style={{ width: "70px", padding: "4px 8px", background: "#000", border: "1px solid var(--accent-teal)", borderRadius: 6, color: "#fff", fontSize: 12 }}
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveTierPrice(tier.id)}
                                    style={{ padding: "4px 8px", background: "var(--accent-teal)", color: "#fff", borderRadius: 4, fontSize: 11, fontWeight: 700 }}
                                  >
                                    Save
                                  </button>
                                </div>
                              ) : (
                                <span
                                  onClick={() => {
                                    setEditingTierId(tier.id);
                                    setEditPrice(tier.price.toString());
                                  }}
                                  style={{ cursor: "pointer", color: "var(--accent-teal-glow)", fontWeight: 700 }}
                                  title="Click to edit fee"
                                >
                                  ${Number(tier.price).toFixed(2)} {tier.currency} <Edit3 size={11} style={{ verticalAlign: "middle", opacity: 0.6 }} />
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right" }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteTier(tier.id)}
                                style={{ padding: "4px 8px", color: "#fb7185", opacity: 0.8, cursor: "pointer" }}
                                title="Delete tier"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Working Hours & Holidays Management */}
      {activeTab === "settings" && (
        <div className="animate-fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Working Hours Editor */}
          <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 8, borderRadius: 8, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                <Clock size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>Clinic Operating Hours</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Defines the daily operating window for appointment slot calculations (Mountain Time).
                </p>
              </div>
            </div>

            {settingsNotice && (
              <div style={{ background: "rgba(20, 184, 166, 0.15)", color: "var(--accent-teal-glow)", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                <Check size={14} />
                {settingsNotice}
              </div>
            )}

            <form onSubmit={handleSaveWorkingHours}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Clinic Start Time (MT)</label>
                  <input
                    type="time"
                    value={startHourInput}
                    onChange={(e) => setStartHourInput(e.target.value)}
                    className={styles.formInput}
                    required
                    id="settings-start-time"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Clinic End Time (MT)</label>
                  <input
                    type="time"
                    value={endHourInput}
                    onChange={(e) => setEndHourInput(e.target.value)}
                    className={styles.formInput}
                    required
                    id="settings-end-time"
                  />
                </div>
              </div>

              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={isSavingSettings}
                id="save-settings-btn"
                style={{ width: "100%", justifyContent: "center" }}
              >
                {isSavingSettings ? <Loader2 size={16} className="spinner" /> : "Save Operating Hours"}
              </button>
            </form>
          </div>

          {/* Holidays & Closure Days Calendar */}
          <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 8, borderRadius: 8, background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                <Palmtree size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>Holidays & Clinic Closures</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Scheduled dates automatically close availability and show holiday notices.
                </p>
              </div>
            </div>

            {holidayNotice && (
              <div style={{ background: "rgba(20, 184, 166, 0.15)", color: "var(--accent-teal-glow)", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
                {holidayNotice}
              </div>
            )}

            {/* Add Holiday Form */}
            <form onSubmit={handleAddHoliday} style={{ marginBottom: 20, background: "rgba(255, 255, 255, 0.02)", padding: 14, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Closure Date
                  </label>
                  <input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className={styles.formInput}
                    style={{ padding: "8px 12px", fontSize: 13 }}
                    required
                    id="holiday-date-input"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Holiday / Closure Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Christmas Day"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className={styles.formInput}
                    style={{ padding: "8px 12px", fontSize: 13 }}
                    required
                    id="holiday-name-input"
                  />
                </div>
              </div>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={isAddingHoliday}
                id="add-holiday-btn"
                style={{ width: "100%", justifyContent: "center", padding: "8px", fontSize: 13, background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", borderColor: "#fbbf24" }}
              >
                {isAddingHoliday ? <Loader2 size={14} className="spinner" /> : "+ Add Holiday Closure"}
              </button>
            </form>

            {/* Holidays List */}
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {holidays.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
                  No holidays scheduled. The clinic operates according to normal weekly hours.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {holidays.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, color: "#fff" }}>{h.holidayDate}</span>
                        <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{h.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(h.id)}
                        style={{ color: "#fb7185", opacity: 0.8, cursor: "pointer" }}
                        title="Delete holiday"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Block Modal */}
      <QuickBlockModal
        isOpen={isQuickBlockOpen}
        onClose={() => setIsQuickBlockOpen(false)}
        onBlockCreated={fetchData}
        adminToken={token}
      />

      {/* Cancellation Dialog */}
      {cancellingBookingId && (
        <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && setCancellingBookingId(null)}>
          <div style={{ background: "var(--bg-card)", border: "1px solid rgba(244, 63, 94, 0.4)", borderRadius: "var(--radius-lg)", padding: 32, width: "100%", maxWidth: 480 }} className="animate-fade-in">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ padding: 8, borderRadius: 8, background: "rgba(244, 63, 94, 0.15)", color: "#fb7185" }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                  Cancel Appointment #{cancellingBookingId}
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  This will release the time block and email cancellation notices to the patient.
                </p>
              </div>
            </div>

            {cancelError && (
              <div style={{ background: "rgba(244, 63, 94, 0.15)", color: "#fb7185", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
                {cancelError}
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Mandatory Cancellation Reason</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Practitioner clinical emergency, schedule reschedule required"
                className={styles.formTextarea}
                rows={3}
                id="cancel-reason-textarea"
                required
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
              <button type="button" className={styles.btnSecondary} onClick={() => setCancellingBookingId(null)} disabled={isCancelling}>
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                id="confirm-cancel-appointment-btn"
                style={{ padding: "10px 20px", borderRadius: 8, background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)", border: "1px solid #f43f5e", color: "#fff", fontWeight: 700, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                {isCancelling ? <Loader2 size={15} className="spinner" /> : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {isAddServiceOpen && (
        <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && setIsAddServiceOpen(false)}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-active)", borderRadius: "var(--radius-lg)", padding: 32, width: "100%", maxWidth: 480 }} className="animate-fade-in">
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Add New Clinical Service</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Create a new therapeutic discipline in your clinic catalog.
            </p>

            <form onSubmit={handleCreateService}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Service Name *</label>
                <input
                  type="text"
                  placeholder="e.g. CranioSacral Reflexology"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className={styles.formInput}
                  required
                  id="new-service-name-input"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Clinical Description</label>
                <textarea
                  placeholder="Brief clinical description of what this session involves..."
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                  className={styles.formTextarea}
                  rows={3}
                  id="new-service-desc-input"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsAddServiceOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={isAddingService} id="submit-new-service-btn">
                  {isAddingService ? <Loader2 size={15} className="spinner" /> : "Create Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Tier Modal */}
      {isAddTierOpen && (
        <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && setIsAddTierOpen(false)}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-active)", borderRadius: "var(--radius-lg)", padding: 32, width: "100%", maxWidth: 440 }} className="animate-fade-in">
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Add Custom Duration Tier</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Add any custom time slot (e.g. 15m, 30m, 45m, 60m, 75m, 90m, 120m) and set its price.
            </p>

            <form onSubmit={handleAddCustomTier}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Duration (Minutes) *</label>
                <input
                  type="number"
                  min="5"
                  max="360"
                  step="5"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  className={styles.formInput}
                  required
                  id="custom-duration-input"
                />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Examples: 15, 30, 45, 60, 75, 90, 120 minutes
                </p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Price (CAD) *</label>
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className={styles.formInput}
                  required
                  id="custom-price-input"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsAddTierOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={isAddingTier} id="submit-custom-tier-btn">
                  {isAddingTier ? <Loader2 size={15} className="spinner" /> : "Add Duration Tier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
