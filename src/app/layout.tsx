import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YYC Reflexology Clinic | Appointment & Scheduling",
  description:
    "Self-hosted appointment scheduling engine for YYC Reflexology Clinic in Calgary, Alberta. Real-time availability, transaction-safe booking, and instant calendar synchronization.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
