import nodemailer from "nodemailer";
import { format } from "date-fns";

export interface BookingEmailData {
  bookingId: number;
  referenceNumber?: string;
  serviceName: string;
  durationMinutes: number;
  totalPrice: number | string;
  currency: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  startTime: Date;
  endTime: Date;
  cancellationReason?: string;
}

const CLINIC_NAME = process.env.CLINIC_NAME || "YYC Reflexology Clinic";
const CLINIC_ADDRESS = process.env.CLINIC_ADDRESS || "10880 Hidden Valley DR NW Calgary";
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "bookings@yycreflexology.ca";

// Create reusable Nodemailer transporter matching cPanel specifications
export function createMailTransporter() {
  const host = process.env.SMTP_HOST || "mail.yycreflexology.ca";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER || "bookings@yycreflexology.ca";
  const pass = process.env.SMTP_PASS || "";

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true", // false for 587 STARTTLS
    auth: user && pass ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: false, // Bypass self-signed or shared host verification issues on cPanel VPS
    },
  });
}

/**
 * Generates RFC 5545 iCalendar (.ics) content for email attachments
 */
export function generateIcsContent(
  data: BookingEmailData,
  method: "REQUEST" | "CANCEL" = "REQUEST"
): string {
  const startUtc = data.startTime.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const endUtc = data.endTime.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const nowUtc = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const refCode = data.referenceNumber || `ID-${data.bookingId}`;
  const uid = `booking-${refCode}-${startUtc}@yycreflexology.ca`;

  const status = method === "CANCEL" ? "CANCELLED" : "CONFIRMED";
  const sequence = method === "CANCEL" ? "1" : "0";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YYC Reflexology Clinic//Booking Engine//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SEQUENCE:${sequence}`,
    `STATUS:${status}`,
    `SUMMARY:${method === "CANCEL" ? "CANCELLED: " : ""}${data.serviceName} [${refCode}] - ${CLIC_SUMMARY(data)}`,
    `DESCRIPTION:${CLIC_DESCRIPTION(data, method)}`,
    `LOCATION:${CLINIC_ADDRESS}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder: Upcoming Reflexology Appointment",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function CLIC_SUMMARY(data: BookingEmailData): string {
  return `${CLINIC_NAME} (${data.durationMinutes} min)`;
}

function CLIC_DESCRIPTION(data: BookingEmailData, method: "REQUEST" | "CANCEL"): string {
  const refCode = data.referenceNumber || `#${data.bookingId}`;
  if (method === "CANCEL") {
    return `Appointment Cancelled (Ref: ${refCode}).\\nReason: ${data.cancellationReason || "Practitioner schedule change"}\\nFor questions, contact ${ADMIN_EMAIL}.`;
  }
  return `Reference: ${refCode}\\nService: ${data.serviceName}\\nDuration: ${data.durationMinutes} mins\\nTotal: $${Number(data.totalPrice).toFixed(2)} ${data.currency}\\nPatient: ${data.clientName}\\nPhone: ${data.clientPhone}\\nClinic: ${CLINIC_ADDRESS}`;
}

/**
 * Sends transaction-safe confirmation emails to both client and practitioner
 */
export async function sendBookingNotifications(data: BookingEmailData): Promise<void> {
  try {
    const transporter = createMailTransporter();
    const icsContent = generateIcsContent(data, "REQUEST");
    const formattedDate = format(data.startTime, "EEEE, MMMM d, yyyy");
    const formattedTime = format(data.startTime, "h:mm a");
    const refCode = data.referenceNumber || `#${data.bookingId}`;

    // 1. Client Confirmation
    const clientHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #1e293b, #334155); padding: 32px 24px; color: #ffffff; text-align: center;">
          <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">${CLINIC_NAME}</h1>
          <p style="margin: 0; opacity: 0.9; font-size: 15px; font-weight: 600; letter-spacing: 0.5px;">Appointment Reference: <span style="color: #86efac;">${refCode}</span></p>
        </div>
        <div style="padding: 28px 24px;">
          <p style="font-size: 16px; margin-top: 0;">Dear <strong>${data.clientName}</strong>,</p>
          <p style="color: #475569; line-height: 1.6;">Your clinical reflexology appointment has been confirmed. Below are your appointment and reference details:</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Reference Number:</td>
                <td style="padding: 6px 0; font-weight: 800; text-align: right; color: #15803d; font-size: 15px;">${refCode}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Service:</td>
                <td style="padding: 6px 0; font-weight: 600; text-align: right;">${data.serviceName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Duration:</td>
                <td style="padding: 6px 0; font-weight: 600; text-align: right;">${data.durationMinutes} Minutes</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Date:</td>
                <td style="padding: 6px 0; font-weight: 600; text-align: right;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Time:</td>
                <td style="padding: 6px 0; font-weight: 600; text-align: right;">${formattedTime} (Mountain Time)</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Clinic Location:</td>
                <td style="padding: 6px 0; font-weight: 600; text-align: right;">${CLINIC_ADDRESS}</td>
              </tr>
              <tr style="border-top: 1px solid #cbd5e1;">
                <td style="padding: 10px 0 0; color: #0f172a; font-weight: 700; font-size: 16px;">Total Fee:</td>
                <td style="padding: 10px 0 0; color: #15803d; font-weight: 700; font-size: 16px; text-align: right;">$${Number(data.totalPrice).toFixed(2)} ${data.currency}</td>
              </tr>
            </table>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #166534; margin-bottom: 20px;">
            ℹ️ A calendar invite (<strong>.ics</strong>) is attached to this email. Opening it will automatically add this appointment to your Google Calendar, Apple Calendar, or Outlook.
          </div>

          <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 0;">
            <strong>Cancellation Policy:</strong> Please provide at least 24 hours advance notice if you need to reschedule or cancel your appointment.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b;">
          ${CLINIC_NAME} • ${CLINIC_ADDRESS} • ${ADMIN_EMAIL}
        </div>
      </div>
    `;

    // 2. Doctor / Practitioner Alert
    const doctorHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #1e293b; padding: 24px; color: #ffffff;">
          <h2 style="margin: 0 0 6px 0; font-size: 20px;">New Booking Confirmed [Ref: ${refCode}]</h2>
          <p style="margin: 0; opacity: 0.85; font-size: 13px;">${formattedDate} at ${formattedTime}</p>
        </div>
        <div style="padding: 24px;">
          <h3 style="margin-top: 0; color: #334155; font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Patient Intake</h3>
          <p><strong>Reference:</strong> ${refCode}</p>
          <p><strong>Name:</strong> ${data.clientName}</p>
          <p><strong>Email:</strong> <a href="mailto:${data.clientEmail}">${data.clientEmail}</a></p>
          <p><strong>Phone:</strong> <a href="tel:${data.clientPhone}">${data.clientPhone}</a></p>
          <p><strong>Address:</strong> ${data.clientAddress}</p>
          
          <h3 style="color: #334155; font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px;">Service Information</h3>
          <p><strong>Service:</strong> ${data.serviceName}</p>
          <p><strong>Duration:</strong> ${data.durationMinutes} Minutes</p>
          <p><strong>Amount:</strong> $${Number(data.totalPrice).toFixed(2)} ${data.currency}</p>
        </div>
      </div>
    `;

    // Dispatch concurrently and log result
    console.log(`[Mailer] Dispatching confirmation emails for ${refCode} to ${data.clientEmail} and ${ADMIN_EMAIL}...`);
    const results = await Promise.allSettled([
      transporter.sendMail({
        from: `"${CLINIC_NAME}" <${ADMIN_EMAIL}>`,
        to: data.clientEmail,
        subject: `Booking Confirmed [Ref: ${refCode}]: ${data.serviceName} on ${formattedDate}`,
        html: clientHtml,
        icalEvent: {
          filename: `reflexology-appointment-${refCode}.ics`,
          method: "REQUEST",
          content: icsContent,
        },
      }),
      transporter.sendMail({
        from: `"${CLINIC_NAME} System" <${ADMIN_EMAIL}>`,
        to: ADMIN_EMAIL,
        subject: `[New Patient - Ref: ${refCode}] ${data.clientName} - ${formattedDate} ${formattedTime}`,
        html: doctorHtml,
        icalEvent: {
          filename: `reflexology-appointment-${refCode}.ics`,
          method: "REQUEST",
          content: icsContent,
        },
      }),
    ]);

    results.forEach((res, idx) => {
      const recipient = idx === 0 ? `Patient (${data.clientEmail})` : `Practitioner (${ADMIN_EMAIL})`;
      if (res.status === "fulfilled") {
        console.log(`[Mailer Success] Sent to ${recipient}, messageId: ${res.value.messageId}`);
      } else {
        console.error(`[Mailer Failure] Failed to send to ${recipient}:`, res.reason);
      }
    });
  } catch (err) {
    console.error("[Mailer] Notice: Failed to dispatch confirmation emails:", err);
  }
}

/**
 * Sends cancellation notifications with updated .ics status
 */
export async function sendCancellationNotifications(data: BookingEmailData): Promise<void> {
  try {
    const transporter = createMailTransporter();
    const icsContent = generateIcsContent(data, "CANCEL");
    const formattedDate = format(data.startTime, "EEEE, MMMM d, yyyy");
    const formattedTime = format(data.startTime, "h:mm a");

    const clientHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #ffffff; border: 1px solid #fee2e2; border-radius: 12px; overflow: hidden;">
        <div style="background: #991b1b; padding: 24px; color: #ffffff; text-align: center;">
          <h1 style="margin: 0 0 6px; font-size: 22px;">Appointment Cancelled</h1>
          <p style="margin: 0; opacity: 0.9; font-size: 14px;">Booking #${data.bookingId}</p>
        </div>
        <div style="padding: 24px;">
          <p>Dear <strong>${data.clientName}</strong>,</p>
          <p>Your upcoming appointment for <strong>${data.serviceName}</strong> scheduled on <strong>${formattedDate} at ${formattedTime}</strong> has been cancelled.</p>
          
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #991b1b;">
              <strong>Reason from Clinic:</strong><br />
              ${data.cancellationReason || "Practitioner schedule adjustment"}
            </p>
          </div>

          <p>The updated calendar event is attached to sync with your calendar.</p>
          <p style="margin-bottom: 0;">To reschedule at your convenience, please visit our booking portal or contact us directly at ${ADMIN_EMAIL}.</p>
        </div>
        <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b;">
          ${CLINIC_NAME} • ${CLINIC_ADDRESS}
        </div>
      </div>
    `;

    const doctorHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h3 style="color: #991b1b;">Appointment #${data.bookingId} Cancelled</h3>
        <p>Patient: ${data.clientName} (${data.clientEmail})</p>
        <p>Slot: ${formattedDate} at ${formattedTime}</p>
        <p>Reason: ${data.cancellationReason}</p>
        <p><em>The slot has been released back into open inventory.</em></p>
      </div>
    `;

    await Promise.allSettled([
      transporter.sendMail({
        from: `"${CLINIC_NAME}" <${ADMIN_EMAIL}>`,
        to: data.clientEmail,
        subject: `Cancelled: ${data.serviceName} on ${formattedDate}`,
        html: clientHtml,
        icalEvent: {
          filename: `reflexology-cancelled-${data.bookingId}.ics`,
          method: "CANCEL",
          content: icsContent,
        },
      }),
      transporter.sendMail({
        from: `"${CLINIC_NAME} Engine" <${ADMIN_EMAIL}>`,
        to: ADMIN_EMAIL,
        subject: `[Cancelled] Slot Released #${data.bookingId} - ${formattedDate}`,
        html: doctorHtml,
      }),
    ]);
  } catch (err) {
    console.error("[Mailer] Notice: Failed to dispatch cancellation emails:", err);
  }
}
