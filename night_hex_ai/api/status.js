import { createClient } from "@supabase/supabase-js";
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store, max-age=0");
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 const PROJECT_URL = "https://mskcclqkvmurlcwwfgyr.supabase.co";
 const {SUPABASE_SERVICE_ROLE_KEY,ADMIN_EMAIL}=process.env;
 if(!SUPABASE_SERVICE_ROLE_KEY)return res.status(200).json({maintenance:false,announcements:[],admin:false});
 try{
  const db=createClient(PROJECT_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  let admin=false;const token=(req.headers.authorization||"").startsWith("Bearer ")?req.headers.authorization.slice(7).trim():"";
  if(token&&ADMIN_EMAIL){const {data}=await db.auth.getUser(token);admin=!!data?.user?.email&&(data.user.email.toLowerCase()===ADMIN_EMAIL.trim().toLowerCase());}
  const [s,a]=await Promise.all([db.from("site_settings").select("maintenance_enabled,maintenance_message").eq("id",1).maybeSingle(),db.from("announcements").select("id,title,message,created_at").eq("active",true).order("created_at",{ascending:false}).limit(5)]);
  let enabled=!!s.data?.maintenance_enabled,message=s.data?.maintenance_message||"";const match=message.match(/\n?\[\[NH_EXPIRES:(.*?)\]\]$/);if(match){const expiry=new Date(match[1]);message=message.replace(/\n?\[\[NH_EXPIRES:.*?\]\]$/, "");if(!Number.isNaN(expiry.getTime())&&expiry<=new Date()){enabled=false;await db.from("site_settings").update({maintenance_enabled:false,maintenance_message:message,updated_at:new Date().toISOString()}).eq("id",1);}}
  return res.status(200).json({maintenance:enabled&&!admin,message,announcements:a.data||[],admin});
 }catch{return res.status(200).json({maintenance:false,announcements:[],admin:false});}
}
