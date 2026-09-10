import { neon } from "@neondatabase/serverless";
import mysql, { Pool, PoolConnection } from "mysql2/promise";
import { formatToSqlDateTime, formatToClinicDateStr, parseClinicDateTime } from "./timezone";
import fs from "fs";
import path from "path";

// -------------------------------------------------------------
// Database Connection Configuration (Auto-detects Vercel / Neon / MySQL / Local)
// -------------------------------------------------------------

const POSTGRES_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  "";

const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = parseInt(process.env.DB_PORT || "3306", 10);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "yyc_booking";

let mysqlPool: Pool | null = null;
let isPostgresInitialized = false;

export function isPostgresConfigured(): boolean {
  return Boolean(POSTGRES_URL && (POSTGRES_URL.startsWith("postgres://") || POSTGRES_URL.startsWith("postgresql://")));
}

export function getPostgresClient() {
  if (!isPostgresConfigured()) return null;
  return neon(POSTGRES_URL);
}

export function getMySqlPool(): Pool {
  if (!mysqlPool) {
    mysqlPool = mysql.createPool({
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
      dateStrings: true,
    });
  }
  return mysqlPool;
}

export async function isDatabaseActive(): Promise<"postgres" | "mysql" | "file"> {
  if (isPostgresConfigured()) {
    return "postgres";
  }
  if (process.env.ENABLE_DATABASE === "true" && process.env.DB_HOST) {
    try {
      const p = getMySqlPool();
      const conn = await p.getConnection();
      await conn.ping();
      conn.release();
      return "mysql";
    } catch {
      return "file";
    }
  }
  return "file";
}

// -------------------------------------------------------------
// Automatic Postgres Schema Bootstrapper (Auto-creates tables on Vercel Neon)
// -------------------------------------------------------------

export async function ensurePostgresSchema(): Promise<void> {
  if (!isPostgresConfigured()) return;
  if (isPostgresInitialized) return;

  try {
    const sql = getPostgresClient();
    if (!sql) return;

    // 1. Services table
    await sql`
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // 2. Service tiers table
    await sql`
      CREATE TABLE IF NOT EXISTS service_tiers (
        id SERIAL PRIMARY KEY,
        service_id INT NOT NULL,
        duration_minutes INT NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'CAD',
        CONSTRAINT uniq_service_duration UNIQUE (service_id, duration_minutes)
      )
    `;

    // 3. Bookings table
    await sql`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        service_tier_id INT NOT NULL,
        client_name VARCHAR(255) NOT NULL,
        client_email VARCHAR(255) NOT NULL,
        client_phone VARCHAR(50) NOT NULL,
        client_address VARCHAR(255) NOT NULL,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        total_price NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'CONFIRMED',
        cancellation_reason TEXT,
        reference_code VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // 4. Time blocks table
    await sql`
      CREATE TABLE IF NOT EXISTS time_blocks (
        id SERIAL PRIMARY KEY,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        block_type VARCHAR(50) NOT NULL,
        reason TEXT,
        booking_id INT
      )
    `;

    // 5. Clinic settings table
    await sql`
      CREATE TABLE IF NOT EXISTS clinic_settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value TEXT NOT NULL
      )
    `;

    // 6. Clinic holidays table
    await sql`
      CREATE TABLE IF NOT EXISTS clinic_holidays (
        id SERIAL PRIMARY KEY,
        holiday_date VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Seed default services if table is empty
    const existingServices = await sql`SELECT count(*)::int as count FROM services`;
    if (existingServices[0]?.count === 0) {
      await sql`
        INSERT INTO services (id, name, description, is_active) VALUES
        (1, 'Foot Reflexology Therapy', 'Targeted stimulation of neurological reflex zones in feet to restore equilibrium, relieve tension, and enhance circulation.', TRUE),
        (2, 'Hand & Palm Reflexology', 'Precision pressure technique on neuromuscular zones of the palms and fingers to relieve repetitive strain and upper body stress.', TRUE),
        (3, 'Combined Integrated Reflexology', 'Comprehensive therapeutic dual-treatment focusing on both foot and hand meridian points for full autonomic nervous balance.', TRUE),
        (4, 'Deep Meridian Clinical Care', 'Specialized therapeutic focus addressing persistent structural fatigue, chronic inflammation, and plantar fascial tension.', TRUE)
        ON CONFLICT (id) DO NOTHING
      `;

      await sql`
        INSERT INTO service_tiers (service_id, duration_minutes, price, currency) VALUES
        (1, 30, 65.00, 'CAD'), (1, 45, 90.00, 'CAD'), (1, 60, 115.00, 'CAD'),
        (2, 30, 60.00, 'CAD'), (2, 45, 85.00, 'CAD'), (2, 60, 110.00, 'CAD'),
        (3, 30, 75.00, 'CAD'), (3, 45, 105.00, 'CAD'), (3, 60, 135.00, 'CAD'),
        (4, 30, 80.00, 'CAD'), (4, 45, 110.00, 'CAD'), (4, 60, 140.00, 'CAD')
        ON CONFLICT DO NOTHING
      `;

      await sql`
        INSERT INTO clinic_settings (setting_key, setting_value) VALUES
        ('clinic_start_time', '09:00'),
        ('clinic_end_time', '18:00')
        ON CONFLICT (setting_key) DO NOTHING
      `;
    }

    isPostgresInitialized = true;
    console.log("[Neon Postgres] Auto-schema verified and ready.");
  } catch (err: any) {
    console.warn("[Neon Postgres] Schema verification notice:", err.message);
  }
}

// -------------------------------------------------------------
// Resilient File Store (Local / Dev Fallback)
// -------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "clinic_data.json");

interface ClinicStore {
  services: any[];
  serviceTiers: any[];
  bookings: any[];
  timeBlocks: any[];
  settings: {
    clinic_start_time: string;
    clinic_end_time: string;
  };
  holidays: { id: number; holiday_date: string; name: string }[];
  nextBookingId: number;
  nextBlockId: number;
  nextHolidayId: number;
  nextServiceId: number;
  nextTierId: number;
}

export function generateUniqueReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "YYC-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getDefaultStore(): ClinicStore {
  return {
    services: [
      {
        id: 1,
        name: "Foot Reflexology Therapy",
        description: "Targeted stimulation of neurological reflex zones in feet to restore equilibrium, relieve tension, and enhance circulation.",
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        name: "Hand & Palm Reflexology",
        description: "Precision pressure technique on neuromuscular zones of the palms and fingers to relieve repetitive strain and upper body stress.",
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 3,
        name: "Combined Integrated Reflexology",
        description: "Comprehensive therapeutic dual-treatment focusing on both foot and hand meridian points for full autonomic nervous balance.",
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 4,
        name: "Deep Meridian Clinical Care",
        description: "Specialized therapeutic focus addressing persistent structural fatigue, chronic inflammation, and plantar fascial tension.",
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ],
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
    ],
    bookings: [],
    timeBlocks: [],
    settings: {
      clinic_start_time: "09:00",
      clinic_end_time: "18:00",
    },
    holidays: [],
    nextBookingId: 101,
    nextBlockId: 201,
    nextHolidayId: 1,
    nextServiceId: 5,
    nextTierId: 13,
  };
}

let cachedStore: ClinicStore | null = null;
let lastFileMtime: number = 0;

export function getStore(): ClinicStore {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const stat = fs.statSync(DATA_FILE);
      if (!cachedStore || stat.mtimeMs > lastFileMtime) {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        const data = JSON.parse(raw);
        data.bookings = data.bookings || [];
        data.timeBlocks = data.timeBlocks || [];
        data.services = data.services || [];
        data.serviceTiers = data.serviceTiers || [];
        data.holidays = data.holidays || [];
        data.settings = data.settings || { clinic_start_time: "09:00", clinic_end_time: "18:00" };
        cachedStore = data;
        lastFileMtime = stat.mtimeMs;
      }
      return cachedStore!;
    }
  } catch (err) {
    console.warn("[DataStore] Error reading store from disk:", err);
  }

  if (!cachedStore) {
    cachedStore = getDefaultStore();
    saveStoreToDisk(cachedStore);
  }
  return cachedStore;
}

export function saveStoreToDisk(store: ClinicStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
    try {
      const stat = fs.statSync(DATA_FILE);
      lastFileMtime = stat.mtimeMs;
    } catch {}
    cachedStore = store;
  } catch (err) {
    console.warn("[DataStore] Notice: Disk write skipped or read-only filesystem:", err);
  }
}

// -------------------------------------------------------------
// Public Unified API Operations
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
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const services = await sql`SELECT id, name, description, is_active FROM services WHERE is_active = TRUE ORDER BY id ASC`;
    const tiers = await sql`SELECT id, service_id, duration_minutes, price, currency FROM service_tiers ORDER BY duration_minutes ASC`;

    return services.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      isActive: Boolean(s.is_active),
      tiers: tiers
        .filter((t: any) => t.service_id === s.id)
        .map((t: any) => ({
          id: t.id,
          durationMinutes: Number(t.duration_minutes),
          price: Number(t.price),
          currency: t.currency || "CAD",
        })),
    }));
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
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
          currency: t.currency || "CAD",
        })),
    }));
  }

  const store = getStore();
  return store.services
    .filter((s) => s.is_active)
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      isActive: s.is_active,
      tiers: store.serviceTiers
        .filter((t) => t.service_id === s.id)
        .map((t) => ({
          id: t.id,
          durationMinutes: t.duration_minutes,
          price: t.price,
          currency: t.currency || "CAD",
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
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const rows = await sql`
      SELECT t.id, t.service_id, t.duration_minutes, t.price, t.currency, s.name as service_name
      FROM service_tiers t
      JOIN services s ON t.service_id = s.id
      WHERE t.id = ${tierId}
    `;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      serviceId: r.service_id,
      serviceName: r.service_name,
      durationMinutes: Number(r.duration_minutes),
      price: Number(r.price),
      currency: r.currency || "CAD",
    };
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
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
      currency: r.currency || "CAD",
    };
  }

  const store = getStore();
  const tier = store.serviceTiers.find((t) => t.id === tierId);
  if (!tier) return null;
  const service = store.services.find((s) => s.id === tier.service_id);
  return {
    id: tier.id,
    serviceId: tier.service_id,
    serviceName: service ? service.name : "Reflexology Session",
    durationMinutes: tier.duration_minutes,
    price: tier.price,
    currency: tier.currency || "CAD",
  };
}

export async function getTimeBlocksForDate(requestedDate: string): Promise<{ start: Date; end: Date }[]> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const rows = await sql`
      SELECT start_time, end_time FROM time_blocks
      WHERE DATE(start_time) = ${requestedDate}::date OR DATE(end_time) = ${requestedDate}::date
    `;
    return rows.map((r: any) => ({
      start: parseClinicDateTime(r.start_time),
      end: parseClinicDateTime(r.end_time),
    }));
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
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

  const store = getStore();
  return store.timeBlocks
    .filter((b) => {
      const bStartStr = formatToClinicDateStr(b.start_time);
      const bEndStr = formatToClinicDateStr(b.end_time);
      return bStartStr === requestedDate || bEndStr === requestedDate;
    })
    .map((b) => ({
      start: parseClinicDateTime(b.start_time),
      end: parseClinicDateTime(b.end_time),
    }));
}

/**
 * Transaction-safe booking creation with Conflict Prevention
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
}): Promise<{ success: boolean; bookingId?: number; referenceNumber?: string; conflict?: boolean; error?: string }> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const isoStart = params.startTime.toISOString();
    const isoEnd = params.endTime.toISOString();

    const conflicts = await sql`
      SELECT id FROM time_blocks
      WHERE (start_time < ${isoEnd}::timestamptz AND end_time > ${isoStart}::timestamptz)
    `;

    if (conflicts.length > 0) {
      return { success: false, conflict: true, error: "Slot was just taken, please select another time" };
    }

    const referenceNumber = generateUniqueReference();
    const [booking] = await sql`
      INSERT INTO bookings 
      (service_tier_id, client_name, client_email, client_phone, client_address, start_time, end_time, total_price, status, reference_code)
      VALUES (${params.serviceTierId}, ${params.clientName}, ${params.clientEmail}, ${params.clientPhone}, ${params.clientAddress}, ${isoStart}::timestamptz, ${isoEnd}::timestamptz, ${params.totalPrice}, 'CONFIRMED', ${referenceNumber})
      RETURNING id
    `;

    const bookingId = booking.id;

    await sql`
      INSERT INTO time_blocks 
      (start_time, end_time, block_type, reason, booking_id)
      VALUES (${isoStart}::timestamptz, ${isoEnd}::timestamptz, 'BOOKED', ${`Client booking: ${params.clientName} [Ref: ${referenceNumber}]`}, ${bookingId})
    `;

    return { success: true, bookingId, referenceNumber };
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const conn: PoolConnection = await p.getConnection();
    try {
      await conn.beginTransaction();
      const sqlStart = formatToSqlDateTime(params.startTime);
      const sqlEnd = formatToSqlDateTime(params.endTime);

      const [conflicts] = await conn.query<any[]>(
        `SELECT id FROM time_blocks WHERE (start_time < ? AND end_time > ?) FOR UPDATE`,
        [sqlEnd, sqlStart]
      );

      if (conflicts.length > 0) {
        await conn.rollback();
        return { success: false, conflict: true, error: "Slot was just taken, please select another time" };
      }

      const referenceNumber = generateUniqueReference();
      try {
        await conn.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reference_code VARCHAR(50) NULL");
      } catch {}

      const [bookingResult] = await conn.query<any>(
        `INSERT INTO bookings 
         (service_tier_id, client_name, client_email, client_phone, client_address, start_time, end_time, total_price, status, reference_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)`,
        [
          params.serviceTierId,
          params.clientName,
          params.clientEmail,
          params.clientPhone,
          params.clientAddress,
          sqlStart,
          sqlEnd,
          params.totalPrice,
          referenceNumber,
        ]
      );

      const bookingId = bookingResult.insertId;

      await conn.query<any>(
        `INSERT INTO time_blocks (start_time, end_time, block_type, reason, booking_id)
         VALUES (?, ?, 'BOOKED', ?, ?)`,
        [sqlStart, sqlEnd, `Client booking: ${params.clientName} [Ref: ${referenceNumber}]`, bookingId]
      );

      await conn.commit();
      return { success: true, bookingId, referenceNumber };
    } catch (err: any) {
      await conn.rollback();
      return { success: false, error: err.message };
    } finally {
      conn.release();
    }
  }

  // Persistent File-backed Store
  const store = getStore();
  const startMs = params.startTime.getTime();
  const endMs = params.endTime.getTime();

  const hasConflict = store.timeBlocks.some((b) => {
    const bStart = parseClinicDateTime(b.start_time).getTime();
    const bEnd = parseClinicDateTime(b.end_time).getTime();
    return bStart < endMs && bEnd > startMs;
  });

  if (hasConflict) {
    return { success: false, conflict: true, error: "Slot was just taken, please select another time" };
  }

  const referenceNumber = generateUniqueReference();
  const bookingId = store.nextBookingId ? store.nextBookingId++ : 101;
  const blockId = store.nextBlockId ? store.nextBlockId++ : 201;

  store.bookings.unshift({
    id: bookingId,
    reference_number: referenceNumber,
    service_tier_id: params.serviceTierId,
    client_name: params.clientName,
    client_email: params.clientEmail,
    client_phone: params.clientPhone,
    client_address: params.clientAddress,
    start_time: params.startTime.toISOString(),
    end_time: params.endTime.toISOString(),
    total_price: params.totalPrice,
    status: "CONFIRMED",
    created_at: new Date().toISOString(),
  });

  store.timeBlocks.push({
    id: blockId,
    start_time: params.startTime.toISOString(),
    end_time: params.endTime.toISOString(),
    block_type: "BOOKED",
    reason: `Client booking: ${params.clientName} [Ref: ${referenceNumber}]`,
    booking_id: bookingId,
  });

  saveStoreToDisk(store);
  return { success: true, bookingId, referenceNumber };
}

/**
 * Admin: Add practitioner time block
 */
export async function addPractitionerBlock(params: {
  startTime: Date;
  endTime: Date;
  reason?: string;
}): Promise<{ id: number }> {
  const reason = params.reason || "Doctor unavailable";
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const [row] = await sql`
      INSERT INTO time_blocks (start_time, end_time, block_type, reason)
      VALUES (${params.startTime.toISOString()}::timestamptz, ${params.endTime.toISOString()}::timestamptz, 'BLOCKED', ${reason})
      RETURNING id
    `;
    return { id: row.id };
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const sqlStart = formatToSqlDateTime(params.startTime);
    const sqlEnd = formatToSqlDateTime(params.endTime);

    const [res] = await p.query<any>(
      `INSERT INTO time_blocks (start_time, end_time, block_type, reason)
       VALUES (?, ?, 'BLOCKED', ?)`,
      [sqlStart, sqlEnd, reason]
    );
    return { id: res.insertId };
  }

  const store = getStore();
  const id = store.nextBlockId ? store.nextBlockId++ : 201;
  store.timeBlocks.push({
    id,
    start_time: params.startTime.toISOString(),
    end_time: params.endTime.toISOString(),
    block_type: "BLOCKED",
    reason,
    booking_id: null,
  });
  saveStoreToDisk(store);
  return { id };
}

/**
 * Admin: Delete practitioner time block
 */
export async function deletePractitionerBlock(blockId: number): Promise<boolean> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const res = await sql`
      DELETE FROM time_blocks WHERE id = ${blockId} AND block_type = 'BLOCKED'
      RETURNING id
    `;
    return res.length > 0;
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const [res] = await p.query<any>("DELETE FROM time_blocks WHERE id = ? AND block_type = 'BLOCKED'", [blockId]);
    return res.affectedRows > 0;
  }

  const store = getStore();
  const idx = store.timeBlocks.findIndex((b) => b.id === blockId && b.block_type === "BLOCKED");
  if (idx !== -1) {
    store.timeBlocks.splice(idx, 1);
    saveStoreToDisk(store);
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
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const rows = await sql`SELECT id, start_time, end_time, block_type, reason, booking_id FROM time_blocks ORDER BY start_time ASC`;
    return rows.map((r: any) => ({
      id: r.id,
      startTime: parseClinicDateTime(r.start_time).toISOString(),
      endTime: parseClinicDateTime(r.end_time).toISOString(),
      blockType: r.block_type,
      reason: r.reason,
      bookingId: r.booking_id,
    }));
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
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

  const store = getStore();
  return store.timeBlocks.map((b) => ({
    id: b.id,
    startTime: parseClinicDateTime(b.start_time).toISOString(),
    endTime: parseClinicDateTime(b.end_time).toISOString(),
    blockType: b.block_type,
    reason: b.reason,
    bookingId: b.booking_id,
  }));
}

/**
 * Admin: Get all upcoming appointments (Single Source of Truth)
 */
export async function getAllBookings(): Promise<any[]> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const rows = await sql`
      SELECT b.id, b.client_name, b.client_email, b.client_phone, b.client_address,
             b.start_time, b.end_time, b.total_price, b.status, b.cancellation_reason,
             COALESCE(b.reference_code, CONCAT('YYC-', LPAD(b.id::text, 6, '0'))) as reference_number,
             s.name as service_name, t.duration_minutes, t.currency
      FROM bookings b
      LEFT JOIN service_tiers t ON b.service_tier_id = t.id
      LEFT JOIN services s ON t.service_id = s.id
      ORDER BY b.start_time DESC
    `;
    return rows.map((r: any) => ({
      id: r.id,
      referenceNumber: r.reference_number || `YYC-${String(r.id).padStart(6, "0")}`,
      clientName: r.client_name,
      clientEmail: r.client_email,
      clientPhone: r.client_phone,
      clientAddress: r.client_address,
      startTime: parseClinicDateTime(r.start_time).toISOString(),
      endTime: parseClinicDateTime(r.end_time).toISOString(),
      totalPrice: Number(r.total_price),
      status: r.status,
      cancellationReason: r.cancellation_reason,
      serviceName: r.service_name || "Clinical Reflexology",
      durationMinutes: Number(r.duration_minutes || 60),
      currency: r.currency || "CAD",
    }));
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const [rows] = await p.query<any[]>(
      `SELECT b.id, b.client_name, b.client_email, b.client_phone, b.client_address,
              b.start_time, b.end_time, b.total_price, b.status, b.cancellation_reason,
              COALESCE(b.reference_code, CONCAT('YYC-', LPAD(b.id, 6, '0'))) as reference_number,
              s.name as service_name, t.duration_minutes, t.currency
       FROM bookings b
       LEFT JOIN service_tiers t ON b.service_tier_id = t.id
       LEFT JOIN services s ON t.service_id = s.id
       ORDER BY b.start_time DESC`
    );
    return rows.map((r) => ({
      id: r.id,
      referenceNumber: r.reference_number || `YYC-${String(r.id).padStart(6, "0")}`,
      clientName: r.client_name,
      clientEmail: r.client_email,
      clientPhone: r.client_phone,
      clientAddress: r.client_address,
      startTime: parseClinicDateTime(r.start_time).toISOString(),
      endTime: parseClinicDateTime(r.end_time).toISOString(),
      totalPrice: Number(r.total_price),
      status: r.status,
      cancellationReason: r.cancellation_reason,
      serviceName: r.service_name || "Clinical Reflexology",
      durationMinutes: Number(r.duration_minutes || 60),
      currency: r.currency || "CAD",
    }));
  }

  const store = getStore();
  return store.bookings.map((b) => {
    const tier = store.serviceTiers.find((t) => t.id === b.service_tier_id);
    const service = tier ? store.services.find((s) => s.id === tier.service_id) : null;
    return {
      id: b.id,
      referenceNumber: b.reference_number || `YYC-${String(b.id).padStart(6, "0")}`,
      clientName: b.client_name,
      clientEmail: b.client_email,
      clientPhone: b.client_phone,
      clientAddress: b.client_address,
      startTime: parseClinicDateTime(b.start_time).toISOString(),
      endTime: parseClinicDateTime(b.end_time).toISOString(),
      totalPrice: Number(b.total_price),
      status: b.status,
      cancellationReason: b.cancellation_reason,
      serviceName: service ? service.name : "Clinical Reflexology",
      durationMinutes: tier ? tier.duration_minutes : 60,
      currency: tier ? tier.currency : "CAD",
    };
  });
}

/**
 * Admin: Cancel appointment
 */
export async function cancelBooking(
  bookingId: number,
  reason: string
): Promise<{ success: boolean; booking?: any; error?: string }> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const rows = await sql`
      SELECT b.*, s.name as service_name, t.duration_minutes, t.currency
      FROM bookings b
      LEFT JOIN service_tiers t ON b.service_tier_id = t.id
      LEFT JOIN services s ON t.service_id = s.id
      WHERE b.id = ${bookingId}
    `;

    if (rows.length === 0) return { success: false, error: "Booking not found" };
    const booking = rows[0];

    await sql`UPDATE bookings SET status = 'CANCELLED', cancellation_reason = ${reason} WHERE id = ${bookingId}`;
    await sql`DELETE FROM time_blocks WHERE booking_id = ${bookingId}`;

    return {
      success: true,
      booking: {
        id: booking.id,
        referenceNumber: booking.reference_code || `YYC-${String(booking.id).padStart(6, "0")}`,
        serviceName: booking.service_name || "Clinical Reflexology",
        durationMinutes: Number(booking.duration_minutes || 60),
        totalPrice: Number(booking.total_price),
        currency: booking.currency || "CAD",
        clientName: booking.client_name,
        clientEmail: booking.client_email,
        clientPhone: booking.client_phone,
        clientAddress: booking.client_address,
        startTime: parseClinicDateTime(booking.start_time),
        endTime: parseClinicDateTime(booking.end_time),
        cancellationReason: reason,
      },
    };
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const conn = await p.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query<any[]>(
        `SELECT b.*, s.name as service_name, t.duration_minutes, t.currency
         FROM bookings b
         LEFT JOIN service_tiers t ON b.service_tier_id = t.id
         LEFT JOIN services s ON t.service_id = s.id
         WHERE b.id = ? FOR UPDATE`,
        [bookingId]
      );

      if (rows.length === 0) {
        await conn.rollback();
        return { success: false, error: "Booking not found" };
      }

      const booking = rows[0];

      await conn.query("UPDATE bookings SET status = 'CANCELLED', cancellation_reason = ? WHERE id = ?", [
        reason,
        bookingId,
      ]);
      await conn.query("DELETE FROM time_blocks WHERE booking_id = ?", [bookingId]);

      await conn.commit();
      return {
        success: true,
        booking: {
          id: booking.id,
          referenceNumber: booking.reference_code || `YYC-${String(booking.id).padStart(6, "0")}`,
          serviceName: booking.service_name || "Clinical Reflexology",
          durationMinutes: Number(booking.duration_minutes || 60),
          totalPrice: Number(booking.total_price),
          currency: booking.currency || "CAD",
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

  const store = getStore();
  const booking = store.bookings.find((b) => b.id === bookingId);
  if (!booking) {
    return { success: false, error: "Booking not found" };
  }

  booking.status = "CANCELLED";
  booking.cancellation_reason = reason;

  const blockIdx = store.timeBlocks.findIndex((b) => b.booking_id === bookingId);
  if (blockIdx !== -1) {
    store.timeBlocks.splice(blockIdx, 1);
  }

  saveStoreToDisk(store);

  const tier = store.serviceTiers.find((t) => t.id === booking.service_tier_id);
  const service = tier ? store.services.find((s) => s.id === tier.service_id) : null;

  return {
    success: true,
    booking: {
      id: booking.id,
      referenceNumber: booking.reference_number || `YYC-${String(booking.id).padStart(6, "0")}`,
      serviceName: service ? service.name : "Reflexology Therapy",
      durationMinutes: tier ? tier.duration_minutes : 60,
      totalPrice: Number(booking.total_price),
      currency: tier ? tier.currency : "CAD",
      clientName: booking.client_name,
      clientEmail: booking.client_email,
      clientPhone: booking.client_phone,
      clientAddress: booking.client_address,
      startTime: parseClinicDateTime(booking.start_time),
      endTime: parseClinicDateTime(booking.end_time),
      cancellationReason: reason,
    },
  };
}

/**
 * Admin: Update tier price
 */
export async function updateServiceTierPrice(tierId: number, price: number): Promise<boolean> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const res = await sql`UPDATE service_tiers SET price = ${price} WHERE id = ${tierId} RETURNING id`;
    return res.length > 0;
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const [res] = await p.query<any>("UPDATE service_tiers SET price = ? WHERE id = ?", [price, tierId]);
    return res.affectedRows > 0;
  }

  const store = getStore();
  const tier = store.serviceTiers.find((t) => t.id === tierId);
  if (tier) {
    tier.price = price;
    saveStoreToDisk(store);
    return true;
  }
  return false;
}

/**
 * Admin: Create a new clinical service
 */
export async function createService(params: { name: string; description: string }): Promise<{ id: number }> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const [row] = await sql`
      INSERT INTO services (name, description, is_active) VALUES (${params.name}, ${params.description}, TRUE)
      RETURNING id
    `;
    return { id: row.id };
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const [res] = await p.query<any>("INSERT INTO services (name, description, is_active) VALUES (?, ?, TRUE)", [
      params.name,
      params.description,
    ]);
    return { id: res.insertId };
  }

  const store = getStore();
  const id = store.nextServiceId ? store.nextServiceId++ : 5;
  store.services.push({
    id,
    name: params.name,
    description: params.description,
    is_active: true,
    created_at: new Date().toISOString(),
  });
  saveStoreToDisk(store);
  return { id };
}

/**
 * Admin: Delete service
 */
export async function deleteService(serviceId: number): Promise<boolean> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    await sql`DELETE FROM service_tiers WHERE service_id = ${serviceId}`;
    const res = await sql`DELETE FROM services WHERE id = ${serviceId} RETURNING id`;
    return res.length > 0;
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const [res] = await p.query<any>("DELETE FROM services WHERE id = ?", [serviceId]);
    return res.affectedRows > 0;
  }

  const store = getStore();
  const idx = store.services.findIndex((s) => s.id === serviceId);
  if (idx !== -1) {
    store.services.splice(idx, 1);
    store.serviceTiers = store.serviceTiers.filter((t) => t.service_id !== serviceId);
    saveStoreToDisk(store);
    return true;
  }
  return false;
}

/**
 * Admin: Add duration tier
 */
export async function addServiceTier(params: {
  serviceId: number;
  durationMinutes: number;
  price: number;
  currency?: string;
}): Promise<{ id: number }> {
  const currency = params.currency || "CAD";
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const [row] = await sql`
      INSERT INTO service_tiers (service_id, duration_minutes, price, currency)
      VALUES (${params.serviceId}, ${params.durationMinutes}, ${params.price}, ${currency})
      ON CONFLICT (service_id, duration_minutes) DO UPDATE SET price = EXCLUDED.price
      RETURNING id
    `;
    return { id: row.id };
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const [res] = await p.query<any>(
      `INSERT INTO service_tiers (service_id, duration_minutes, price, currency) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE price = VALUES(price)`,
      [params.serviceId, params.durationMinutes, params.price, currency]
    );
    return { id: res.insertId || params.serviceId };
  }

  const store = getStore();
  const existing = store.serviceTiers.find(
    (t) => t.service_id === params.serviceId && t.duration_minutes === params.durationMinutes
  );
  if (existing) {
    existing.price = params.price;
    saveStoreToDisk(store);
    return { id: existing.id };
  }

  const id = store.nextTierId ? store.nextTierId++ : 13;
  store.serviceTiers.push({
    id,
    service_id: params.serviceId,
    duration_minutes: params.durationMinutes,
    price: params.price,
    currency,
  });
  saveStoreToDisk(store);
  return { id };
}

/**
 * Admin: Delete duration tier
 */
export async function deleteServiceTier(tierId: number): Promise<boolean> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const res = await sql`DELETE FROM service_tiers WHERE id = ${tierId} RETURNING id`;
    return res.length > 0;
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const [res] = await p.query<any>("DELETE FROM service_tiers WHERE id = ?", [tierId]);
    return res.affectedRows > 0;
  }

  const store = getStore();
  const idx = store.serviceTiers.findIndex((t) => t.id === tierId);
  if (idx !== -1) {
    store.serviceTiers.splice(idx, 1);
    saveStoreToDisk(store);
    return true;
  }
  return false;
}

/**
 * Clinic Settings: Get working hours
 */
export async function getClinicSettings(): Promise<{ startTime: string; endTime: string }> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const rows = await sql`SELECT setting_key, setting_value FROM clinic_settings`;
    const map: Record<string, string> = {};
    for (const r of rows) map[r.setting_key] = r.setting_value;
    return {
      startTime: map["clinic_start_time"] || "09:00",
      endTime: map["clinic_end_time"] || "18:00",
    };
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const [rows] = await p.query<any[]>("SELECT setting_key, setting_value FROM clinic_settings");
    const settingsMap: Record<string, string> = {};
    for (const r of rows) settingsMap[r.setting_key] = r.setting_value;
    return {
      startTime: settingsMap["clinic_start_time"] || "09:00",
      endTime: settingsMap["clinic_end_time"] || "18:00",
    };
  }

  const store = getStore();
  return {
    startTime: store.settings?.clinic_start_time || "09:00",
    endTime: store.settings?.clinic_end_time || "18:00",
  };
}

/**
 * Clinic Settings: Update working hours
 */
export async function updateClinicSettings(startTime: string, endTime: string): Promise<boolean> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    await sql`
      INSERT INTO clinic_settings (setting_key, setting_value) VALUES 
      ('clinic_start_time', ${startTime}), ('clinic_end_time', ${endTime})
      ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
    `;
    return true;
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    await p.query(
      `INSERT INTO clinic_settings (setting_key, setting_value) VALUES 
       ('clinic_start_time', ?), ('clinic_end_time', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [startTime, endTime]
    );
    return true;
  }

  const store = getStore();
  if (!store.settings) store.settings = { clinic_start_time: "09:00", clinic_end_time: "18:00" };
  store.settings.clinic_start_time = startTime;
  store.settings.clinic_end_time = endTime;
  saveStoreToDisk(store);
  return true;
}

/**
 * Clinic Holidays: Get all scheduled holidays
 */
export async function getClinicHolidays(): Promise<{ id: number; holidayDate: string; name: string }[]> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const rows = await sql`SELECT id, holiday_date, name FROM clinic_holidays ORDER BY holiday_date ASC`;
    return rows.map((r: any) => ({
      id: r.id,
      holidayDate: r.holiday_date,
      name: r.name,
    }));
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const [rows] = await p.query<any[]>("SELECT id, holiday_date, name FROM clinic_holidays ORDER BY holiday_date ASC");
    return rows.map((r) => ({
      id: r.id,
      holidayDate: formatToClinicDateStr(new Date(r.holiday_date)),
      name: r.name,
    }));
  }

  const store = getStore();
  return (store.holidays || []).map((h) => ({
    id: h.id,
    holidayDate: h.holiday_date,
    name: h.name,
  }));
}

/**
 * Clinic Holidays: Add new holiday
 */
export async function addClinicHoliday(holidayDate: string, name: string): Promise<{ id: number }> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const [row] = await sql`
      INSERT INTO clinic_holidays (holiday_date, name) VALUES (${holidayDate}, ${name})
      ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    return { id: row.id };
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const [res] = await p.query<any>(
      `INSERT INTO clinic_holidays (holiday_date, name) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [holidayDate, name]
    );
    return { id: res.insertId };
  }

  const store = getStore();
  if (!store.holidays) store.holidays = [];
  const id = store.nextHolidayId ? store.nextHolidayId++ : 1;
  store.holidays.push({ id, holiday_date: holidayDate, name });
  saveStoreToDisk(store);
  return { id };
}

/**
 * Clinic Holidays: Delete holiday
 */
export async function deleteClinicHoliday(holidayId: number): Promise<boolean> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const res = await sql`DELETE FROM clinic_holidays WHERE id = ${holidayId} RETURNING id`;
    return res.length > 0;
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const [res] = await p.query<any>("DELETE FROM clinic_holidays WHERE id = ?", [holidayId]);
    return res.affectedRows > 0;
  }

  const store = getStore();
  if (!store.holidays) store.holidays = [];
  const idx = store.holidays.findIndex((h) => h.id === holidayId);
  if (idx !== -1) {
    store.holidays.splice(idx, 1);
    saveStoreToDisk(store);
    return true;
  }
  return false;
}

/**
 * Check if holiday
 */
export async function checkIfHoliday(dateStr: string): Promise<{ isHoliday: boolean; holidayName?: string }> {
  const dbType = await isDatabaseActive();

  if (dbType === "postgres") {
    await ensurePostgresSchema();
    const sql = getPostgresClient()!;
    const rows = await sql`SELECT name FROM clinic_holidays WHERE holiday_date = ${dateStr}`;
    if (rows.length > 0) return { isHoliday: true, holidayName: rows[0].name };
    return { isHoliday: false };
  }

  if (dbType === "mysql") {
    const p = getMySqlPool();
    const [rows] = await p.query<any[]>("SELECT name FROM clinic_holidays WHERE holiday_date = ?", [dateStr]);
    if (rows.length > 0) return { isHoliday: true, holidayName: rows[0].name };
    return { isHoliday: false };
  }

  const store = getStore();
  const found = (store.holidays || []).find((h) => h.holiday_date === dateStr);
  if (found) return { isHoliday: true, holidayName: found.name };
  return { isHoliday: false };
}
