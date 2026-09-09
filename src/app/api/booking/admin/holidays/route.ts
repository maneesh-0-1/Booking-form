import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedAdmin } from "@/lib/auth";
import { getClinicHolidays, addClinicHoliday, deleteClinicHoliday } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticatedAdmin(req))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const holidays = await getClinicHolidays();
    return NextResponse.json({ success: true, holidays });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticatedAdmin(req))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { holidayDate, name } = body;

    if (!holidayDate || !/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
      return NextResponse.json(
        { success: false, error: "Holiday date must be YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: "Holiday name must be at least 2 characters" },
        { status: 400 }
      );
    }

    const res = await addClinicHoliday(holidayDate, name.trim());
    return NextResponse.json({
      success: true,
      message: `Holiday '${name}' added for ${holidayDate}`,
      id: res.id,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticatedAdmin(req))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");

    if (!idParam) {
      return NextResponse.json({ success: false, error: "Missing holiday ID" }, { status: 400 });
    }

    const id = parseInt(idParam, 10);
    const deleted = await deleteClinicHoliday(id);

    return NextResponse.json({
      success: deleted,
      message: deleted ? `Holiday #${id} deleted` : "Holiday not found",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
