/* Set these public Supabase values in this file before deployment. */
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const supabaseReady = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR_") && !SUPABASE_ANON_KEY.includes("YOUR_");
const sb = supabaseReady ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = id => document.getElementById(id);
let currentUser = null, authMode = "signin", busy = false, activeChatId = null, guestCount = Number(localStorage.getItem("nh_guest_count") || 0);
const GUEST_LIMIT = 5;

function toast(message){const t=$("toast");t.textContent=message;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800)}
function showModal(id){$(id).classList.add("open")}
function hideModal(id){$(id).classList.remove("open")}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderText(text){
  let safe=escapeHtml(text);
  safe=safe.replace(/```([\s\S]*?)```/g,(_,code)=>`<pre><code>${code.trim()}</code></pre>`);
  safe=safe.replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br>");
  return safe;
}
function addMessage(role,text,tools=false){
  $("welcome").classList.add("hidden");
  const row=document.createElement("div");row.className=`message ${role}`;
  row.innerHTML=`<div class="avatar">${role==="user"?"U":"N"}</div><div class="bubble">${renderText(text)}${tools?'<div class="message-tools"><button class="copy-answer">Copy response</button></div>':""}</div>`;
  if(tools) row.querySelector(".copy-answer").onclick=()=>{navigator.clipboard.writeText(text).then(()=>toast("Copied to clipboard"))};
  $("messages").appendChild(row);$("messages").scrollTop=$("messages").scrollHeight;return row.querySelector(".bubble");
}
function setUsage(){ $("usageLabel").textContent=currentUser?"Registered account · no app-level question limit":`Guest access · ${Math.max(0,GUEST_LIMIT-guestCount)} questions left`; }
function setAuthUI(){ $("topAuth").textContent=currentUser?"Account":"Sign in";setUsage(); }
function newChat(){activeChatId=null;$("messages").innerHTML="";$("welcome").classList.remove("hidden");$("prompt").focus()}
function setMode(mode){
  authMode=mode;const signup=mode==="signup";
  $("authTitle").textContent=signup?"Create your account":"Welcome back";
  $("authSubtitle").textContent=signup?"Create an account to keep your conversations.":"Sign in to continue your conversations.";
  $("nameLabel").classList.toggle("hidden",!signup);$("displayName").classList.toggle("hidden",!signup);$("displayName").required=signup;
  $("authSubmit").textContent=signup?"Create account":"Sign in";
  $("switchText").textContent=signup?"Already registered?":"New here?";
  $("switchAuth").textContent=signup?"Sign in":"Create account";
}
async function refreshAuth(){
  if(!sb){setAuthUI();return}
  const {data}=await sb.auth.getSession();currentUser=data.session?.user||null;setAuthUI();
  if(currentUser) loadHistory();
}
async function loadHistory(){
  if(!sb||!currentUser)return;
  const {data,error}=await sb.from("chats").select("id,title,updated_at").order("updated_at",{ascending:false}).limit(30);
  if(error)return;
  $("history").innerHTML="";
  (data||[]).forEach(c=>{const b=document.createElement("button");b.className="history-item";b.textContent=c.title||"New chat";b.onclick=()=>openChat(c.id);$("history").appendChild(b)});
}
async function openChat(id){
  if(!sb||!currentUser)return;
  const {data,error}=await sb.from("messages").select("role,content").eq("chat_id",id).order("created_at");
  if(error){toast("Could not load chat");return}
  activeChatId=id;$("messages").innerHTML="";$("welcome").classList.add("hidden");
  (data||[]).forEach(m=>addMessage(m.role,m.content,m.role==="assistant"));
}
async function ensureChat(firstText){
  if(activeChatId||!sb||!currentUser)return activeChatId;
  const {data,error}=await sb.from("chats").insert({user_id:currentUser.id,title:firstText.slice(0, 50)}).select("id").single();
  if(error){console.error(error);return null} activeChatId=data.id;return activeChatId;
}
async function saveMessage(chatId,role,content){
  if(!sb||!currentUser||!chatId)return;
  const {error}=await sb.from("messages").insert({chat_id:chatId,user_id:currentUser.id,role,content});
  if(error)console.error("Message save failed",error);
  await sb.from("chats").update({updated_at:new Date().toISOString()}).eq("id",chatId);
}
function scanning(){
  const row=document.createElement("div");row.className="scan";row.innerHTML='<span class="scanline"></span><span>NEURAL PROCESSING</span>'; $("messages").appendChild(row);$("messages").scrollTop=$("messages").scrollHeight;return row;
}
async function sendMessage(prefill){
  if(busy)return;
  const text=(prefill??$("prompt").value).trim();if(!text)return;
  if(!currentUser&&guestCount>=GUEST_LIMIT){setMode("signup");showModal("authModal");toast("Guest limit reached. Create an account to continue.");return}
  if(!supabaseReady){toast("Setup required: add Supabase URL and anon key in app.js.");return}
  $("prompt").value="";$("prompt").style.height="auto";busy=true;$("sendBtn").disabled=true;
  addMessage("user",text);
  if(!currentUser){guestCount++;localStorage.setItem("nh_guest_count",guestCount);setUsage()}
  const chatId=await ensureChat(text);if(currentUser&&chatId)await saveMessage(chatId,"user",text);
  const loader=scanning();let assistantBubble=null,answer="";
  try{
    const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json","Accept":"text/event-stream"},body:JSON.stringify({text,uid:currentUser?currentUser.id:(localStorage.getItem("nh_guest_uid")||makeGuestUid())})});
    if(!response.ok)throw new Error((await response.text()).slice(0,250)||`Request failed (${response.status})`);
    const contentType=response.headers.get("content-type")||"";
    if(contentType.includes("text/event-stream")&&response.body){
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="",done=false;
      assistantBubble=addMessage("assistant","");loader.remove();
      while(!done){const part=await reader.read();done=part.done;buffer+=decoder.decode(part.value||new Uint8Array(),{stream:!done});
        const lines=buffer.split(/\r?\n/);buffer=lines.pop()||"";
        for(const line of lines){if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(!raw)continue;if(raw==="[DONE]"){done=true;break}
          try{const ev=JSON.parse(raw);if(ev.delta){answer+=ev.delta;assistantBubble.innerHTML=renderText(answer);$("messages").scrollTop=$("messages").scrollHeight}if(ev.error)throw new Error(ev.error)}catch(e){if(e instanceof SyntaxError)continue;throw e}
        }
      }
    }else{
      const data=await response.json();if(!data.success)throw new Error(data.error||"AI request failed");
      answer=data.reply||"";loader.remove();assistantBubble=addMessage("assistant",answer,true);
    }
    if(!answer.trim())throw new Error("The AI returned an empty response.");
    if(assistantBubble&&!assistantBubble.querySelector(".message-tools")){const tools=document.createElement("div");tools.className="message-tools";tools.innerHTML='<button class="copy-answer">Copy response</button>';tools.querySelector("button").onclick=()=>navigator.clipboard.writeText(answer).then(()=>toast("Copied to clipboard"));assistantBubble.appendChild(tools)}
    if(currentUser&&chatId)await saveMessage(chatId,"assistant",answer);
    if(currentUser)loadHistory();
  }catch(err){loader.remove();addMessage("assistant",`Sorry, I couldn't get a response. ${err.message||"Please try again."}`);console.error(err)}
  finally{busy=false;$("sendBtn").disabled=false;$("prompt").focus()}
}
function makeGuestUid(){const id="guest_"+crypto.randomUUID();localStorage.setItem("nh_guest_uid",id);return id}
$("sendBtn").onclick=()=>sendMessage();$("prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage()}});
$("prompt").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,180)+"px"});
$("newChat").onclick=newChat;$("themeToggle").onclick=()=>document.body.classList.toggle("light");
$("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");
$("topAuth").onclick=()=>currentUser?(showModal("accountModal"),renderAccount()):(setMode("signin"),showModal("authModal"));
$("accountBtn").onclick=()=>currentUser?(showModal("accountModal"),renderAccount()):(setMode("signin"),showModal("authModal"));
$("switchAuth").onclick=()=>setMode(authMode==="signin"?"signup":"signin");
$("authForm").onsubmit=async e=>{
  e.preventDefault();if(!sb){toast("Supabase setup is not complete.");return}
  const email=$("email").value.trim(),password=$("password").value,name=$("displayName").value.trim();
  $("authSubmit").disabled=true;
  try{
    if(authMode==="signup"){
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name:name}}});if(error)throw error;
      if(!data.session)toast("Account created. If confirmation is enabled in Supabase, check your email.");
      else toast("Account created successfully.");
    }else{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;toast("Signed in successfully.")}
    hideModal("authModal");await refreshAuth();
  }catch(err){toast(err.message||"Authentication failed")}
  finally{$("authSubmit").disabled=false}
};
async function renderAccount(){const {data}=await sb.auth.getUser();$("accountInfo").textContent=`Email: ${data.user?.email||"—"}\nUser ID: ${data.user?.id||"—"}`}
$("signOutBtn").onclick=async()=>{await sb.auth.signOut();currentUser=null;activeChatId=null;newChat();hideModal("accountModal");setAuthUI();toast("Signed out")};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>hideModal(b.dataset.close));
document.querySelectorAll(".suggestion").forEach(b=>b.onclick=()=>{$("prompt").value=b.dataset.prompt;$("prompt").focus()});
(async()=>{setMode("signin");setUsage();if(supabaseReady)await refreshAuth();else toast("Setup needed: configure Supabase to enable accounts and saved chats.")})();
