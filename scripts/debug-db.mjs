import mysql from "mysql2/promise";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

async function testDateStrings() {
  const p = mysql.createPool({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "yyc_booking",
    dateStrings: true, // Crucial!
  });

  const [rows] = await p.query("SELECT id, start_time, end_time, block_type, reason FROM time_blocks");
  console.log("With dateStrings: true, raw strings from DB:");
  console.log(rows);

  const rawStart = rows[0].start_time; // e.g. "2026-09-15 14:00:00"
  console.log("Raw string:", rawStart);

  const mtDate = fromZonedTime(rawStart, "America/Edmonton");
  console.log("Parsed strictly in America/Edmonton MT:", mtDate.toISOString());
  console.log("Formatted in MT:", formatInTimeZone(mtDate, "America/Edmonton", "yyyy-MM-dd HH:mm:ss"));

  await p.end();
}

testDateStrings();
