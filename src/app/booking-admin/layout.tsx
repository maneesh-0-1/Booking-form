import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Practitioner Portal | YYC Reflexology Scheduling Engine",
  description: "Doctor & Practitioner administrative workspace for YYC Reflexology Clinic.",
};

export default function BookingAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  );
}
