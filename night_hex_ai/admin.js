const SUPABASE_URL = "https://mskcclqkvmurlcwwfgyr.supabase.co";
const SUPABASE_KEY = "sb_publishable_rxjUd6jKp9-I71GItqOlAA_s1vZEepz";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);

function notice(message) { $("notice").textContent = message; }
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2600);
}
function showDashboard() {
  $("loginPanel").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
}
function showLogin() {
  $("dashboard").classList.add("hidden");
  $("loginPanel").classList.remove("hidden");
}

async function requestAdmin(method = "GET", payload) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in first.");
  const response = await fetch("/api/admin", {
    method,
    cache: "no-store",
    headers: {
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json"
    },
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Admin request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function changeBlock(user, action, duration) {
  const label = action === "unban" ? "unblock this account" : "block this account";
  if (!confirm(`Are you sure you want to ${label}?`)) return;
  try {
    await requestAdmin("POST", { action, userId: user.id, duration });
    toast(action === "unban" ? "Account unblocked" : "Account block updated");
    await loadAdmin();
  } catch (error) { toast(error.message); }
}

async function loadAdmin() {
  // Never reveal the dashboard shell/data area before the server verifies the account.
  showLogin();
  notice("Verifying administrator access…");
  try {
    const data = await requestAdmin();
    showDashboard();
    notice(`Administrator access verified${data.admin?.email ? " · " + data.admin.email : ""}.`);

    $("stats").replaceChildren();
    [["Users", data.totals.users], ["Chats", data.totals.chats], ["Messages", data.totals.messages]].forEach(([label, value]) => {
      const card = document.createElement("article");
      card.className = "stat-card";
      const title = document.createElement("div");
      title.className = "muted";
      title.textContent = label;
      const number = document.createElement("strong");
      number.textContent = String(value ?? 0);
      card.append(title, number);
      $("stats").append(card);
    });

    $("users").replaceChildren();
    (data.users || []).forEach(user => {
      const row = document.createElement("tr");
      const values = [
        user.email || "—",
        user.created_at ? new Date(user.created_at).toLocaleString() : "—",
        user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Never",
        user.email_confirmed_at ? "Yes" : "No"
      ];
      values.forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      });

      const controls = document.createElement("td");
      const blocked = user.banned_until && new Date(user.banned_until) > new Date();
      if (blocked) {
        const status = document.createElement("div");
        status.textContent = "Blocked until " + new Date(user.banned_until).toLocaleString();
        status.className = "muted small";
        const unblock = document.createElement("button");
        unblock.className = "secondary-btn";
        unblock.textContent = "Unblock";
        unblock.onclick = () => changeBlock(user, "unban");
        controls.append(status, unblock);
      } else {
        const select = document.createElement("select");
        select.className = "admin-duration";
        [["1h", "1 hour"], ["24h", "1 day"], ["7d", "7 days"], ["30d", "30 days"], ["876000h", "Long-term (100 years)"]].forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          select.append(option);
        });
        const block = document.createElement("button");
        block.className = "secondary-btn danger-btn";
        block.textContent = "Block";
        block.onclick = () => changeBlock(user, "ban", select.value);
        controls.append(select, block);
      }
      row.append(controls);
      $("users").append(row);
    });
  } catch (error) {
    showLogin();
    notice(error.status === 403 ? "This account is not the configured administrator." : error.message);
  }
}

$("adminLogin").onsubmit = async event => {
  event.preventDefault();
  $("adminSubmit").disabled = true;
  $("adminSubmit").textContent = "Verifying…";
  try {
    const { error } = await sb.auth.signInWithPassword({
      email: $("adminEmail").value.trim(),
      password: $("adminPassword").value
    });
    if (error) throw error;
    await loadAdmin();
  } catch (error) {
    toast(error.message || "Sign-in failed");
  } finally {
    $("adminSubmit").disabled = false;
    $("adminSubmit").textContent = "Sign in to Admin";
    $("adminPassword").value = "";
  }
};

$("adminSignOut").onclick = async () => {
  await sb.auth.signOut();
  showLogin();
  toast("Signed out");
};

loadAdmin();
