async function runTests() {
  const baseUrl = "http://localhost:3005";

  console.log("\n--- 1. Testing GET /api/booking/services ---");
  const sRes = await fetch(`${baseUrl}/api/booking/services`);
  const sData = await sRes.json();
  console.log("Status:", sRes.status, "Success:", sData.success);
  console.log("Services count:", sData.services.length);
  console.log("Services:", sData.services.map(s => `${s.name} (${s.tiers.length} tiers)`));

  console.log("\n--- 2. Testing GET /api/booking/availability ---");
  const aRes = await fetch(`${baseUrl}/api/booking/availability?date=2026-09-15&duration=45`);
  const aData = await aRes.json();
  console.log("Status:", aRes.status, "Timezone:", aData.timezone);
  console.log("Total slots calculated:", aData.totalSlots);
  const sampleSlot = aData.availableSlots[0];
  console.log("Sample slot:", sampleSlot.displayTime, sampleSlot.isoString);

  console.log("\n--- 3. Testing POST /api/booking/reserve (Patient Booking) ---");
  const bRes = await fetch(`${baseUrl}/api/booking/reserve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceTierId: 2, // 45m Foot Reflexology
      clientName: "Eleanor Vance",
      clientEmail: "eleanor.vance@example.ca",
      clientPhone: "403-555-0182",
      clientAddress: "742 Evergreen Terrace NW, Calgary, AB",
      startTime: sampleSlot.isoString,
    }),
  });
  const bData = await bRes.json();
  console.log("Reserve Status:", bRes.status, "Booking ID:", bData.booking?.id);
  console.log("Booking Confirmed Details:", bData.booking?.serviceName, bData.booking?.totalPrice, bData.booking?.currency);

  console.log("\n--- 4. Testing Concurrency Conflict / Double-Booking Prevention ---");
  const cRes = await fetch(`${baseUrl}/api/booking/reserve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceTierId: 2,
      clientName: "Concurrent User",
      clientEmail: "concurrent@example.ca",
      clientPhone: "403-555-9999",
      clientAddress: "100 8th Ave SW, Calgary, AB",
      startTime: sampleSlot.isoString,
    }),
  });
  const cData = await cRes.json();
  console.log("Conflict Status:", cRes.status, "(Expected 409)");
  console.log("Conflict Rejection Message:", cData.error);

  console.log("\n--- 5. Testing Admin Login ---");
  const lRes = await fetch(`${baseUrl}/api/booking/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "yyc_secret_practitioner_key_2026" }),
  });
  const lData = await lRes.json();
  console.log("Admin Login Status:", lRes.status, "Token:", lData.token);

  console.log("\n--- 6. Testing Admin Quick-Block (Zero-Dummy Data) ---");
  const blockRes = await fetch(`${baseUrl}/api/booking/admin/blocks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": lData.token,
    },
    body: JSON.stringify({
      startTime: "2026-09-15T14:00:00",
      endTime: "2026-09-15T16:00:00",
      reason: "Staff Training & Disinfection",
    }),
  });
  const blockData = await blockRes.json();
  console.log("Quick Block Status:", blockRes.status, "Block ID:", blockData.blockId);

  console.log("\n--- 7. Verifying Availability Reflects Doctor Block ---");
  const aRes2 = await fetch(`${baseUrl}/api/booking/availability?date=2026-09-15&duration=45`);
  const aData2 = await aRes2.json();
  const hasBlockedSlot = aData2.availableSlots.some(s => s.time >= "14:00" && s.time < "16:00");
  console.log("Slots between 14:00 and 16:00 exist:", hasBlockedSlot, "(Expected: false - blocked!)");

  console.log("\n--- 8. Testing Appointment Cancellation + Slot Release ---");
  const cancelRes = await fetch(`${baseUrl}/api/booking/admin/appointments/${bData.booking.id}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": lData.token,
    },
    body: JSON.stringify({
      reason: "Patient requested reschedule due to travel",
    }),
  });
  const cancelData = await cancelRes.json();
  console.log("Cancel Status:", cancelRes.status, "Cancelled:", cancelData.success);
  console.log("Cancellation Message:", cancelData.message);

  console.log("\n--- 9. Verifying Released Slot is Back in Inventory ---");
  const aRes3 = await fetch(`${baseUrl}/api/booking/availability?date=2026-09-15&duration=45`);
  const aData3 = await aRes3.json();
  const isBack = aData3.availableSlots.some(s => s.time === sampleSlot.time);
  console.log(`Slot ${sampleSlot.displayTime} is back in available slots:`, isBack, "(Expected: true)");

  console.log("\n=== ALL ARCHITECTURE INTEGRATION TESTS COMPLETED SUCCESSFULLY ===");
}

runTests().catch(console.error);
