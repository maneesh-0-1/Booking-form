import React from "react";
import { BookingModal } from "@/components/booking/BookingModal";

export const dynamic = "force-dynamic";

export default function EmbedBookingPage() {
  return (
    <main style={{ minHeight: "100vh", width: "100%", margin: 0, padding: 0, background: "#ffffff" }}>
      <BookingModal isOpen={true} isEmbed={true} />
    </main>
  );
}
