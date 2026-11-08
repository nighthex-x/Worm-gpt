const SUPABASE_URL="https://mskcclqkvmurlcwwfgyr.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_rxjUd6jKp9-I71GItqOlAA_s1vZEepz";
const supabaseReady=SUPABASE_URL.startsWith("https://")&&!SUPABASE_ANON_KEY.includes("YOUR_");
const sb=supabaseReady?window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;
const $=id=>document.getElementById(id);
let currentUser=null,authMode="signin",busy=false,activeChatId=null,chatTitle="New chat",announcements=[];
let guestCount=Number(localStorage.getItem("nh_guest_count")||0);
let guestChats=[];try{guestChats=JSON.parse(localStorage.getItem("nh_guest_chats")||"[]");if(!Array.isArray(guestChats))guestChats=[]}catch{guestChats=[]}
const GUEST_LIMIT=5;
function toast(message){$("toast").textContent=message;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2600)}
function showModal(id){$(id).classList.add("open")}
function hideModal(id){$(id).classList.remove("open")}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderText(t){return escapeHtml(t).replace(/```([\s\S]*?)```/g,(_,c)=>`<pre><code>${c.trim()}</code></pre>`).replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br>")}
function normalizeBranding(text){return String(text||"").replace(/\bX\s*Rahat\s*AI\b/gi,"NIGHT HEX AI").replace(/\bXrahat\b/gi,"NIGHT HEX").replace(/\bRahat\s*AI\b/gi,"NIGHT HEX AI").replace(/\bRahat\b/gi,"NIGHT HEX").replace(/\b(?:my name is|i am|i'm)\s+Rofiqul(?:\s+Hossain)?\b/gi,"I am NIGHT HEX AI").replace(/আমার নাম\s+রফিকুল(?:\s+হোসেন)?/gi,"আমি NIGHT HEX AI").replace(/রাহাত\s*এআই/gi,"NIGHT HEX AI").replace(/রাহাত/gi,"NIGHT HEX")}
function nearBottom(){const m=$("messages");return m.scrollHeight-m.scrollTop-m.clientHeight<140}
function scrollLatest(force=false){const m=$("messages");if(force||nearBottom())m.scrollTo({top:m.scrollHeight,behavior:"smooth"})}
function updateScrollButton(){const m=$("messages");$("scrollBottom").classList.toggle("hidden",m.scrollHeight-m.scrollTop-m.clientHeight<180)}
function addMessage(role,text,tools=false){
 $("welcome").classList.add("hidden");
 const row=document.createElement("div");row.className=`message ${role}`;
 const avatar=document.createElement("div");avatar.className="avatar";
 if(role==="assistant"){const img=document.createElement("img");img.src="/assets/night-hex-logo.webp";img.alt="";avatar.append(img)}else avatar.textContent="U";
 const bubble=document.createElement("div");bubble.className="bubble";bubble.innerHTML=renderText(text);
 row.append(avatar,bubble);
 if(tools)addCopy(bubble,text);
 $("messages").append(row);scrollLatest();updateScrollButton();return bubble;
}
function addCopy(bubble,text){const tools=document.createElement("div");tools.className="message-tools";const b=document.createElement("button");b.textContent="Copy";b.onclick=()=>navigator.clipboard?.writeText(text).then(()=>toast("Copied"));tools.append(b);bubble.append(tools)}
function setUsage(){$("usageLabel").textContent=currentUser?"Registered account · chat history synced":`Guest access · ${Math.max(0,GUEST_LIMIT-guestCount)} questions left`}
function setAuthUI(){$("topAuth").textContent=currentUser?"Account":"Sign in";setUsage()}
function closeDrawer(){$("sidebar").classList.remove("open");$("drawerScrim").classList.remove("show")}
function openDrawer(){$("sidebar").classList.add("open");$("drawerScrim").classList.add("show")}
function newChat(){activeChatId=null;chatTitle="New chat";$("chatActions").classList.add("hidden");$("messages").innerHTML="";$("welcome").classList.remove("hidden");$("prompt").focus();closeDrawer();updateScrollButton()}
function setMode(mode){authMode=mode;const signup=mode==="signup";$("authTitle").textContent=signup?"Create your account":"Welcome back";$("authSubtitle").textContent=signup?"Create an account to sync your conversations.":"Sign in to continue your conversations.";$("nameLabel").classList.toggle("hidden",!signup);$("displayName").classList.toggle("hidden",!signup);$("displayName").required=signup;$("authSubmit").textContent=signup?"Create account":"Sign in";$("switchText").textContent=signup?"Already registered?":"New here?";$("switchAuth").textContent=signup?"Sign in":"Create account"}
function saveGuestChats(){localStorage.setItem("nh_guest_chats",JSON.stringify(guestChats.slice(0,30)))}
function renderHistory(){
 const box=$("history");box.innerHTML="";
 if(currentUser){return}
 if(!guestChats.length){box.innerHTML='<div class="muted small">Your chats will appear here.</div>';return}
 guestChats.forEach(chat=>{const b=document.createElement("button");b.className="history-item"+(chat.id===activeChatId?" active":"");b.textContent=chat.title||"New chat";b.onclick=()=>openGuestChat(chat.id);box.append(b)})
}
async function refreshAuth(){
 if(!sb){setAuthUI();renderHistory();return}
 const {data,error}=await sb.auth.getSession();if(error){console.error(error);return}
 currentUser=data.session?.user||null;setAuthUI();
 if(currentUser)await loadHistory();else renderHistory();
}
async function loadHistory(){
 if(!sb||!currentUser)return;
 const {data,error}=await sb.from("chats").select("id,title,updated_at").order("updated_at",{ascending:false}).limit(30);
 if(error){console.error("History error",error);return}
 const box=$("history");box.innerHTML="";
 (data||[]).forEach(c=>{const b=document.createElement("button");b.className="history-item"+(c.id===activeChatId?" active":"");b.textContent=c.title||"New chat";b.onclick=()=>openChat(c.id);box.append(b)});
}
async function openChat(id){
 if(!sb||!currentUser)return;
 const {data,error}=await sb.from("messages").select("role,content").eq("chat_id",id).order("created_at");
 if(error){toast("Could not load chat");return}
 activeChatId=id;chatTitle=(await sb.from("chats").select("title").eq("id",id).single()).data?.title||"Conversation";$("chatActions").classList.remove("hidden");$("messages").innerHTML="";$("welcome").classList.add("hidden");
 (data||[]).forEach(m=>addMessage(m.role,m.content,m.role==="assistant"));
 renderHistory();closeDrawer();scrollLatest(true);
}
function openGuestChat(id){
 const chat=guestChats.find(c=>c.id===id);if(!chat)return;
 activeChatId=id;chatTitle=chat.title||"New chat";$("chatActions").classList.remove("hidden");$("messages").innerHTML="";$("welcome").classList.toggle("hidden",chat.messages.length>0);
 chat.messages.forEach(m=>addMessage(m.role,m.content,m.role==="assistant"));renderHistory();closeDrawer();scrollLatest(true);
}
function persistGuestMessage(role,content){
 let chat=guestChats.find(c=>c.id===activeChatId);
 if(!chat){chat={id:crypto.randomUUID(),title:content.slice(0,42),messages:[],updated:Date.now()};activeChatId=chat.id;guestChats.unshift(chat)}
 chat.messages.push({role,content});chat.updated=Date.now();guestChats.sort((a,b)=>b.updated-a.updated);saveGuestChats();renderHistory();
}
async function ensureChat(firstText){
 if(activeChatId||!sb||!currentUser)return activeChatId;
 const {data,error}=await sb.from("chats").insert({user_id:currentUser.id,title:firstText.slice(0,50)}).select("id").single();
 if(error){console.error(error);return null}activeChatId=data.id;return activeChatId;
}
async function saveMessage(chatId,role,content){
 if(!sb||!currentUser||!chatId)return;
 const {error}=await sb.from("messages").insert({chat_id:chatId,user_id:currentUser.id,role,content});
 if(error)console.error("Message save failed",error);
 await sb.from("chats").update({updated_at:new Date().toISOString()}).eq("id",chatId);
}
function scanning(){
 const row=document.createElement("div");row.className="scan";
 row.innerHTML='<span class="loader-orbit" aria-label="Generating response"><i></i><b></b></span>';
 $("messages").append(row);scrollLatest();return row;
}
async function sendMessage(prefill){
 if(busy)return;const text=(prefill??$("prompt").value).trim();if(!text)return;
 if(!currentUser&&guestCount>=GUEST_LIMIT){setMode("signup");showModal("authModal");toast("Guest limit reached. Create an account to continue.");return}
 if(!supabaseReady){toast("Supabase setup is not configured.");return}
 $("prompt").value="";$("prompt").style.height="auto";busy=true;$("sendBtn").disabled=true;
 addMessage("user",text);
 if(!currentUser){guestCount++;localStorage.setItem("nh_guest_count",guestCount);persistGuestMessage("user",text);setUsage()}
 const chatId=await ensureChat(text);if(currentUser&&chatId)await saveMessage(chatId,"user",text);
 const loader=scanning();let assistantBubble=null,answer="";
 try{
  const sessionResult=currentUser?await sb.auth.getSession():{data:{session:null}};
  const authHeaders={"Content-Type":"application/json","Accept":"text/event-stream"};
  if(sessionResult.data.session?.access_token)authHeaders.Authorization="Bearer "+sessionResult.data.session.access_token;
  const response=await fetch("/api/chat",{method:"POST",headers:authHeaders,body:JSON.stringify({text,uid:currentUser?currentUser.id:(localStorage.getItem("nh_guest_uid")||makeGuestUid())})});
  if(!response.ok)throw new Error((await response.text()).slice(0,250)||`Request failed (${response.status})`);
  const type=response.headers.get("content-type")||"";
  if(type.includes("text/event-stream")&&response.body){
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="",done=false;
   assistantBubble=addMessage("assistant","");loader.remove();
   while(!done){const part=await reader.read();done=part.done;buffer+=decoder.decode(part.value||new Uint8Array(),{stream:!done});const lines=buffer.split(/\r?\n/);buffer=lines.pop()||"";
    for(const line of lines){if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(!raw)continue;if(raw==="[DONE]"){done=true;break}
     try{const ev=JSON.parse(raw);if(ev.delta){answer+=ev.delta;assistantBubble.innerHTML=renderText(answer);scrollLatest();updateScrollButton()}if(ev.error)throw new Error(ev.error)}catch(e){if(e instanceof SyntaxError)continue;throw e}
    }
   }
  }else{const data=await response.json();if(data.error)throw new Error(data.error);answer=data.reply||"";if(!answer)throw new Error("AI response was empty.");loader.remove();assistantBubble=addMessage("assistant",answer)}
  if(!answer.trim())throw new Error("The AI returned an empty response.");
  answer=normalizeBranding(answer);
  if(assistantBubble)assistantBubble.innerHTML=renderText(answer);
  addCopy(assistantBubble,answer);
  if(currentUser&&chatId){await saveMessage(chatId,"assistant",answer);$("chatActions").classList.remove("hidden");await loadHistory()}else if(!currentUser){persistGuestMessage("assistant",answer)}
 }catch(err){loader.remove();addMessage("assistant",`Sorry, I couldn't get a response. ${err.message||"Please try again."}`);console.error(err)}
 finally{busy=false;$("sendBtn").disabled=false;$("prompt").focus()}
}
function makeGuestUid(){const id="guest_"+crypto.randomUUID();localStorage.setItem("nh_guest_uid",id);return id}
$("sendBtn").onclick=()=>sendMessage();
$("prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage()}});
$("prompt").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,180)+"px"});
$("newChat").onclick=newChat;
// Conversation tools: rename, delete, export and share.
function getVisibleConversation(){return [...$("messages").querySelectorAll(".message")].map(el=>({role:el.classList.contains("user")?"user":"assistant",content:el.querySelector(".bubble")?.innerText.replace(/\nCopy$/,"" )||""})).filter(m=>m.content.trim())}
async function conversationMessages(){if(currentUser&&activeChatId){const {data,error}=await sb.from("messages").select("role,content,created_at").eq("chat_id",activeChatId).order("created_at");if(error)throw error;return data||[]}const c=guestChats.find(x=>x.id===activeChatId);return c?.messages||getVisibleConversation()}
function exportConversation(rows){const title=chatTitle||"NIGHT HEX AI Conversation";const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:14px Arial,sans-serif;max-width:800px;margin:35px auto;color:#172033}h1{border-bottom:1px solid #ddd;padding-bottom:12px}.m{padding:12px 15px;margin:12px 0;border-radius:10px;background:#f2f5f9;white-space:pre-wrap;line-height:1.6}.assistant{background:#eef8fa}.who{font-weight:bold;color:#187b89;margin-bottom:6px}@media print{body{margin:12mm}}</style></head><body><h1>${escapeHtml(title)}</h1><p>NIGHT HEX AI · Conversation export</p>${rows.map(m=>`<section class="m ${m.role}"><div class="who">${m.role==='assistant'?'NIGHT HEX AI':'You'}</div>${escapeHtml(m.content).replace(/\n/g,'<br>')}</section>`).join('')}<script>window.onload=()=>window.print()<\/script></body></html>`;const w=window.open('','_blank');if(!w){toast('Allow pop-ups to save as PDF');return}w.document.write(html);w.document.close()}
$("exportChatBtn").onclick=()=>{const rows=getVisibleConversation();if(!rows.length)return toast('No messages to export');exportConversation(rows)};
$("renameChatBtn").onclick=async()=>{if(!activeChatId)return toast('Open a saved conversation first');const name=prompt('Conversation name',chatTitle);if(!name?.trim())return;chatTitle=name.trim().slice(0,80);if(currentUser){const {error}=await sb.from('chats').update({title:chatTitle}).eq('id',activeChatId);if(error)return toast('Could not rename chat');await loadHistory()}else{const c=guestChats.find(x=>x.id===activeChatId);if(c){c.title=chatTitle;saveGuestChats();renderHistory()}}toast('Conversation renamed')};
$("deleteChatBtn").onclick=async()=>{if(!activeChatId||!confirm('Delete this conversation permanently?'))return;try{if(currentUser){const {error}=await sb.from('chats').delete().eq('id',activeChatId);if(error)throw error;await loadHistory()}else{guestChats=guestChats.filter(c=>c.id!==activeChatId);saveGuestChats();renderHistory()}newChat();toast('Conversation deleted')}catch(e){toast('Could not delete conversation')}};
$("shareChatBtn").onclick=async()=>{if(!currentUser||!activeChatId)return toast('Sign in and open a saved conversation to share');try{const {data:{session}}=await sb.auth.getSession();const r=await fetch('/api/share',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({chatId:activeChatId})});const d=await r.json();if(!r.ok)throw Error(d.error||'Share failed');const url=d.url||location.origin+'/share/'+d.token;await navigator.clipboard.writeText(url);toast('Share link copied')}catch(e){toast(e.message||'Could not create share link')}};
$("messages").addEventListener('scroll',updateScrollButton);$("scrollBottom").onclick=()=>{scrollLatest(true);$("scrollBottom").classList.add('hidden')};
async function refreshPublicStatus(){try{const {data:{session}}=sb?await sb.auth.getSession():{data:{session:null}};const r=await fetch('/api/status',{cache:'no-store',headers:session?.access_token?{Authorization:'Bearer '+session.access_token}:{}});const d=await r.json();announcements=d.announcements||[];const bar=$('announcementBar');bar.replaceChildren();if(announcements.length){bar.classList.remove('hidden');announcements.forEach(a=>{const p=document.createElement('div');p.className='announcement-pill';p.textContent='● '+a.title+': '+a.message;bar.append(p)});$('notificationDot').classList.remove('hidden')}else bar.classList.add('hidden');if(d.maintenance){$('maintenanceMessage').textContent=d.message||'NIGHT HEX AI is temporarily under maintenance.';$('maintenanceModal').classList.add('open');$('sendBtn').disabled=true;$('prompt').disabled=true}else{$('maintenanceModal').classList.remove('open');$('sendBtn').disabled=busy;$('prompt').disabled=false}}catch(e){console.warn('Status check failed',e)}}
setInterval(refreshPublicStatus,45000);
$('notificationBtn').onclick=()=>{const box=$('notificationList');box.replaceChildren();if(!announcements.length){box.textContent='No new notifications.'}else announcements.forEach(a=>{const el=document.createElement('article');el.className='notification-item';const h=document.createElement('strong');h.textContent=a.title;const p=document.createElement('p');p.textContent=a.message;el.append(h,p);box.append(el)});$('notificationDot').classList.add('hidden');showModal('notificationsModal')};
$("themeToggle").onclick=()=>{document.body.classList.toggle("light");localStorage.setItem("nh_theme",document.body.classList.contains("light")?"light":"dark")};
$("menuBtn").onclick=openDrawer;$("closeMenu").onclick=closeDrawer;$("drawerScrim").onclick=closeDrawer;
$("topAuth").onclick=()=>currentUser?(showModal("accountModal"),renderAccount()):(setMode("signin"),showModal("authModal"));
$("accountBtn").onclick=()=>{closeDrawer();currentUser?(showModal("accountModal"),renderAccount()):(setMode("signin"),showModal("authModal"))};
$("switchAuth").onclick=()=>setMode(authMode==="signin"?"signup":"signin");
$("authForm").onsubmit=async e=>{
 e.preventDefault();if(!sb){toast("Account service is temporarily unavailable.");return}
 const email=$("email").value.trim(),password=$("password").value,name=$("displayName").value.trim();
 const button=$("authSubmit"),original=authMode==="signup"?"Create account":"Sign in";
 button.disabled=true;button.innerHTML='<span class="button-spinner"></span> Please wait…';
 try{
  if(authMode==="signup"){
   const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name:name}}});
   if(error)throw error;
   if(!data.session){toast("Account created. Email confirmation is still required; check your email.");return}
   currentUser=data.user||data.session.user;toast("Account created successfully.");
  }else{
   const {data,error}=await sb.auth.signInWithPassword({email,password});
   if(error)throw error;
   currentUser=data.user;toast("Welcome back.");
  }
  hideModal("authModal");$("authForm").reset();await refreshAuth();newChat();
 }catch(err){
  const msg=String(err.message||"");
  if(/rate limit|email rate/i.test(msg))toast("Email sending limit reached. Wait a while, then try again.");
  else if(/already registered|already been registered/i.test(msg))toast("This email is already registered. Choose Sign in.");
  else toast(msg||"Authentication failed.");
 }finally{button.disabled=false;button.textContent=original}
};
async function renderAccount(){if(!sb)return;const {data}=await sb.auth.getUser();$("accountInfo").textContent=`Email: ${data.user?.email||"—"}\nUser ID: ${data.user?.id||"—"}`}
$("signOutBtn").onclick=async()=>{await sb.auth.signOut();currentUser=null;activeChatId=null;newChat();hideModal("accountModal");setAuthUI();renderHistory();toast("Signed out")};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>hideModal(b.dataset.close));
document.querySelectorAll(".modal-backdrop").forEach(back=>back.addEventListener("click",e=>{if(e.target===back)back.classList.remove("open")}));
document.querySelectorAll(".suggestion").forEach(b=>b.onclick=()=>{$("prompt").value=b.dataset.prompt;$("prompt").focus()});
if(localStorage.getItem("nh_theme")==="light")document.body.classList.add("light");
(async()=>{setMode("signin");setUsage();if(supabaseReady)await refreshAuth();else renderHistory();await refreshPublicStatus()})();

document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeDrawer();document.querySelectorAll(".modal-backdrop.open").forEach(m=>m.classList.remove("open"))}});
