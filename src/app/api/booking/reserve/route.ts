import { NextRequest, NextResponse } from "next/server";
import { BookingIntakeSchema } from "@/lib/validation";
import { getTierById, createBookingWithLock } from "@/lib/db";
import { addMinutes } from "date-fns";
import { sendBookingNotifications } from "@/lib/mailer";

import { parseClinicDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parseResult = BookingIntakeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { serviceTierId, clientName, clientEmail, clientPhone, clientAddress, startTime: startTimeStr } =
      parseResult.data;

    // Validate tier
    const tier = await getTierById(serviceTierId);
    if (!tier) {
      return NextResponse.json(
        { success: false, error: "Requested service tier does not exist" },
        { status: 404 }
      );
    }

    const startTime = parseClinicDateTime(startTimeStr);
    if (isNaN(startTime.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid start time timestamp" },
        { status: 400 }
      );
    }

    const endTime = addMinutes(startTime, tier.durationMinutes);

    // Concurrency-safe reservation with database row locking
    const reserveResult = await createBookingWithLock({
      serviceTierId,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      startTime,
      endTime,
      totalPrice: tier.price,
    });

    if (reserveResult.conflict) {
      return NextResponse.json(
        {
          success: false,
          conflict: true,
          error: reserveResult.error || "This time slot was just reserved by another patient. Please choose another slot.",
        },
        { status: 409 }
      );
    }

    if (!reserveResult.success || !reserveResult.bookingId) {
      return NextResponse.json(
        {
          success: false,
          error: reserveResult.error || "Failed to finalize booking transaction",
        },
        { status: 500 }
      );
    }

    const bookingId = reserveResult.bookingId;

    // Asynchronous notification offload (never blocks client response)
    const emailData = {
      bookingId,
      serviceName: tier.serviceName,
      durationMinutes: tier.durationMinutes,
      totalPrice: tier.price,
      currency: tier.currency,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      startTime,
      endTime,
    };

    // Fire and forget
    sendBookingNotifications(emailData).catch((err) => {
      console.error("[Async Mailer Error]", err);
    });

    return NextResponse.json(
      {
        success: true,
        booking: {
          id: bookingId,
          serviceName: tier.serviceName,
          durationMinutes: tier.durationMinutes,
          totalPrice: tier.price,
          currency: tier.currency,
          clientName,
          clientEmail,
          clientPhone,
          clientAddress,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          status: "CONFIRMED",
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[API Reserve Error]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error during reservation" },
      { status: 500 }
    );
  }
}
