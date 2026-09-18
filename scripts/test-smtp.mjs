import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

// Parse .env.local manually
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const host = process.env.SMTP_HOST || "mail.yycreflexology.ca";
const port = parseInt(process.env.SMTP_PORT || "587", 10);
const user = process.env.SMTP_USER || "bookings@yycreflexology.ca";
const pass = process.env.SMTP_PASS || "";
const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "info@yycreflexology.ca";

console.log("=== Testing SMTP Connection & Admin Notification ===");
console.log("Host:", host);
console.log("Port:", port);
console.log("User:", user);
console.log("Target Admin Email:", adminEmail);

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: process.env.SMTP_SECURE === "true",
  auth: user && pass ? { user, pass } : undefined,
  tls: {
    rejectUnauthorized: false,
  },
});

async function main() {
  try {
    console.log("\n1. Verifying SMTP connection credentials...");
    await transporter.verify();
    console.log("✅ SMTP Transporter verification SUCCESSFUL!");

    console.log("\n2. Sending dummy test notification to admin (" + adminEmail + ")...");
    const info = await transporter.sendMail({
      from: `"YYC Reflexology Test" <${user}>`,
      to: adminEmail,
      subject: "🧪 Test Notification: Admin Email Connection Check",
      text: `Hello Admin,\n\nThis is a test notification confirming that email notifications are successfully routed to ${adminEmail}.\n\nTimestamp: ${new Date().toISOString()}\n\nYYC Reflexology Booking System`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0d9488; margin-top: 0;">🧪 Admin Notification Test</h2>
          <p>Hello Admin,</p>
          <p>This is an automated test confirming that your booking system's admin notification email is active and receiving alerts properly.</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #0d9488; padding: 12px; margin: 16px 0;">
            <p style="margin: 0; font-size: 14px;"><strong>Target:</strong> ${adminEmail}</p>
            <p style="margin: 4px 0 0 0; font-size: 14px;"><strong>Status:</strong> Connection & Delivery Verified ✅</p>
            <p style="margin: 4px 0 0 0; font-size: 14px;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">YYC Reflexology Clinic Booking System</p>
        </div>
      `,
    });

    console.log("✅ Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);
    console.log("Accepted recipients:", info.accepted);
  } catch (error) {
    console.error("❌ Error testing SMTP email:", error);
    process.exit(1);
  }
}

main();
