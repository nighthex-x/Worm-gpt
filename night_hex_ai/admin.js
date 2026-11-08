const SUPABASE_URL = "https://mskcclqkvmurlcwwfgyr.supabase.co";
const SUPABASE_KEY = "sb_publishable_rxjUd6jKp9-I71GItqOlAA_s1vZEepz";
const $ = (id) => document.getElementById(id);
let sb;
let allUsers = [];
let loading = false;

function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = String(message || "Something went wrong");
  el.classList.add("show");
  clearTimeout(window.__nhToastTimer);
  window.__nhToastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}
function showLogin() {
  $("dashboard").classList.add("hidden");
  $("loginPanel").classList.remove("hidden");
}
function showDashboard() {
  $("loginPanel").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
}
function showNotice(message) {
  const el = $("notice");
  if (el) el.textContent = message;
}
function setLoginBusy(busy) {
  const button = $("adminSubmit");
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? "Verifying…" : "Secure sign in";
}

async function requestAdmin(method = "GET", payload) {
  const { data, error } = await sb.auth.getSession();
  if (error) throw new Error("Could not read the saved login session. Please sign in again.");
  const session = data?.session;
  if (!session?.access_token) throw new Error("Your login session has expired. Please sign in again.");

  const response = await fetch("/api/admin", {
    method,
    cache: "no-store",
    headers: {
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json"
    },
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(result.error || `Admin server returned HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return result;
}

function stat(label, value) {
  const card = document.createElement("article");
  card.className = "stat-card";
  const title = document.createElement("div");
  title.className = "muted";
  title.textContent = label;
  const number = document.createElement("strong");
  number.textContent = String(value ?? 0);
  card.append(title, number);
  return card;
}

function drawUsers() {
  const search = ($("userSearch")?.value || "").trim().toLowerCase();
  const body = $("users");
  body.replaceChildren();
  allUsers.filter(user =>
    `${user.name || ""} ${user.email || ""}`.toLowerCase().includes(search)
  ).forEach(user => {
    const tr = document.createElement("tr");
    const cell = value => {
      const td = document.createElement("td");
      td.textContent = value;
      return td;
    };
    tr.append(
      cell(user.name || "—"),
      cell(user.email || "—"),
      cell(user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"),
      cell(user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Never")
    );
    tr.append(cell(user.banned_until && new Date(user.banned_until) > new Date() ? "Blocked" : "Active"));

    const actions = cell("");
    const reset = document.createElement("button");
    reset.className = "admin-action";
    reset.textContent = "Reset password";
    reset.onclick = async () => {
      if (!confirm(`Send a password reset email to ${user.email}?`)) return;
      try {
        await requestAdmin("POST", { action: "reset_password", userId: user.id });
        toast("Password reset email sent");
      } catch (error) { toast(error.message); }
    };
    actions.append(reset);

    if (user.banned_until && new Date(user.banned_until) > new Date()) {
      const unblock = document.createElement("button");
      unblock.className = "admin-action";
      unblock.textContent = "Unblock";
      unblock.onclick = () => accountAction(user, "unban");
      actions.append(unblock);
    } else {
      const select = document.createElement("select");
      select.className = "admin-duration";
      [["1h","1 hour"],["24h","1 day"],["7d","7 days"],["30d","30 days"],["876000h","Long term"]]
        .forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          select.append(option);
        });
      const block = document.createElement("button");
      block.className = "admin-action danger-btn";
      block.textContent = "Block";
      block.onclick = () => accountAction(user, "ban", select.value);
      actions.append(select, block);
    }
    tr.append(actions);
    body.append(tr);
  });
}

async function accountAction(user, action, duration) {
  const verb = action === "ban" ? "Block" : "Unblock";
  if (!confirm(`${verb} ${user.email || "this account"}?`)) return;
  try {
    await requestAdmin("POST", { action, userId: user.id, duration });
    toast("Account updated");
    await loadAdmin();
  } catch (error) { toast(error.message); }
}

async function loadAdmin() {
  if (loading) return;
  loading = true;
  showNotice("Checking saved session and verifying administrator access…");
  try {
    const result = await requestAdmin();
    showDashboard();
    showNotice("Verified administrator · " + (result.admin?.email || "Access confirmed"));

    $("stats").replaceChildren(
      stat("Users", result.totals?.users),
      stat("Chats", result.totals?.chats),
      stat("Messages", result.totals?.messages),
      stat("Active today", result.totals?.activeToday)
    );

    allUsers = result.users || [];
    drawUsers();
    $("maintenanceToggle").checked = !!result.maintenance?.maintenance_enabled;
    $("maintenanceText").value = result.maintenance?.maintenance_message || "";

    $("announcementRows").replaceChildren();
    (result.announcements || []).forEach(item => {
      const row = document.createElement("div");
      row.className = "announcement-row";
      const label = document.createElement("span");
      label.textContent = `${item.title} · ${new Date(item.created_at).toLocaleDateString()}`;
      const remove = document.createElement("button");
      remove.className = "admin-action danger-btn";
      remove.textContent = "Delete";
      remove.onclick = async () => {
        if (!confirm("Delete this announcement?")) return;
        try {
          await requestAdmin("POST", { action: "delete_announcement", id: item.id });
          toast("Announcement deleted");
          await loadAdmin();
        } catch (error) { toast(error.message); }
      };
      row.append(label, remove);
      $("announcementRows").append(row);
    });

    $("categoryStats").replaceChildren();
    const categories = result.analytics?.categories || {};
    const total = Object.values(categories).reduce((sum, count) => sum + Number(count || 0), 0) || 1;
    Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
      const row = document.createElement("div");
      row.className = "category-row";
      const label = document.createElement("span");
      label.textContent = name;
      const percent = Math.round(Number(count || 0) / total * 100);
      const value = document.createElement("strong");
      value.textContent = percent + "%";
      const track = document.createElement("div");
      track.className = "category-track";
      const fill = document.createElement("i");
      fill.style.width = percent + "%";
      track.append(fill);
      row.append(label, value, track);
      $("categoryStats").append(row);
    });
  } catch (error) {
    const status = error.status;
    if (status === 401 || status === 403) {
      // Only clear a session when the server explicitly rejects it.
      await sb.auth.signOut();
      showLogin();
    } else {
      // Keep a valid Supabase session if the admin API/config is temporarily unavailable.
      showLogin();
    }
    showNotice(error.message);
    toast(error.message);
  } finally {
    loading = false;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  event.stopPropagation();
  setLoginBusy(true);
  try {
    const email = $("adminEmail").value.trim().toLowerCase();
    const password = $("adminPassword").value;
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.session) throw new Error("Supabase did not create a login session. Check email confirmation and account status.");
    // Session is persisted by Supabase in this browser; server then independently verifies ADMIN_EMAIL.
    await loadAdmin();
  } catch (error) {
    toast(error.message || "Login failed");
    showNotice(error.message || "Login failed");
  } finally {
    setLoginBusy(false);
    $("adminPassword").value = "";
  }
}

async function initAdmin() {
  try {
    if (!window.supabase?.createClient) {
      throw new Error("Supabase authentication library did not load. Check internet and reload.");
    }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    $("adminLogin").addEventListener("submit", handleLogin);
    $("adminSignOut").addEventListener("click", async () => {
      await sb.auth.signOut();
      showLogin();
      toast("Signed out");
    });
    $("adminTheme").addEventListener("click", () => document.body.classList.toggle("light"));
    $("userSearch").addEventListener("input", drawUsers);
    $("saveMaintenance").addEventListener("click", async () => {
      try {
        await requestAdmin("POST", {
          action: "maintenance",
          enabled: $("maintenanceToggle").checked,
          message: $("maintenanceText").value
        });
        toast("Service status saved");
        await loadAdmin();
      } catch (error) { toast(error.message); }
    });
    $("publishAnnouncement").addEventListener("click", async () => {
      const title = $("announcementTitle").value.trim();
      const message = $("announcementMessage").value.trim();
      if (!title || !message) { toast("Enter both announcement title and message"); return; }
      try {
        await requestAdmin("POST", { action: "announcement", title, message });
        $("announcementTitle").value = "";
        $("announcementMessage").value = "";
        toast("Notification published");
        await loadAdmin();
      } catch (error) { toast(error.message); }
    });

    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    if (data?.session) {
      showDashboard();
      await loadAdmin();
    } else {
      showLogin();
      showNotice("Please sign in with the configured administrator account.");
    }
  } catch (error) {
    showLogin();
    showNotice(error.message);
    toast(error.message);
  }
}

initAdmin();
