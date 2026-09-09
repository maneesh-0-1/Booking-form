import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "info@yycreflexology.ca";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "YYCreFlexology@CA";
export const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || "yyc_secret_practitioner_key_2026";
export const ADMIN_COOKIE_NAME = "yyc_admin_auth";

/**
 * Checks if the request is from an authenticated doctor/admin
 */
export async function isAuthenticatedAdmin(req?: NextRequest): Promise<boolean> {
  // 1. Check custom header x-admin-token
  if (req) {
    const headerToken = req.headers.get("x-admin-token");
    if (headerToken && headerToken === ADMIN_SECRET_KEY) {
      return true;
    }

    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const bearerToken = authHeader.substring(7);
      if (bearerToken === ADMIN_SECRET_KEY) {
        return true;
      }
    }

    const cookieToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (cookieToken && cookieToken === ADMIN_SECRET_KEY) {
      return true;
    }
  }

  // 2. Try next/headers cookies if available
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (cookieVal && cookieVal === ADMIN_SECRET_KEY) {
      return true;
    }
  } catch {
    // Context may not be within App Router cookie scope
  }

  return false;
}
