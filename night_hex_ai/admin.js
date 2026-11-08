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
function showNotice(message) { if ($("notice")) $("notice").textContent = message; }
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
    method, cache: "no-store",
    headers: { Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { const err = new Error(result.error || `Admin server returned HTTP ${response.status}`); err.status = response.status; throw err; }
  return result;
}
function stat(label, value, hint) {
  const card = document.createElement("article"); card.className = "stat-card";
  const title = document.createElement("div"); title.className = "muted"; title.textContent = label;
  const number = document.createElement("strong"); number.textContent = String(value ?? 0);
  const note = document.createElement("small"); note.textContent = hint || "Live overview";
  card.append(title, number, note); return card;
}
function drawUsers() {
  const search = ($("userSearch")?.value || "").trim().toLowerCase();
  const status = $("userStatusFilter")?.value || "all";
  const body = $("users"); if (!body) return;
  body.replaceChildren();
  const filtered = allUsers.filter(user => {
    const blocked = !!(user.banned_until && new Date(user.banned_until) > new Date());
    const matchesSearch = `${user.name || ""} ${user.email || ""}`.toLowerCase().includes(search);
    return matchesSearch && (status === "all" || (status === "blocked" ? blocked : !blocked));
  });
  $("userCount").textContent = `${filtered.length} shown · ${allUsers.length} total accounts`;
  if (!filtered.length) { const tr=document.createElement("tr"); const td=document.createElement("td"); td.colSpan=6; td.className="empty-users"; td.textContent="No matching accounts found."; tr.append(td); body.append(tr); return; }
  filtered.forEach(user => {
    const tr = document.createElement("tr");
    const blocked = !!(user.banned_until && new Date(user.banned_until) > new Date());
    const cell = (label, value) => { const td=document.createElement("td"); td.dataset.label=label; td.textContent=value; return td; };
    tr.append(cell("Name", user.name || "—"), cell("Email", user.email || "—"), cell("Joined", user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"), cell("Last active", user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : "Never"), cell("Status", blocked ? "Blocked" : "Active"));
    const actions=cell("Actions", ""); actions.classList.add("user-actions");
    const reset=document.createElement("button"); reset.className="admin-action"; reset.textContent="Reset email";
    reset.onclick=async()=>{ if(!confirm(`Send a password reset email to ${user.email}?`))return; try{await requestAdmin("POST",{action:"reset_password",userId:user.id});toast("Password reset email sent");}catch(e){toast(e.message);} };
    actions.append(reset);
    if(blocked){const unblock=document.createElement("button");unblock.className="admin-action";unblock.textContent="Unblock";unblock.onclick=()=>accountAction(user,"unban");actions.append(unblock);}
    else {const select=document.createElement("select");select.className="admin-duration";[["1h","1 hour"],["24h","1 day"],["7d","7 days"],["30d","30 days"],["876000h","Long term"]].forEach(([v,l])=>{const o=document.createElement("option");o.value=v;o.textContent=l;select.append(o);});const block=document.createElement("button");block.className="admin-action danger-btn";block.textContent="Block";block.onclick=()=>accountAction(user,"ban",select.value);actions.append(select,block);}
    tr.append(actions); body.append(tr);
  });
}
async function accountAction(user, action, duration) {
  const verb=action==="ban"?"Block":"Unblock"; if(!confirm(`${verb} ${user.email || "this account"}?`))return;
  try{await requestAdmin("POST",{action,userId:user.id,duration});toast("Account updated");await loadAdmin();}catch(e){toast(e.message);}
}
async function checkServer() {
  try { const r=await fetch("/health",{cache:"no-store"}); if(!r.ok)throw new Error(); $("serverHealth").textContent="Online"; $("systemHealth").textContent="All systems reachable"; $("systemHealth").className="health-pill good"; }
  catch { $("serverHealth").textContent="Unavailable"; $("systemHealth").textContent="Server check failed"; $("systemHealth").className="health-pill bad"; }
  $("lastChecked").textContent=new Date().toLocaleTimeString();
}
function drawAnnouncements(items) {
  const target=$("announcementRows"); target.replaceChildren();
  if(!items.length){const p=document.createElement("p");p.className="muted small";p.textContent="No announcements published yet.";target.append(p);return;}
  items.forEach(item=>{const row=document.createElement("div");row.className="announcement-row";const label=document.createElement("span");label.textContent=`${item.title} · ${new Date(item.created_at).toLocaleDateString()}`;const remove=document.createElement("button");remove.className="admin-action danger-btn";remove.textContent="Delete";remove.onclick=async()=>{if(!confirm("Delete this announcement?"))return;try{await requestAdmin("POST",{action:"delete_announcement",id:item.id});toast("Announcement deleted");await loadAdmin();}catch(e){toast(e.message);}};row.append(label,remove);target.append(row);});
}
function drawCategories(categories) {
  const target=$("categoryStats");target.replaceChildren();const entries=Object.entries(categories||{}).sort((a,b)=>Number(b[1])-Number(a[1]));
  if(!entries.length){const p=document.createElement("p");p.className="muted small";p.textContent="No usage events recorded yet.";target.append(p);return;}
  const total=entries.reduce((sum,[,count])=>sum+Number(count||0),0)||1;
  entries.forEach(([name,count])=>{const row=document.createElement("div");row.className="category-row";const label=document.createElement("span");label.textContent=name;const pct=Math.round(Number(count||0)/total*100);const value=document.createElement("strong");value.textContent=pct+"%";const track=document.createElement("div");track.className="category-track";const fill=document.createElement("i");fill.style.width=pct+"%";track.append(fill);row.append(label,value,track);target.append(row);});
}
async function loadAdmin() {
  if(loading)return;loading=true;showNotice("Refreshing administrator data…");
  const refresh=$("refreshAdmin");if(refresh){refresh.disabled=true;refresh.textContent="Refreshing…";}
  try {
    const result=await requestAdmin();showDashboard();showNotice("Administrator verified · "+(result.admin?.email||"Access confirmed"));
    $("verifiedAdmin").textContent=result.admin?.email||"Verified";
    $("stats").replaceChildren(stat("Users",result.totals?.users,"Registered accounts"),stat("Chats",result.totals?.chats,"Saved conversations"),stat("Messages",result.totals?.messages,"Stored messages"),stat("Active today",result.totals?.activeToday,"Unique active users"));
    allUsers=result.users||[];drawUsers();
    $("maintenanceToggle").checked=!!result.maintenance?.maintenance_enabled;$("maintenanceText").value=result.maintenance?.maintenance_message||"";
    drawAnnouncements(result.announcements||[]);drawCategories(result.analytics?.categories||{});await checkServer();
  } catch(error) {
    if(error.status===401||error.status===403){await sb.auth.signOut();showLogin();showNotice(error.message);}
    else { const {data}=await sb.auth.getSession(); if(data?.session)showDashboard();else showLogin();showNotice("Could not load admin data: "+error.message); }
    toast(error.message);
  } finally {loading=false;if(refresh){refresh.disabled=false;refresh.textContent="↻ Refresh";}}
}
async function handleLogin(event) {
  event.preventDefault();event.stopPropagation();setLoginBusy(true);
  try {const email=$("adminEmail").value.trim().toLowerCase();const password=$("adminPassword").value;const {data,error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;if(!data?.session)throw new Error("Supabase did not create a login session. Check email confirmation and account status.");showDashboard();await loadAdmin();}
  catch(error){toast(error.message||"Login failed");showNotice(error.message||"Login failed");}
  finally{setLoginBusy(false);$("adminPassword").value="";}
}
async function initAdmin(){
  try {
    if(!window.supabase?.createClient)throw new Error("Supabase authentication library did not load. Check internet and reload.");
    sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    $("adminLogin").addEventListener("submit",handleLogin);
    $("adminSignOut").addEventListener("click",async()=>{await sb.auth.signOut();showLogin();showNotice("Signed out successfully.");toast("Signed out");});
    $("adminTheme").addEventListener("click",()=>document.body.classList.toggle("light"));
    $("userSearch").addEventListener("input",drawUsers);$("userStatusFilter").addEventListener("change",drawUsers);
    $("refreshAdmin").addEventListener("click",loadAdmin);
    $("saveMaintenance").addEventListener("click",async()=>{try{await requestAdmin("POST",{action:"maintenance",enabled:$("maintenanceToggle").checked,message:$("maintenanceText").value});toast("Maintenance settings saved");await loadAdmin();}catch(e){toast(e.message);}});
    $("publishAnnouncement").addEventListener("click",async()=>{const title=$("announcementTitle").value.trim(),message=$("announcementMessage").value.trim();if(!title||!message){toast("Enter both title and message");return;}try{await requestAdmin("POST",{action:"announcement",title,message});$("announcementTitle").value="";$("announcementMessage").value="";toast("Announcement published");await loadAdmin();}catch(e){toast(e.message);}});
    const {data,error}=await sb.auth.getSession();if(error)throw error;
    if(data?.session){showDashboard();await loadAdmin();}else{showLogin();showNotice("Sign in with the configured administrator account.");}
  }catch(error){showLogin();showNotice(error.message);toast(error.message);}
}
initAdmin();
