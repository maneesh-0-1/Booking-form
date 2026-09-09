import { NextRequest, NextResponse } from "next/server";
import { AvailabilityQuerySchema } from "@/lib/validation";
import { getTimeBlocksForDate, checkIfHoliday, getClinicSettings } from "@/lib/db";
import { computeAvailableSlots, CLINIC_TIMEZONE } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const durationParam = searchParams.get("duration");

    const parseResult = AvailabilityQuerySchema.safeParse({
      date: dateParam,
      duration: durationParam,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { date, duration } = parseResult.data;

    // Check if the requested date is a scheduled clinic holiday
    const holidayCheck = await checkIfHoliday(date);
    if (holidayCheck.isHoliday) {
      return NextResponse.json({
        success: true,
        date,
        durationMinutes: duration,
        timezone: CLINIC_TIMEZONE,
        isHoliday: true,
        holidayName: holidayCheck.holidayName,
        totalSlots: 0,
        availableSlots: [],
        message: `Clinic is closed in observance of ${holidayCheck.holidayName}.`,
      });
    }

    // Fetch dynamic clinic working hours
    const settings = await getClinicSettings();

    // Fetch existing blocked or booked intervals from DB
    const blockedIntervals = await getTimeBlocksForDate(date);

    // Algorithmic discretization & collision detection
    const availableSlots = computeAvailableSlots(date, duration, blockedIntervals, settings);

    return NextResponse.json({
      success: true,
      date,
      durationMinutes: duration,
      timezone: CLINIC_TIMEZONE,
      workingHours: `${settings.startTime} - ${settings.endTime} MT`,
      isHoliday: false,
      totalSlots: availableSlots.length,
      availableSlots,
    });
  } catch (error: any) {
    console.error("[API Availability Error]", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate slot availability" },
      { status: 500 }
    );
  }
}
