import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

async function initDatabase() {
  console.log("Connecting to MariaDB / MySQL on 127.0.0.1:3306...");
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1",
      port: parseInt(process.env.DB_PORT || "3306", 10),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      multipleStatements: true,
    });

    console.log("Connected to MySQL server. Running schema.sql...");
    const sqlPath = path.resolve("scripts/schema.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    await conn.query(sql);
    console.log("Schema and seed data applied successfully!");

    const [services] = await conn.query("SELECT id, name FROM yyc_booking.services");
    console.log("Verified services table in MariaDB:", services);

    await conn.end();
  } catch (err) {
    console.error("Database initialization notice:", err.message);
  }
}

initDatabase();
