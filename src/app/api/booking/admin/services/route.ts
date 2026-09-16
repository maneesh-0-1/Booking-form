import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedAdmin } from "@/lib/auth";
import {
  getAllServicesWithTiers,
  updateServiceTierPrice,
  createService,
  deleteService,
  addServiceTier,
  deleteServiceTier,
} from "@/lib/db";
import { UpdateTierPriceSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticatedAdmin(req))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const services = await getAllServicesWithTiers();
    return NextResponse.json({ success: true, services });
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
    const { action } = body;

    // 1. Add New Service
    if (action === "add_service") {
      const { name, description } = body;
      if (!name || name.trim().length < 2) {
        return NextResponse.json(
          { success: false, error: "Service name must be at least 2 characters" },
          { status: 400 }
        );
      }
      const res = await createService({
        name: name.trim(),
        description: description?.trim() || "",
      });
      return NextResponse.json({
        success: true,
        message: "Service created successfully",
        serviceId: res.id,
      });
    }

    // 2. Add Custom Duration Tier (e.g. 15, 30, 45, 60, 75, 90, 120 mins)
    if (action === "add_tier") {
      const { serviceId, durationMinutes, price } = body;
      const parsedDuration = parseInt(durationMinutes, 10);
      const parsedPrice = parseFloat(price);

      if (isNaN(parsedDuration) || parsedDuration < 5 || parsedDuration > 360) {
        return NextResponse.json(
          { success: false, error: "Duration must be between 5 and 360 minutes" },
          { status: 400 }
        );
      }
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return NextResponse.json(
          { success: false, error: "Price must be greater than 0" },
          { status: 400 }
        );
      }

      const res = await addServiceTier({
        serviceId: parseInt(serviceId, 10),
        durationMinutes: parsedDuration,
        price: parsedPrice,
      });

      return NextResponse.json({
        success: true,
        message: `Added ${parsedDuration}m tier ($${parsedPrice.toFixed(2)} CAD)`,
        tierId: res.id,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await isAuthenticatedAdmin(req))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parseResult = UpdateTierPriceSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { tierId, price } = parseResult.data;
    const updated = await updateServiceTierPrice(tierId, price);

    if (!updated) {
      return NextResponse.json({ success: false, error: "Tier not found or unchanged" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Tier #${tierId} fee updated to $${price.toFixed(2)} CAD`,
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
    const type = searchParams.get("type"); // "service" or "tier"
    const idParam = searchParams.get("id");

    if (!idParam) {
      return NextResponse.json({ success: false, error: "Missing id parameter" }, { status: 400 });
    }

    const id = parseInt(idParam, 10);

    if (type === "tier") {
      const deleted = await deleteServiceTier(id);
      return NextResponse.json({
        success: deleted,
        message: deleted ? `Tier #${id} deleted` : "Tier not found",
      });
    }

    if (type === "service") {
      const deleted = await deleteService(id);
      return NextResponse.json({
        success: deleted,
        message: deleted ? `Service #${id} and associated tiers removed` : "Service not found",
      });
    }

    return NextResponse.json({ success: false, error: "Invalid delete type" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
