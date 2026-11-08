import { createClient } from "@supabase/supabase-js";
const out=(res,s,b)=>{res.setHeader("Cache-Control","no-store");return res.status(s).json(b)};
const baseUrl=req=>(process.env.SITE_URL||`${req.headers["x-forwarded-proto"]||"https"}://${req.headers.host||""}`).replace(/\/$/,"");
export default async function handler(req,res){
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=process.env;if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)return out(res,503,{error:"Share service unavailable"});
 const db=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 if(req.method==="POST"){
  const token=(req.headers.authorization||"").startsWith("Bearer ")?req.headers.authorization.slice(7).trim():"";if(!token)return out(res,401,{error:"Sign in required"});
  const {data:auth,error}=await db.auth.getUser(token);if(error||!auth.user)return out(res,401,{error:"Invalid session"});
  const chatId=String(req.body?.chatId||"");const {data:chat,error:ce}=await db.from("chats").select("id,title,user_id").eq("id",chatId).single();if(ce||!chat||chat.user_id!==auth.user.id)return out(res,404,{error:"Conversation not found"});
  const {data:existing}=await db.from("shared_chats").select("token").eq("chat_id",chatId).eq("user_id",auth.user.id).maybeSingle();
  if(existing?.token)return out(res,200,{url:`${baseUrl(req)}/share/${existing.token}`,token:existing.token});
  const {data,error:ie}=await db.from("shared_chats").insert({chat_id:chatId,user_id:auth.user.id}).select("token").single();if(ie)return out(res,400,{error:"Could not create share link. Run latest schema.sql."});
  return out(res,200,{url:`${baseUrl(req)}/share/${data.token}`,token:data.token});
 }
 if(req.method==="GET"){
  const token=String(req.query?.token||"").trim();if(!/^[0-9a-f-]{36}$/i.test(token))return out(res,400,{error:"Invalid share link"});
  const {data:share,error}=await db.from("shared_chats").select("chat_id").eq("token",token).maybeSingle();if(error||!share)return out(res,404,{error:"Shared conversation not found"});
  const [{data:chat},{data:messages}]=await Promise.all([db.from("chats").select("title,created_at").eq("id",share.chat_id).single(),db.from("messages").select("role,content,created_at").eq("chat_id",share.chat_id).order("created_at")]);return out(res,200,{chat,messages:messages||[]});
 }
 return out(res,405,{error:"Method not allowed"});
}
