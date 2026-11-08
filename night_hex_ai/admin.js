const URL="YOUR_SUPABASE_PROJECT_URL",KEY="YOUR_SUPABASE_ANON_KEY";
const out=document.getElementById("notice"),stats=document.getElementById("stats"),rows=document.getElementById("users");
(async()=>{
 if(!URL.startsWith("https://")||KEY.includes("YOUR_")){out.textContent="Configure Supabase URL and anon key in admin.js.";return}
 const sb=window.supabase.createClient(URL,KEY);
 const {data:{session}}=await sb.auth.getSession();
 if(!session){out.textContent="Please sign in on the main website first, then open /admin.html.";return}
 const r=await fetch("/api/admin",{headers:{Authorization:"Bearer "+session.access_token}});
 const d=await r.json();
 if(!r.ok){out.textContent=d.error||"Admin access denied.";return}
 out.textContent="Admin access granted.";
 [["Users",d.totals.users],["Chats",d.totals.chats],["Messages",d.totals.messages]].forEach(([label,value])=>{
 const card=document.createElement("div");card.style.cssText="background:#101a2a;border:1px solid #263951;border-radius:12px;padding:18px";
 card.innerHTML=`<div style="color:#8a9bb2;font-size:11px">${label}</div><div style="font-size:27px;font-weight:800;margin-top:8px">${value}</div>`;stats.appendChild(card)});
 (d.users||[]).forEach(u=>{const tr=document.createElement("tr");[u.email||"—",u.created_at?new Date(u.created_at).toLocaleString():"—",u.last_sign_in_at?new Date(u.last_sign_in_at).toLocaleString():"Never",u.email_confirmed_at?"Yes":"No"].forEach(v=>{const td=document.createElement("td");td.style.cssText="padding:10px;border-top:1px solid #23334a;color:#c9d7e8";td.textContent=v;tr.appendChild(td)});rows.appendChild(tr)});
})().catch(e=>out.textContent="Could not load dashboard: "+e.message);