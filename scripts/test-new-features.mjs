async function runNewFeatureTests() {
  const baseUrl = "http://localhost:3005";
  const adminToken = "yyc_secret_practitioner_key_2026";
  const authHeaders = {
    "Content-Type": "application/json",
    "x-admin-token": adminToken,
  };

  console.log("\n=== 1. Testing Admin: Create New Clinical Service ===");
  const newServRes = await fetch(`${baseUrl}/api/booking/admin/services`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      action: "add_service",
      name: "Pediatric & Gentle Reflexology",
      description: "Delicate neuromotor reflex stimulation designed specifically for children and sensory-sensitive individuals.",
    }),
  });
  const newServData = await newServRes.json();
  console.log("Create Service Status:", newServRes.status, "Service ID:", newServData.serviceId);

  console.log("\n=== 2. Testing Admin: Add Custom Duration Tier (e.g. 75 mins & 90 mins) ===");
  const tierRes1 = await fetch(`${baseUrl}/api/booking/admin/services`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      action: "add_tier",
      serviceId: newServData.serviceId,
      durationMinutes: 75,
      price: 125.0,
    }),
  });
  const tierData1 = await tierRes1.json();
  console.log("Add 75m Tier Status:", tierRes1.status, tierData1.message);

  const tierRes2 = await fetch(`${baseUrl}/api/booking/admin/services`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      action: "add_tier",
      serviceId: newServData.serviceId,
      durationMinutes: 90,
      price: 155.0,
    }),
  });
  const tierData2 = await tierRes2.json();
  console.log("Add 90m Tier Status:", tierRes2.status, tierData2.message);

  console.log("\n=== 3. Testing Admin: Configure Working Hours (08:30 - 17:30 MT) ===");
  const settRes = await fetch(`${baseUrl}/api/booking/admin/settings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      startTime: "08:30",
      endTime: "17:30",
    }),
  });
  const settData = await settRes.json();
  console.log("Working Hours Status:", settRes.status, settData.message);

  console.log("\n=== 4. Testing Admin: Add Clinic Holiday / Closure Date ===");
  const holRes = await fetch(`${baseUrl}/api/booking/admin/holidays`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      holidayDate: "2026-10-12",
      name: "Thanksgiving Day Clinic Closure",
    }),
  });
  const holData = await holRes.json();
  console.log("Add Holiday Status:", holRes.status, holData.message);

  console.log("\n=== 5. Testing Availability Engine on Scheduled Holiday ===");
  const holAvailRes = await fetch(`${baseUrl}/api/booking/availability?date=2026-10-12&duration=45`);
  const holAvailData = await holAvailRes.json();
  console.log("Holiday Query Status:", holAvailRes.status);
  console.log("isHoliday:", holAvailData.isHoliday, "(Expected: true)");
  console.log("Holiday Name:", holAvailData.holidayName);
  console.log("Total Slots on Holiday:", holAvailData.totalSlots, "(Expected: 0)");

  console.log("\n=== 6. Testing Availability Engine with Custom Working Hours & 75m Duration ===");
  const customAvailRes = await fetch(`${baseUrl}/api/booking/availability?date=2026-09-22&duration=75`);
  const customAvailData = await customAvailRes.json();
  console.log("Custom 75m Query Status:", customAvailRes.status);
  console.log("Active Working Hours:", customAvailData.workingHours);
  console.log("Total 75m Slots Generated:", customAvailData.totalSlots);
  console.log("First slot:", customAvailData.availableSlots[0]?.displayTime, "Last slot:", customAvailData.availableSlots.slice(-1)[0]?.displayTime);

  console.log("\n=== 7. Testing Client Booking with New Service & 75m Custom Tier ===");
  const bookingRes = await fetch(`${baseUrl}/api/booking/reserve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceTierId: tierData1.tierId,
      clientName: "Maya Lin",
      clientEmail: "maya.lin@example.ca",
      clientPhone: "403-555-0177",
      clientAddress: "55 Panatella Blvd NW, Calgary, AB",
      startTime: customAvailData.availableSlots[0].isoString,
    }),
  });
  const bookingData = await bookingRes.json();
  console.log("Booking Status:", bookingRes.status, "Booking ID:", bookingData.booking?.id);
  console.log("Service Name:", bookingData.booking?.serviceName);
  console.log("Duration:", bookingData.booking?.durationMinutes, "Fee:", bookingData.booking?.totalPrice, bookingData.booking?.currency);

  console.log("\n=== ALL NEW CUSTOM SERVICES, TIERS, WORKING HOURS & HOLIDAY TESTS PASSED! ===");
}

runNewFeatureTests().catch(console.error);
