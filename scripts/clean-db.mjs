import mysql from "mysql2/promise";

async function clean() {
  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "yyc_booking",
  });
  await conn.query("DELETE FROM time_blocks");
  await conn.query("DELETE FROM bookings");
  console.log("Cleaned time_blocks and bookings");
  await conn.end();
}

clean();
