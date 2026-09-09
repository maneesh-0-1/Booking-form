import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedAdmin } from "@/lib/auth";
import { getAllTimeBlocks, addPractitionerBlock, deletePractitionerBlock } from "@/lib/db";
import { QuickBlockSchema } from "@/lib/validation";

import { parseClinicDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticatedAdmin(req))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const blocks = await getAllTimeBlocks();
    return NextResponse.json({ success: true, blocks });
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
    const parseResult = QuickBlockSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid block parameters", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { startTime, endTime, reason } = parseResult.data;
    const result = await addPractitionerBlock({
      startTime: parseClinicDateTime(startTime),
      endTime: parseClinicDateTime(endTime),
      reason,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Time slot blocked successfully without dummy client records",
        blockId: result.id,
      },
      { status: 201 }
    );
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
      return NextResponse.json({ success: false, error: "Missing block id parameter" }, { status: 400 });
    }

    const blockId = parseInt(idParam, 10);
    const deleted = await deletePractitionerBlock(blockId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Block not found or is a client booking" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Block #${blockId} deleted and released into availability`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
