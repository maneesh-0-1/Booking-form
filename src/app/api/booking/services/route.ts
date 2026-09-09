import { NextResponse } from "next/server";
import { getAllServicesWithTiers } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const services = await getAllServicesWithTiers();
    return NextResponse.json({
      success: true,
      services,
    });
  } catch (error: any) {
    console.error("[API Services Error]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch services and pricing matrix" },
      { status: 500 }
    );
  }
}
