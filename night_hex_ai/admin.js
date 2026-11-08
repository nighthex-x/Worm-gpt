const SUPABASE_URL="https://mskcclqkvmurlcwwfgyr.supabase.co";
const SUPABASE_KEY="sb_publishable_rxjUd6jKp9-I71GItqOlAA_s1vZEepz";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
function notice(msg){$("notice").textContent=msg}
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2600)}
function showDashboard(){$("loginPanel").classList.add("hidden");$("dashboard").classList.remove("hidden")}
function showLogin(){$("dashboard").classList.add("hidden");$("loginPanel").classList.remove("hidden")}
async function requestAdmin(method="GET",payload){
 const {data:{session}}=await sb.auth.getSession();
 if(!session)throw new Error("Please sign in again.");
 const response=await fetch("/api/admin",{method,headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},...(payload?{body:JSON.stringify(payload)}:{})});
 const data=await response.json();if(!response.ok)throw new Error(data.error||"Admin request failed");return data;
}
async function changeBlock(user,action,duration){
 const label=action==="unban"?"unblock this account":"block this account";
 if(!confirm(`Are you sure you want to ${label}?`))return;
 try{await requestAdmin("POST",{action,userId:user.id,duration});toast(action==="unban"?"Account unblocked":"Account block updated");await loadAdmin()}
 catch(error){toast(error.message)}
}
async function loadAdmin(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){showLogin();return}
 showDashboard();notice("Verifying administrator access…");
 try{
  const d=await requestAdmin();notice("Administrator access verified.");
  $("stats").innerHTML="";
  [["Users",d.totals.users],["Chats",d.totals.chats],["Messages",d.totals.messages]].forEach(([label,value])=>{const card=document.createElement("article");card.className="stat-card";const l=document.createElement("div");l.className="muted";l.textContent=label;const v=document.createElement("strong");v.textContent=String(value??0);card.append(l,v);$("stats").append(card)});
  $("users").innerHTML="";
  (d.users||[]).forEach(user=>{
   const tr=document.createElement("tr");
   const values=[user.email||"—",user.created_at?new Date(user.created_at).toLocaleString():"—",user.last_sign_in_at?new Date(user.last_sign_in_at).toLocaleString():"Never",user.email_confirmed_at?"Yes":"No"];
   values.forEach(value=>{const td=document.createElement("td");td.textContent=value;tr.append(td)});
   const control=document.createElement("td");
   const isBlocked=user.banned_until&&new Date(user.banned_until)>new Date();
   if(isBlocked){const status=document.createElement("div");status.textContent="Blocked until "+new Date(user.banned_until).toLocaleString();status.className="muted small";const unblock=document.createElement("button");unblock.className="secondary-btn";unblock.textContent="Unblock";unblock.onclick=()=>changeBlock(user,"unban");control.append(status,unblock)}
   else{const select=document.createElement("select");select.className="admin-duration";[["1h","1 hour"],["24h","1 day"],["7d","7 days"],["30d","30 days"],["876000h","Indefinite (100 years)"]].forEach(([value,label])=>{const option=document.createElement("option");option.value=value;option.textContent=label;select.append(option)});const block=document.createElement("button");block.className="secondary-btn danger-btn";block.textContent="Block";block.onclick=()=>changeBlock(user,"ban",select.value);control.append(select,block)}
   tr.append(control);$("users").append(tr);
  });
 }catch(error){notice(error.message);if(/access denied|invalid session/i.test(error.message)){await sb.auth.signOut();showLogin()}}
}
$("adminLogin").onsubmit=async e=>{e.preventDefault();$("adminSubmit").disabled=true;try{const {error}=await sb.auth.signInWithPassword({email:$("adminEmail").value.trim(),password:$("adminPassword").value});if(error)throw error;await loadAdmin()}catch(error){toast(error.message||"Sign-in failed")}finally{$("adminSubmit").disabled=false;$("adminPassword").value=""}};
$("adminSignOut").onclick=async()=>{await sb.auth.signOut();showLogin();toast("Signed out")};
loadAdmin();
