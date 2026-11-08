const SUPABASE_URL="https://mskcclqkvmurlcwwfgyr.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_rxjUd6jKp9-I71GItqOlAA_s1vZEepz";
const supabaseReady=SUPABASE_URL.startsWith("https://")&&!SUPABASE_ANON_KEY.includes("YOUR_");
const sb=supabaseReady?window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;
const $=id=>document.getElementById(id);
let currentUser=null,authMode="signin",busy=false,activeChatId=null;
let guestCount=Number(localStorage.getItem("nh_guest_count")||0);
let guestChats=[];try{guestChats=JSON.parse(localStorage.getItem("nh_guest_chats")||"[]");if(!Array.isArray(guestChats))guestChats=[]}catch{guestChats=[]}
const GUEST_LIMIT=5;
function toast(message){$("toast").textContent=message;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2600)}
function showModal(id){$(id).classList.add("open")}
function hideModal(id){$(id).classList.remove("open")}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderText(t){return escapeHtml(t).replace(/```([\s\S]*?)```/g,(_,c)=>`<pre><code>${c.trim()}</code></pre>`).replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br>")}
function addMessage(role,text,tools=false){
 $("welcome").classList.add("hidden");
 const row=document.createElement("div");row.className=`message ${role}`;
 const avatar=document.createElement("div");avatar.className="avatar";
 if(role==="assistant"){const img=document.createElement("img");img.src="/assets/night-hex-logo.webp";img.alt="";avatar.append(img)}else avatar.textContent="U";
 const bubble=document.createElement("div");bubble.className="bubble";bubble.innerHTML=renderText(text);
 row.append(avatar,bubble);
 if(tools)addCopy(bubble,text);
 $("messages").append(row);$("messages").scrollTop=$("messages").scrollHeight;return bubble;
}
function addCopy(bubble,text){const tools=document.createElement("div");tools.className="message-tools";const b=document.createElement("button");b.textContent="Copy";b.onclick=()=>navigator.clipboard?.writeText(text).then(()=>toast("Copied"));tools.append(b);bubble.append(tools)}
function setUsage(){$("usageLabel").textContent=currentUser?"Registered account · chat history synced":`Guest access · ${Math.max(0,GUEST_LIMIT-guestCount)} questions left`}
function setAuthUI(){$("topAuth").textContent=currentUser?"Account":"Sign in";setUsage()}
function closeDrawer(){$("sidebar").classList.remove("open");$("drawerScrim").classList.remove("show")}
function openDrawer(){$("sidebar").classList.add("open");$("drawerScrim").classList.add("show")}
function newChat(){activeChatId=null;$("messages").innerHTML="";$("welcome").classList.remove("hidden");$("prompt").focus();closeDrawer()}
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
 activeChatId=id;$("messages").innerHTML="";$("welcome").classList.add("hidden");
 (data||[]).forEach(m=>addMessage(m.role,m.content,m.role==="assistant"));
 renderHistory();closeDrawer();
}
function openGuestChat(id){
 const chat=guestChats.find(c=>c.id===id);if(!chat)return;
 activeChatId=id;$("messages").innerHTML="";$("welcome").classList.toggle("hidden",chat.messages.length>0);
 chat.messages.forEach(m=>addMessage(m.role,m.content,m.role==="assistant"));renderHistory();closeDrawer();
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
 row.innerHTML='<span class="loader-orbit"><i></i><b></b></span><span class="loading-label">Thinking</span>';
 $("messages").append(row);$("messages").scrollTop=$("messages").scrollHeight;return row;
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
     try{const ev=JSON.parse(raw);if(ev.delta){answer+=ev.delta;assistantBubble.innerHTML=renderText(answer);$("messages").scrollTop=$("messages").scrollHeight}if(ev.error)throw new Error(ev.error)}catch(e){if(e instanceof SyntaxError)continue;throw e}
    }
   }
  }else{const data=await response.json();if(data.error)throw new Error(data.error);answer=data.reply||"";if(!answer)throw new Error("AI response was empty.");loader.remove();assistantBubble=addMessage("assistant",answer)}
  if(!answer.trim())throw new Error("The AI returned an empty response.");
  addCopy(assistantBubble,answer);
  if(currentUser&&chatId){await saveMessage(chatId,"assistant",answer);await loadHistory()}else if(!currentUser){persistGuestMessage("assistant",answer)}
 }catch(err){loader.remove();addMessage("assistant",`Sorry, I couldn't get a response. ${err.message||"Please try again."}`);console.error(err)}
 finally{busy=false;$("sendBtn").disabled=false;$("prompt").focus()}
}
function makeGuestUid(){const id="guest_"+crypto.randomUUID();localStorage.setItem("nh_guest_uid",id);return id}
$("sendBtn").onclick=()=>sendMessage();
$("prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage()}});
$("prompt").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,180)+"px"});
$("newChat").onclick=newChat;
$("themeToggle").onclick=()=>{document.body.classList.toggle("light");localStorage.setItem("nh_theme",document.body.classList.contains("light")?"light":"dark")};
$("menuBtn").onclick=openDrawer;$("closeMenu").onclick=closeDrawer;$("drawerScrim").onclick=closeDrawer;
$("topAuth").onclick=()=>currentUser?(showModal("accountModal"),renderAccount()):(setMode("signin"),showModal("authModal"));
$("accountBtn").onclick=()=>{closeDrawer();currentUser?(showModal("accountModal"),renderAccount()):(setMode("signin"),showModal("authModal"))};
$("switchAuth").onclick=()=>setMode(authMode==="signin"?"signup":"signin");
$("authForm").onsubmit=async e=>{
 e.preventDefault();if(!sb){toast("Supabase setup is incomplete.");return}
 const email=$("email").value.trim(),password=$("password").value,name=$("displayName").value.trim();$("authSubmit").disabled=true;
 try{
  if(authMode==="signup"){
   const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name:name}}});
   if(error)throw error;
   if(!data.session){toast("Account created, but email confirmation is enabled. Turn off Confirm email in Supabase Auth settings for automatic sign-in.");return}
   toast("Account created and signed in successfully.");
  }else{
   const {error}=await sb.auth.signInWithPassword({email,password});
   if(error)throw error;
   toast("Signed in successfully");
  }
  hideModal("authModal");await refreshAuth();
 }catch(err){toast(err.message||"Authentication failed")}finally{$("authSubmit").disabled=false}
};
async function renderAccount(){if(!sb)return;const {data}=await sb.auth.getUser();$("accountInfo").textContent=`Email: ${data.user?.email||"—"}\nUser ID: ${data.user?.id||"—"}`}
$("signOutBtn").onclick=async()=>{await sb.auth.signOut();currentUser=null;activeChatId=null;newChat();hideModal("accountModal");setAuthUI();renderHistory();toast("Signed out")};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>hideModal(b.dataset.close));
document.querySelectorAll(".modal-backdrop").forEach(back=>back.addEventListener("click",e=>{if(e.target===back)back.classList.remove("open")}));
document.querySelectorAll(".suggestion").forEach(b=>b.onclick=()=>{$("prompt").value=b.dataset.prompt;$("prompt").focus()});
if(localStorage.getItem("nh_theme")==="light")document.body.classList.add("light");
(async()=>{setMode("signin");setUsage();if(supabaseReady)await refreshAuth();else renderHistory()})();
