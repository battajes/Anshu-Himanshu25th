(() => {
  const $ = (sel) => document.querySelector(sel);

  // If you want a no-backend setup (Formspree/Netlify/etc), set:
  //   window.RSVP_ENDPOINT = "https://formspree.io/f/XXXXXXX";
  // in index.html BEFORE this script tag, or just edit ENDPOINT here.
  const ENDPOINT = window.RSVP_ENDPOINT || "/api/rsvp";
  const HEALTH = window.RSVP_HEALTH || "/api/health";

  const form = $("#rsvpForm");
  const status = $("#status");
  const submitBtn = $("#submitBtn");
  const connectionState = $("#connectionState");

  function setStatus(msg, kind = "info") {
    status.textContent = msg || "";
    status.dataset.kind = kind;
  }

  async function checkConnection() {
    try {
      const res = await fetch(HEALTH, { method: "GET" });
      if (!res.ok) throw new Error("health not ok");
      connectionState.textContent = "yes ✅";
    } catch {
      // Not fatal. Could be a static host using Formspree, etc.
      connectionState.textContent = "maybe (static mode)";
    }
  }

  function formToJson(formEl) {
    const fd = new FormData(formEl);
    const obj = Object.fromEntries(fd.entries());
    obj.guestCount = Number(obj.guestCount || 1);
    obj.createdAt = new Date().toISOString();
    return obj;
  }

  async function submitToServer(payload) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let message = "Something went wrong.";
      try {
        const data = await res.json();
        message = data?.error || data?.message || message;
      } catch {}
      throw new Error(message);
    }

    try { return await res.json(); } catch { return { ok: true }; }
  }

  // ---------- ADD TO CALENDAR (ICS) ----------
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  // Local time format for ICS: YYYYMMDDTHHMMSS
  function toICSLocal(dt) {
    return (
      dt.getFullYear() +
      pad(dt.getMonth() + 1) +
      pad(dt.getDate()) +
      "T" +
      pad(dt.getHours()) +
      pad(dt.getMinutes()) +
      "00"
    );
  }

  function escapeICS(text) {
    return String(text || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function downloadIcs() {
    const tzid = "America/Toronto";

    // Pull venue + address from your page
    const venue = $("#eventVenue")?.textContent?.trim() || "Apollo Convention Centre";
    const address = $("#eventDress")?.textContent?.trim() || "6591 Innovator Drive, Mississauga";
    const location = `${venue}, ${address}`;

    const title = "Anshu & Himanshu Anniversary Party";
    const description =
      "We can’t wait to celebrate with you! Please RSVP on the invitation website.";

    // Dec 27, 2025 @ 6:00 PM to Dec 28, 2025 @ 1:00 AM (Toronto time)
    const startDate = new Date(2025, 11, 27, 18, 0, 0); // Dec 27, 2025 6:00 PM
    const endDate = new Date(2025, 11, 28, 1, 0, 0);    // Dec 28, 2025 1:00 AM

    // DTSTAMP must be UTC (Z)
    const dtstamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .split(".")[0] + "Z";

    const uid = (crypto?.randomUUID?.() || Date.now()) + "@anniversary";

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Anniversary RSVP//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=${tzid}:${toICSLocal(startDate)}`,
      `DTEND;TZID=${tzid}:${toICSLocal(endDate)}`,
      `SUMMARY:${escapeICS(title)}`,
      `DESCRIPTION:${escapeICS(description)}`,
      `LOCATION:${escapeICS(location)}`,
      // Optional reminder (24 hours before)
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      "DESCRIPTION:Reminder",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anniversary.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  $("#addToCalendarBtn")?.addEventListener("click", downloadIcs);
  // ---------- END CALENDAR ----------

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("");

    const payload = formToJson(form);
    if (!payload.name?.trim()) return setStatus("Please enter your name.", "error");
    if (!payload.guestCount || payload.guestCount < 1) return setStatus("Guest count must be at least 1.", "error");

    submitBtn.disabled = true;
    setStatus("Submitting…");

    try {
      const result = await submitToServer(payload);
      const rsvpId = result?.id ? ` (RSVP #${result.id})` : "";
      setStatus(`Thanks! Your RSVP was received${rsvpId}.`, "ok");
      form.reset();
      form.querySelector('input[name="guestCount"]').value = 1;
      window.location.hash = "#rsvp";
    } catch (err) {
      setStatus(err?.message || "Could not submit RSVP. Please try again.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  checkConnection();
})();
