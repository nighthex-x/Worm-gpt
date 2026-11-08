import { createClient } from "@supabase/supabase-js";
const reply=(res,status,body)=>{res.setHeader("Cache-Control","no-store, private, max-age=0");res.setHeader("Pragma","no-cache");return res.status(status).json(body)};
const clean=(v,n=500)=>typeof v==="string"?v.trim().slice(0,n):"";
export default async function handler(req,res){
 if(!["GET","POST"].includes(req.method))return reply(res,405,{error:"Method not allowed"});
 const PROJECT_URL = "https://mskcclqkvmurlcwwfgyr.supabase.co";
 const {SUPABASE_SERVICE_ROLE_KEY,ADMIN_EMAIL}=process.env;
 if(!SUPABASE_SERVICE_ROLE_KEY||!ADMIN_EMAIL)return reply(res,503,{error:"Admin service is not configured"});
 const token=(req.headers.authorization||"").startsWith("Bearer ")?(req.headers.authorization||"").slice(7).trim():"";
 if(!token||token.length>4096)return reply(res,401,{error:"Sign in required"});
 try{
  const db=createClient(PROJECT_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data:auth,error:authErr}=await db.auth.getUser(token);const actor=auth?.user;
  if(authErr||!actor)return reply(res,401,{error:"Invalid or expired session"});
  const adminEmail=ADMIN_EMAIL.trim().toLowerCase();
  if((actor.email||"").trim().toLowerCase()!==adminEmail)return reply(res,403,{error:"Admin access denied"});
  if(req.method==="POST"){
   const b=req.body&&typeof req.body==="object"?req.body:{};const action=clean(b.action,40);
   if(action==="maintenance"){
    const row={id:1,maintenance_enabled:!!b.enabled,maintenance_message:clean(b.message,1000)||"NIGHT HEX AI is temporarily under maintenance. Please try again later.",updated_at:new Date().toISOString()};
    const {error}=await db.from("site_settings").upsert(row,{onConflict:"id"});if(error)return reply(res,400,{error:"Could not update maintenance settings. Run the latest schema.sql first."});
    return reply(res,200,{success:true});
   }
   if(action==="announcement"){
    const title=clean(b.title,100),message=clean(b.message,1000);if(!title||!message)return reply(res,400,{error:"Title and message are required"});
    const {data,error}=await db.from("announcements").insert({title,message,active:true,created_by:actor.id}).select("id,title,message,created_at").single();if(error)return reply(res,400,{error:"Could not publish announcement. Check database setup."});return reply(res,200,{success:true,announcement:data});
   }
   if(action==="delete_announcement"){
    const id=clean(b.id,60);const {error}=await db.from("announcements").delete().eq("id",id);if(error)return reply(res,400,{error:"Could not delete announcement"});return reply(res,200,{success:true});
   }
   if(action==="reset_password"){
    const id=clean(b.userId,50);if(!/^[0-9a-f-]{36}$/i.test(id))return reply(res,400,{error:"Valid user ID required"});
    const {data,error}=await db.auth.admin.getUserById(id);if(error||!data?.user)return reply(res,404,{error:"User not found"});
    if((data.user.email||"").toLowerCase()===adminEmail)return reply(res,403,{error:"Admin account cannot be reset from user controls"});
    const {error:sendError}=await db.auth.resetPasswordForEmail(data.user.email,{redirectTo:process.env.SITE_URL||undefined});if(sendError)return reply(res,400,{error:"Could not send password reset email"});return reply(res,200,{success:true});
   }
   if(action==="ban"||action==="unban"){
    const id=clean(b.userId,50);if(!/^[0-9a-f-]{36}$/i.test(id))return reply(res,400,{error:"Valid user ID required"});
    const {data:target,error:targetErr}=await db.auth.admin.getUserById(id);if(targetErr||!target?.user)return reply(res,404,{error:"User not found"});
    if(id===actor.id||(target.user.email||"").trim().toLowerCase()===adminEmail)return reply(res,403,{error:"Administrator account is protected"});
    if(action==="unban") {const {error}=await db.auth.admin.updateUserById(id,{ban_duration:"none"});if(error)return reply(res,400,{error:"Could not unblock account"});}
    else {const durations=new Set(["1h","24h","7d","30d","876000h"]);if(!durations.has(b.duration))return reply(res,400,{error:"Invalid block duration"});const {error}=await db.auth.admin.updateUserById(id,{ban_duration:b.duration});if(error)return reply(res,400,{error:"Could not block account"});}
    return reply(res,200,{success:true});
   }
   return reply(res,400,{error:"Unknown admin action"});
  }
  const [users,chats,messages,settings,announcements,events]=await Promise.all([
   db.auth.admin.listUsers({page:1,perPage:1000}),db.from("chats").select("id",{count:"exact",head:true}),db.from("messages").select("id",{count:"exact",head:true}),db.from("site_settings").select("maintenance_enabled,maintenance_message").eq("id",1).maybeSingle(),db.from("announcements").select("id,title,message,created_at,active").order("created_at",{ascending:false}).limit(20),db.from("usage_events").select("category,created_at,user_id").gte("created_at",new Date(Date.now()-30*86400000).toISOString()).limit(10000)
  ]);
  if(users.error)return reply(res,500,{error:"Could not load users"});
  const eventRows=events.data||[];const today=new Date();today.setHours(0,0,0,0);const todayEvents=eventRows.filter(e=>new Date(e.created_at)>=today);const activeToday=new Set(todayEvents.map(e=>e.user_id).filter(Boolean)).size;const categoryCounts={};for(const e of eventRows)categoryCounts[e.category]=(categoryCounts[e.category]||0)+1;
  const safeUsers=(users.data.users||[]).map(u=>({id:u.id,email:u.email||null,name:u.user_metadata?.display_name||u.user_metadata?.name||"—",created_at:u.created_at,last_sign_in_at:u.last_sign_in_at,email_confirmed_at:u.email_confirmed_at,banned_until:u.banned_until}));
  return reply(res,200,{admin:{email:actor.email},totals:{users:safeUsers.length,chats:chats.count||0,messages:messages.count||0,activeToday},users:safeUsers,maintenance:settings.data||{maintenance_enabled:false,maintenance_message:""},announcements:announcements.data||[],analytics:{categories:categoryCounts,events30d:eventRows.length}});
 }catch(e){console.error("[NIGHT HEX ADMIN API ERROR]", e?.message || e);return reply(res,500,{error:"Admin API failed. Check Render Logs."});}
}
