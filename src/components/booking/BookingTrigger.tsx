"use client";

import React, { useState } from "react";
import { BookingModal } from "./BookingModal";
import { Calendar } from "lucide-react";

interface BookingTriggerProps {
  label?: string;
  className?: string;
  variant?: "primary" | "nav" | "compact";
  id?: string;
}

export const BookingTrigger: React.FC<BookingTriggerProps> = ({
  label = "Book Now",
  className = "",
  variant = "primary",
  id = "open-booking-modal-btn",
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const isNav = variant === "nav";

  return (
    <>
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen(true)}
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: isNav ? "10px 22px" : "14px 28px",
          borderRadius: "6px",
          backgroundColor: "#7cb342",
          color: "#0f2402",
          fontSize: isNav ? "14px" : "15px",
          fontWeight: "700",
          border: "none",
          boxShadow: "0 2px 6px rgba(104, 159, 56, 0.2)",
          cursor: "pointer",
          transition: "all 0.15s ease-in-out",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#689f38";
          e.currentTarget.style.color = "#ffffff";
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 4px 10px rgba(104, 159, 56, 0.3)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#7cb342";
          e.currentTarget.style.color = "#0f2402";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 2px 6px rgba(104, 159, 56, 0.2)";
        }}
      >
        <Calendar size={16} />
        <span>{label}</span>
      </button>

      <BookingModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
