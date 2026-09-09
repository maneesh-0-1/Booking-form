import mysql, { Pool, PoolConnection } from "mysql2/promise";
import { formatToSqlDateTime, formatToClinicDateStr, parseClinicDateTime } from "./timezone";

// Defensive configuration
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = parseInt(process.env.DB_PORT || "3306", 10);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "yyc_booking";

let pool: Pool | null = null;
let isMariaDbAvailable: boolean | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      idleTimeout: 30000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      dateStrings: true, // Prevents host OS timezone distortion
    });
  }
  return pool;
}

// In-Memory Storage for Resilient Dev Fallback when remote MariaDB socket is offline
interface MemService {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
}

interface MemServiceTier {
  id: number;
  service_id: number;
  duration_minutes: number;
  price: number;
  currency: string;
}

interface MemBooking {
  id: number;
  service_tier_id: number;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  start_time: Date;
  end_time: Date;
  total_price: number;
  status: "CONFIRMED" | "CANCELLED";
  cancellation_reason?: string | null;
  created_at: Date;
}

interface MemTimeBlock {
  id: number;
  start_time: Date;
  end_time: Date;
  block_type: "BOOKED" | "BLOCKED";
  reason: string | null;
  booking_id: number | null;
}

const memDb = {
  services: [
    {
      id: 1,
      name: "Foot Reflexology Therapy",
      description: "Targeted stimulation of neurological reflex zones in feet to restore equilibrium, relieve tension, and enhance circulation.",
      is_active: true,
      created_at: new Date(),
    },
    {
      id: 2,
      name: "Hand & Palm Reflexology",
      description: "Precision pressure technique on neuromuscular zones of the palms and fingers to relieve repetitive strain and upper body stress.",
      is_active: true,
      created_at: new Date(),
    },
    {
      id: 3,
      name: "Combined Integrated Reflexology",
      description: "Comprehensive therapeutic dual-treatment focusing on both foot and hand meridian points for full autonomic nervous balance.",
      is_active: true,
      created_at: new Date(),
    },
    {
      id: 4,
      name: "Deep Meridian Clinical Care",
      description: "Specialized therapeutic focus addressing persistent structural fatigue, chronic inflammation, and plantar fascial tension.",
      is_active: true,
      created_at: new Date(),
    },
  ] as MemService[],

  serviceTiers: [
    { id: 1, service_id: 1, duration_minutes: 30, price: 65.0, currency: "CAD" },
    { id: 2, service_id: 1, duration_minutes: 45, price: 90.0, currency: "CAD" },
    { id: 3, service_id: 1, duration_minutes: 60, price: 115.0, currency: "CAD" },

    { id: 4, service_id: 2, duration_minutes: 30, price: 60.0, currency: "CAD" },
    { id: 5, service_id: 2, duration_minutes: 45, price: 85.0, currency: "CAD" },
    { id: 6, service_id: 2, duration_minutes: 60, price: 110.0, currency: "CAD" },

    { id: 7, service_id: 3, duration_minutes: 30, price: 75.0, currency: "CAD" },
    { id: 8, service_id: 3, duration_minutes: 45, price: 105.0, currency: "CAD" },
    { id: 9, service_id: 3, duration_minutes: 60, price: 135.0, currency: "CAD" },

    { id: 10, service_id: 4, duration_minutes: 30, price: 80.0, currency: "CAD" },
    { id: 11, service_id: 4, duration_minutes: 45, price: 110.0, currency: "CAD" },
    { id: 12, service_id: 4, duration_minutes: 60, price: 140.0, currency: "CAD" },
  ] as MemServiceTier[],

  bookings: [] as MemBooking[],
  timeBlocks: [] as MemTimeBlock[],
  settings: {
    clinic_start_time: "10:00",
    clinic_end_time: "20:00",
  },
  holidays: [] as { id: number; holiday_date: string; name: string }[],
  nextBookingId: 101,
  nextBlockId: 201,
  nextHolidayId: 1,
  nextServiceId: 5,
  nextTierId: 13,
};

/**
 * Checks connectivity to MariaDB
 */
export async function checkMariaDbConnection(): Promise<boolean> {
  // If zero-database mode is enabled, immediately bypass database socket
  if (process.env.ENABLE_DATABASE === "false" || !process.env.DB_HOST) {
    return false;
  }

  if (isMariaDbAvailable !== null) return isMariaDbAvailable;
  try {
    const p = getPool();
    const conn = await p.getConnection();
    await conn.ping();
    conn.release();
    isMariaDbAvailable = true;
    console.log("[MariaDB] Connected successfully to", DB_HOST, DB_NAME);
    return true;
  } catch (err: any) {
    isMariaDbAvailable = false;
    console.warn("[MariaDB] Host unavailable or credentials not configured. Engaging resilient memory adapter:", err.message);
    return false;
  }
}

// -------------------------------------------------------------
// Unified Database Operations (MariaDB 10.11 with Memory Fallback)
// -------------------------------------------------------------

export interface ServiceWithTiers {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  tiers: {
    id: number;
    durationMinutes: number;
    price: number;
    currency: string;
  }[];
}

export async function getAllServicesWithTiers(): Promise<ServiceWithTiers[]> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [services] = await p.query<any[]>(
      "SELECT id, name, description, is_active FROM services WHERE is_active = TRUE ORDER BY id ASC"
    );
    const [tiers] = await p.query<any[]>(
      "SELECT id, service_id, duration_minutes, price, currency FROM service_tiers ORDER BY duration_minutes ASC"
    );

    return services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      isActive: Boolean(s.is_active),
      tiers: tiers
        .filter((t) => t.service_id === s.id)
        .map((t) => ({
          id: t.id,
          durationMinutes: Number(t.duration_minutes),
          price: Number(t.price),
          currency: t.currency,
        })),
    }));
  }

  // Memory Fallback
  return memDb.services
    .filter((s) => s.is_active)
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      isActive: s.is_active,
      tiers: memDb.serviceTiers
        .filter((t) => t.service_id === s.id)
        .map((t) => ({
          id: t.id,
          durationMinutes: t.duration_minutes,
          price: t.price,
          currency: t.currency,
        })),
    }));
}

export async function getTierById(tierId: number): Promise<{
  id: number;
  serviceId: number;
  serviceName: string;
  durationMinutes: number;
  price: number;
  currency: string;
} | null> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [rows] = await p.query<any[]>(
      `SELECT t.id, t.service_id, t.duration_minutes, t.price, t.currency, s.name as service_name
       FROM service_tiers t
       JOIN services s ON t.service_id = s.id
       WHERE t.id = ?`,
      [tierId]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      serviceId: r.service_id,
      serviceName: r.service_name,
      durationMinutes: Number(r.duration_minutes),
      price: Number(r.price),
      currency: r.currency,
    };
  }

  const tier = memDb.serviceTiers.find((t) => t.id === tierId);
  if (!tier) return null;
  const service = memDb.services.find((s) => s.id === tier.service_id);
  return {
    id: tier.id,
    serviceId: tier.service_id,
    serviceName: service ? service.name : "Reflexology Session",
    durationMinutes: tier.duration_minutes,
    price: tier.price,
    currency: tier.currency,
  };
}

export async function getTimeBlocksForDate(requestedDate: string): Promise<{ start: Date; end: Date }[]> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [rows] = await p.query<any[]>(
      `SELECT start_time, end_time FROM time_blocks 
       WHERE DATE(start_time) = ? OR DATE(end_time) = ?`,
      [requestedDate, requestedDate]
    );
    return rows.map((r) => ({
      start: parseClinicDateTime(r.start_time),
      end: parseClinicDateTime(r.end_time),
    }));
  }

  return memDb.timeBlocks
    .filter((b) => {
      const bStartStr = formatToClinicDateStr(b.start_time);
      const bEndStr = formatToClinicDateStr(b.end_time);
      return bStartStr === requestedDate || bEndStr === requestedDate;
    })
    .map((b) => ({
      start: new Date(b.start_time),
      end: new Date(b.end_time),
    }));
}

/**
 * Transaction-safe booking creation with MariaDB SELECT ... FOR UPDATE row-level locking
 */
export async function createBookingWithLock(params: {
  serviceTierId: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  startTime: Date;
  endTime: Date;
  totalPrice: number;
}): Promise<{ success: boolean; bookingId?: number; conflict?: boolean; error?: string }> {
  const isLive = await checkMariaDbConnection();

  if (isLive) {
    const p = getPool();
    const conn: PoolConnection = await p.getConnection();
    try {
      await conn.beginTransaction();

      const sqlStart = formatToSqlDateTime(params.startTime);
      const sqlEnd = formatToSqlDateTime(params.endTime);

      // Concurrency lock: SELECT ... FOR UPDATE on time_blocks over [T_start, T_end]
      const [conflicts] = await conn.query<any[]>(
        `SELECT id FROM time_blocks 
         WHERE (start_time < ? AND end_time > ?)
         FOR UPDATE`,
        [sqlEnd, sqlStart]
      );

      if (conflicts.length > 0) {
        await conn.rollback();
        return { success: false, conflict: true, error: "Slot was just taken, please select another time" };
      }

      // Insert into bookings
      const [bookingResult] = await conn.query<any>(
        `INSERT INTO bookings 
         (service_tier_id, client_name, client_email, client_phone, client_address, start_time, end_time, total_price, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')`,
        [
          params.serviceTierId,
          params.clientName,
          params.clientEmail,
          params.clientPhone,
          params.clientAddress,
          sqlStart,
          sqlEnd,
          params.totalPrice,
        ]
      );

      const bookingId = bookingResult.insertId;

      // Insert corresponding time_block with booking_id FK
      await conn.query<any>(
        `INSERT INTO time_blocks 
         (start_time, end_time, block_type, reason, booking_id)
         VALUES (?, ?, 'BOOKED', ?, ?)`,
        [sqlStart, sqlEnd, `Client booking: ${params.clientName}`, bookingId]
      );

      await conn.commit();
      return { success: true, bookingId };
    } catch (err: any) {
      await conn.rollback();
      console.error("[MariaDB Transaction Error]", err);
      return { success: false, error: err.message };
    } finally {
      conn.release();
    }
  }

  // Memory Fallback with strict conflict detection
  const startMs = params.startTime.getTime();
  const endMs = params.endTime.getTime();

  const hasConflict = memDb.timeBlocks.some((b) => {
    return b.start_time.getTime() < endMs && b.end_time.getTime() > startMs;
  });

  if (hasConflict) {
    return { success: false, conflict: true, error: "Slot was just taken, please select another time" };
  }

  const bookingId = memDb.nextBookingId++;
  const booking: MemBooking = {
    id: bookingId,
    service_tier_id: params.serviceTierId,
    client_name: params.clientName,
    client_email: params.clientEmail,
    client_phone: params.clientPhone,
    client_address: params.clientAddress,
    start_time: params.startTime,
    end_time: params.endTime,
    total_price: params.totalPrice,
    status: "CONFIRMED",
    created_at: new Date(),
  };
  memDb.bookings.push(booking);

  memDb.timeBlocks.push({
    id: memDb.nextBlockId++,
    start_time: params.startTime,
    end_time: params.endTime,
    block_type: "BOOKED",
    reason: `Client booking: ${params.clientName}`,
    booking_id: bookingId,
  });

  return { success: true, bookingId };
}

/**
 * Admin: Add zero-dummy practitioner time block
 */
export async function addPractitionerBlock(params: {
  startTime: Date;
  endTime: Date;
  reason?: string;
}): Promise<{ id: number }> {
  const isLive = await checkMariaDbConnection();
  const reason = params.reason || "Doctor unavailable";

  if (isLive) {
    const p = getPool();
    const sqlStart = formatToSqlDateTime(params.startTime);
    const sqlEnd = formatToSqlDateTime(params.endTime);

    const [res] = await p.query<any>(
      `INSERT INTO time_blocks (start_time, end_time, block_type, reason)
       VALUES (?, ?, 'BLOCKED', ?)`,
      [sqlStart, sqlEnd, reason]
    );
    return { id: res.insertId };
  }

  const id = memDb.nextBlockId++;
  memDb.timeBlocks.push({
    id,
    start_time: params.startTime,
    end_time: params.endTime,
    block_type: "BLOCKED",
    reason,
    booking_id: null,
  });
  return { id };
}

/**
 * Admin: Delete practitioner time block
 */
export async function deletePractitionerBlock(blockId: number): Promise<boolean> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [res] = await p.query<any>("DELETE FROM time_blocks WHERE id = ? AND block_type = 'BLOCKED'", [blockId]);
    return res.affectedRows > 0;
  }

  const idx = memDb.timeBlocks.findIndex((b) => b.id === blockId && b.block_type === "BLOCKED");
  if (idx !== -1) {
    memDb.timeBlocks.splice(idx, 1);
    return true;
  }
  return false;
}

/**
 * Admin: Get all blocks (for calendar overview)
 */
export async function getAllTimeBlocks(): Promise<{
  id: number;
  startTime: string;
  endTime: string;
  blockType: "BOOKED" | "BLOCKED";
  reason: string | null;
  bookingId: number | null;
}[]> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [rows] = await p.query<any[]>(
      `SELECT id, start_time, end_time, block_type, reason, booking_id 
       FROM time_blocks 
       ORDER BY start_time ASC`
    );
    return rows.map((r) => ({
      id: r.id,
      startTime: parseClinicDateTime(r.start_time).toISOString(),
      endTime: parseClinicDateTime(r.end_time).toISOString(),
      blockType: r.block_type,
      reason: r.reason,
      bookingId: r.booking_id,
    }));
  }

  return memDb.timeBlocks.map((b) => ({
    id: b.id,
    startTime: b.start_time.toISOString(),
    endTime: b.end_time.toISOString(),
    blockType: b.block_type,
    reason: b.reason,
    bookingId: b.booking_id,
  }));
}

/**
 * Admin: Get all upcoming appointments
 */
export async function getAllBookings(): Promise<any[]> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [rows] = await p.query<any[]>(
      `SELECT b.id, b.client_name, b.client_email, b.client_phone, b.client_address,
              b.start_time, b.end_time, b.total_price, b.status, b.cancellation_reason,
              s.name as service_name, t.duration_minutes, t.currency
       FROM bookings b
       JOIN service_tiers t ON b.service_tier_id = t.id
       JOIN services s ON t.service_id = s.id
       ORDER BY b.start_time DESC`
    );
    return rows.map((r) => ({
      id: r.id,
      clientName: r.client_name,
      clientEmail: r.client_email,
      clientPhone: r.client_phone,
      clientAddress: r.client_address,
      startTime: parseClinicDateTime(r.start_time).toISOString(),
      endTime: parseClinicDateTime(r.end_time).toISOString(),
      totalPrice: Number(r.total_price),
      status: r.status,
      cancellationReason: r.cancellation_reason,
      serviceName: r.service_name,
      durationMinutes: Number(r.duration_minutes),
      currency: r.currency,
    }));
  }

  return memDb.bookings.map((b) => {
    const tier = memDb.serviceTiers.find((t) => t.id === b.service_tier_id);
    const service = tier ? memDb.services.find((s) => s.id === tier.service_id) : null;
    return {
      id: b.id,
      clientName: b.client_name,
      clientEmail: b.client_email,
      clientPhone: b.client_phone,
      clientAddress: b.client_address,
      startTime: b.start_time.toISOString(),
      endTime: b.end_time.toISOString(),
      totalPrice: b.total_price,
      status: b.status,
      cancellationReason: b.cancellation_reason,
      serviceName: service ? service.name : "Clinical Reflexology",
      durationMinutes: tier ? tier.duration_minutes : 60,
      currency: tier ? tier.currency : "CAD",
    };
  });
}

/**
 * Admin: Cancel appointment, remove time block, return booking record for notification
 */
export async function cancelBooking(
  bookingId: number,
  reason: string
): Promise<{ success: boolean; booking?: any; error?: string }> {
  const isLive = await checkMariaDbConnection();

  if (isLive) {
    const p = getPool();
    const conn = await p.getConnection();
    try {
      await conn.beginTransaction();

      // Retrieve booking
      const [rows] = await conn.query<any[]>(
        `SELECT b.*, s.name as service_name, t.duration_minutes, t.currency
         FROM bookings b
         JOIN service_tiers t ON b.service_tier_id = t.id
         JOIN services s ON t.service_id = s.id
         WHERE b.id = ? FOR UPDATE`,
        [bookingId]
      );

      if (rows.length === 0) {
        await conn.rollback();
        return { success: false, error: "Booking not found" };
      }

      const booking = rows[0];

      // Update status
      await conn.query(
        "UPDATE bookings SET status = 'CANCELLED', cancellation_reason = ? WHERE id = ?",
        [reason, bookingId]
      );

      // Remove blocking record from time_blocks to release inventory
      await conn.query("DELETE FROM time_blocks WHERE booking_id = ?", [bookingId]);

      await conn.commit();
      return {
        success: true,
        booking: {
          id: booking.id,
          serviceName: booking.service_name,
          durationMinutes: Number(booking.duration_minutes),
          totalPrice: Number(booking.total_price),
          currency: booking.currency,
          clientName: booking.client_name,
          clientEmail: booking.client_email,
          clientPhone: booking.client_phone,
          clientAddress: booking.client_address,
          startTime: parseClinicDateTime(booking.start_time),
          endTime: parseClinicDateTime(booking.end_time),
          cancellationReason: reason,
        },
      };
    } catch (err: any) {
      await conn.rollback();
      return { success: false, error: err.message };
    } finally {
      conn.release();
    }
  }

  // Memory Fallback
  const booking = memDb.bookings.find((b) => b.id === bookingId);
  if (!booking) {
    return { success: false, error: "Booking not found" };
  }

  booking.status = "CANCELLED";
  booking.cancellation_reason = reason;

  // Release time_block
  const blockIdx = memDb.timeBlocks.findIndex((b) => b.booking_id === bookingId);
  if (blockIdx !== -1) {
    memDb.timeBlocks.splice(blockIdx, 1);
  }

  const tier = memDb.serviceTiers.find((t) => t.id === booking.service_tier_id);
  const service = tier ? memDb.services.find((s) => s.id === tier.service_id) : null;

  return {
    success: true,
    booking: {
      id: booking.id,
      serviceName: service ? service.name : "Reflexology Therapy",
      durationMinutes: tier ? tier.duration_minutes : 60,
      totalPrice: booking.total_price,
      currency: tier ? tier.currency : "CAD",
      clientName: booking.client_name,
      clientEmail: booking.client_email,
      clientPhone: booking.client_phone,
      clientAddress: booking.client_address,
      startTime: booking.start_time,
      endTime: booking.end_time,
      cancellationReason: reason,
    },
  };
}

/**
 * Admin: Update tier price
 */
export async function updateServiceTierPrice(tierId: number, price: number): Promise<boolean> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [res] = await p.query<any>("UPDATE service_tiers SET price = ? WHERE id = ?", [price, tierId]);
    return res.affectedRows > 0;
  }

  const tier = memDb.serviceTiers.find((t) => t.id === tierId);
  if (tier) {
    tier.price = price;
    return true;
  }
  return false;
}

/**
 * Admin: Create a new clinical service
 */
export async function createService(params: {
  name: string;
  description: string;
}): Promise<{ id: number }> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [res] = await p.query<any>(
      "INSERT INTO services (name, description, is_active) VALUES (?, ?, TRUE)",
      [params.name, params.description]
    );
    return { id: res.insertId };
  }

  const id = memDb.nextServiceId++;
  memDb.services.push({
    id,
    name: params.name,
    description: params.description,
    is_active: true,
    created_at: new Date(),
  });
  return { id };
}

/**
 * Admin: Delete / deactivate a clinical service
 */
export async function deleteService(serviceId: number): Promise<boolean> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [res] = await p.query<any>("DELETE FROM services WHERE id = ?", [serviceId]);
    return res.affectedRows > 0;
  }

  const idx = memDb.services.findIndex((s) => s.id === serviceId);
  if (idx !== -1) {
    memDb.services.splice(idx, 1);
    memDb.serviceTiers = memDb.serviceTiers.filter((t) => t.service_id !== serviceId);
    return true;
  }
  return false;
}

/**
 * Admin: Add a custom duration tier (e.g. 15, 30, 45, 60, 75, 90, 120 mins) to any service
 */
export async function addServiceTier(params: {
  serviceId: number;
  durationMinutes: number;
  price: number;
  currency?: string;
}): Promise<{ id: number }> {
  const currency = params.currency || "CAD";
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [res] = await p.query<any>(
      `INSERT INTO service_tiers (service_id, duration_minutes, price, currency) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE price = VALUES(price)`,
      [params.serviceId, params.durationMinutes, params.price, currency]
    );
    return { id: res.insertId || params.serviceId };
  }

  const existing = memDb.serviceTiers.find(
    (t) => t.service_id === params.serviceId && t.duration_minutes === params.durationMinutes
  );
  if (existing) {
    existing.price = params.price;
    return { id: existing.id };
  }

  const id = memDb.nextTierId++;
  memDb.serviceTiers.push({
    id,
    service_id: params.serviceId,
    duration_minutes: params.durationMinutes,
    price: params.price,
    currency,
  });
  return { id };
}

/**
 * Admin: Delete a duration tier
 */
export async function deleteServiceTier(tierId: number): Promise<boolean> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [res] = await p.query<any>("DELETE FROM service_tiers WHERE id = ?", [tierId]);
    return res.affectedRows > 0;
  }

  const idx = memDb.serviceTiers.findIndex((t) => t.id === tierId);
  if (idx !== -1) {
    memDb.serviceTiers.splice(idx, 1);
    return true;
  }
  return false;
}

/**
 * Clinic Settings: Get working hours
 */
export async function getClinicSettings(): Promise<{ startTime: string; endTime: string }> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [rows] = await p.query<any[]>("SELECT setting_key, setting_value FROM clinic_settings");
    const settingsMap: Record<string, string> = {};
    for (const r of rows) {
      settingsMap[r.setting_key] = r.setting_value;
    }
    return {
      startTime: settingsMap["clinic_start_time"] || "09:00",
      endTime: settingsMap["clinic_end_time"] || "18:00",
    };
  }

  return {
    startTime: memDb.settings.clinic_start_time,
    endTime: memDb.settings.clinic_end_time,
  };
}

/**
 * Clinic Settings: Update working hours
 */
export async function updateClinicSettings(startTime: string, endTime: string): Promise<boolean> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    await p.query(
      `INSERT INTO clinic_settings (setting_key, setting_value) VALUES 
       ('clinic_start_time', ?), ('clinic_end_time', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [startTime, endTime]
    );
    return true;
  }

  memDb.settings.clinic_start_time = startTime;
  memDb.settings.clinic_end_time = endTime;
  return true;
}

/**
 * Clinic Holidays: Get all scheduled holidays
 */
export async function getClinicHolidays(): Promise<{ id: number; holidayDate: string; name: string }[]> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [rows] = await p.query<any[]>(
      "SELECT id, holiday_date, name FROM clinic_holidays ORDER BY holiday_date ASC"
    );
    return rows.map((r) => ({
      id: r.id,
      holidayDate: formatToClinicDateStr(new Date(r.holiday_date)),
      name: r.name,
    }));
  }

  return memDb.holidays.map((h) => ({
    id: h.id,
    holidayDate: h.holiday_date,
    name: h.name,
  }));
}

/**
 * Clinic Holidays: Add new holiday/closure date
 */
export async function addClinicHoliday(holidayDate: string, name: string): Promise<{ id: number }> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [res] = await p.query<any>(
      `INSERT INTO clinic_holidays (holiday_date, name) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [holidayDate, name]
    );
    return { id: res.insertId };
  }

  const id = memDb.nextHolidayId++;
  memDb.holidays.push({ id, holiday_date: holidayDate, name });
  return { id };
}

/**
 * Clinic Holidays: Delete holiday
 */
export async function deleteClinicHoliday(holidayId: number): Promise<boolean> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [res] = await p.query<any>("DELETE FROM clinic_holidays WHERE id = ?", [holidayId]);
    return res.affectedRows > 0;
  }

  const idx = memDb.holidays.findIndex((h) => h.id === holidayId);
  if (idx !== -1) {
    memDb.holidays.splice(idx, 1);
    return true;
  }
  return false;
}

/**
 * Check if a given date is a clinic holiday
 */
export async function checkIfHoliday(dateStr: string): Promise<{ isHoliday: boolean; holidayName?: string }> {
  const isLive = await checkMariaDbConnection();
  if (isLive) {
    const p = getPool();
    const [rows] = await p.query<any[]>(
      "SELECT name FROM clinic_holidays WHERE holiday_date = ?",
      [dateStr]
    );
    if (rows.length > 0) {
      return { isHoliday: true, holidayName: rows[0].name };
    }
    return { isHoliday: false };
  }

  const found = memDb.holidays.find((h) => h.holiday_date === dateStr);
  if (found) {
    return { isHoliday: true, holidayName: found.name };
  }
  return { isHoliday: false };
}
