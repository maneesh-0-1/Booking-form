import { NextRequest, NextResponse } from "next/server";
import { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SECRET_KEY, ADMIN_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    const isValidUser = username && username.trim().toLowerCase() === ADMIN_USERNAME.trim().toLowerCase();
    const isValidPass = password && password === ADMIN_PASSWORD;

    if (!isValidUser || !isValidPass) {
      return NextResponse.json(
        { success: false, error: "Invalid admin username or password" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      token: ADMIN_SECRET_KEY,
      message: "Authenticated successfully",
    });

    // Set secure HTTP-only cookie
    response.cookies.set(ADMIN_COOKIE_NAME, ADMIN_SECRET_KEY, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Authentication request failed" },
      { status: 500 }
    );
  }
}
