(() => {
  const $ = (s) => document.querySelector(s);
  const status = $("#status");
  const rowsEl = $("#rows");
  const pwEl = $("#pw");

  function setStatus(msg) { status.textContent = msg || ""; }

  // If you opened the admin page as file:// it will fail.
  if (window.location.protocol === "file:") {
    setStatus("Open this page via http://localhost:3000/admin (not file://).");
    return;
  }

  const API_URL = new URL("/api/admin/rsvps", window.location.origin).toString();

  function authHeader() {
    const pw = pwEl.value || sessionStorage.getItem("adminPw") || "";
    if (!pw) throw new Error("Enter the admin password.");
    sessionStorage.setItem("adminPw", pw);
    const token = btoa(`admin:${pw}`);
    return { Authorization: `Basic ${token}` };
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    }[c]));
  }

  let latest = [];

  async function load() {
    setStatus("Loading…");
    rowsEl.innerHTML = "";

    try {
      const res = await fetch(API_URL, { headers: authHeader() });

      if (!res.ok) {
        // Helpful message if password is wrong
        if (res.status === 401) throw new Error("Wrong password (401). Check ADMIN_PASSWORD in .env and restart server.");
        throw new Error(`Request failed (${res.status}).`);
      }

      const data = await res.json();
      latest = data.rsvps || [];

      if (!latest.length) {
        setStatus("No RSVPs yet.");
        return;
      }

      setStatus(`Loaded ${latest.length} RSVP(s).`);

      // UPDATED columns for your current RSVP form:
      // id, name, guestCount, email, phone, message, createdAt
      rowsEl.innerHTML = latest.map((r) => `
        <tr>
          <td>${esc(r.id)}</td>
          <td><strong>${esc(r.name)}</strong></td>
          <td>${esc(r.guestCount)}</td>
          <td>${esc(r.email)}</td>
          <td>${esc(r.phone)}</td>
          <td>${esc(r.message)}</td>
          <td>${esc(r.createdAt)}</td>
        </tr>
      `).join("");

    } catch (e) {
      // Browser often gives exactly "Failed to fetch" for network/server issues
      const msg = e?.message || "Could not load.";
      setStatus(msg.includes("Failed to fetch")
        ? "Failed to fetch. Make sure the server is running and you opened /admin from http://localhost:3000/admin."
        : msg
      );
    }
  }

  function exportCsv() {
    if (!latest.length) return setStatus("Nothing to export yet.");

    const headers = ["id","name","guestCount","email","phone","message","createdAt"];
    const lines = [
      headers.join(","),
      ...latest.map((r) => headers.map((h) => {
        const v = String(r[h] ?? "");
        const escaped = v.replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(","))
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rsvps.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("Exported CSV.");
  }

  $("#load")?.addEventListener("click", load);
  $("#export")?.addEventListener("click", exportCsv);
})();
