import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedAdmin } from "@/lib/auth";
import { cancelBooking } from "@/lib/db";
import { CancelAppointmentSchema } from "@/lib/validation";
import { sendCancellationNotifications } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticatedAdmin(req))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const bookingId = parseInt(id, 10);

    if (isNaN(bookingId)) {
      return NextResponse.json({ success: false, error: "Invalid booking ID" }, { status: 400 });
    }

    const body = await req.json();
    const parseResult = CancelAppointmentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { reason } = parseResult.data;
    const result = await cancelBooking(bookingId, reason);

    if (!result.success || !result.booking) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to cancel appointment" },
        { status: 404 }
      );
    }

    // Fire-and-forget cancellation emails with cancelled .ics calendar event
    sendCancellationNotifications(result.booking).catch((err) => {
      console.error("[Async Cancellation Mailer Error]", err);
    });

    return NextResponse.json({
      success: true,
      message: `Appointment #${bookingId} has been cancelled and its time slot released`,
      booking: result.booking,
    });
  } catch (error: any) {
    console.error("[API Cancel Booking Error]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
