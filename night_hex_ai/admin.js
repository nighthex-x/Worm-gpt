
/* ==========================================
   NIGHT HEX AI - ADMIN PANEL
   SUPABASE CONFIGURATION
========================================== */

const URL = "https://mskcclqkvmurlcwwfgyr.supabase.co";

const KEY = "sb_publishable_rxjUd6jKp9-I71GItqOlAA_s1vZEepz";


/* ==========================================
   ELEMENTS
========================================== */

const out = document.getElementById("notice");
const stats = document.getElementById("stats");
const rows = document.getElementById("users");


/* ==========================================
   ADMIN DASHBOARD
========================================== */

(async () => {

  if (
    !URL.startsWith("https://") ||
    KEY.includes("YOUR_")
  ) {
    out.textContent =
      "Configure Supabase URL and Publishable Key in admin.js.";

    return;
  }

  const sb = window.supabase.createClient(URL, KEY);

  /* CHECK SESSION */

  const {
    data: { session },
    error: sessionError
  } = await sb.auth.getSession();

  if (sessionError) {
    out.textContent = "Could not verify login session.";
    return;
  }

  if (!session) {
    out.textContent =
      "Please sign in on the main website first, then open /admin.html.";

    return;
  }

  /* REQUEST ADMIN API */

  const r = await fetch("/api/admin", {
    headers: {
      Authorization: "Bearer " + session.access_token
    }
  });

  const d = await r.json();

  if (!r.ok) {
    out.textContent = d.error || "Admin access denied.";
    return;
  }

  /* ADMIN ACCESS GRANTED */

  out.textContent = "Admin access granted.";

  /* DASHBOARD STATISTICS */

  [
    ["Users", d.totals.users],
    ["Chats", d.totals.chats],
    ["Messages", d.totals.messages]
  ].forEach(([label, value]) => {

    const card = document.createElement("div");

    card.style.cssText = `
      background:#101a2a;
      border:1px solid #263951;
      border-radius:12px;
      padding:18px;
    `;

    const title = document.createElement("div");

    title.style.cssText = `
      color:#8a9bb2;
      font-size:11px;
    `;

    title.textContent = label;

    const number = document.createElement("div");

    number.style.cssText = `
      font-size:27px;
      font-weight:800;
      margin-top:8px;
      color:#ffffff;
    `;

    number.textContent = value ?? 0;

    card.appendChild(title);
    card.appendChild(number);

    stats.appendChild(card);

  });


  /* USER INFORMATION TABLE */

  (d.users || []).forEach(u => {

    const tr = document.createElement("tr");

    const values = [
      u.email || "—",

      u.created_at
        ? new Date(u.created_at).toLocaleString()
        : "—",

      u.last_sign_in_at
        ? new Date(u.last_sign_in_at).toLocaleString()
        : "Never",

      u.email_confirmed_at
        ? "Yes"
        : "No"
    ];

    values.forEach(v => {

      const td = document.createElement("td");

      td.style.cssText = `
        padding:10px;
        border-top:1px solid #23334a;
        color:#c9d7e8;
      `;

      td.textContent = v;

      tr.appendChild(td);

    });

    rows.appendChild(tr);

  });

})().catch(e => {

  out.textContent =
    "Could not load dashboard: " + e.message;

  console.error("Admin dashboard error:", e);

});
