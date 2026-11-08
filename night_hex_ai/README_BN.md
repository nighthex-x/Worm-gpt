# NIGHT HEX AI — Vercel Starter

এটি Vercel-এ deploy করার জন্য তৈরি text-only AI chat project।

## যা আছে
- Dark responsive AI chat UI
- Xrahat AI API-তে server-side proxy এবং SSE streaming
- Guest mode-এ ৫টি প্রশ্ন (একই browser-এ local counter)
- Email/password registration ও sign-in
- Supabase-এ user-specific chat history
- Admin overview API (নির্দিষ্ট Admin Email দিয়ে)
- Developer credit `NIGHT HEX` → https://t.me/NightHex_X
- Voice ও image upload নেই
- AI response-এ provider metadata দেখানো হয় না

## ১. Supabase তৈরি
1. https://supabase.com এ project তৈরি করো।
2. Project Settings → API থেকে Project URL এবং anon/public key নাও।
3. SQL Editor-এ `schema.sql`-এর সব SQL চালাও।
4. Authentication → Providers → Email চালু রাখো।
5. Authentication → Settings-এ Email confirmation বন্ধ করো, যদি instant email/password signup চাও।
6. Authentication → URL Configuration-এ তোমার Vercel deployment URL যোগ করো।

## ২. Frontend Supabase config
`app.js`-এ নিচের দুটি placeholder বদলাও:
- `YOUR_SUPABASE_PROJECT_URL`
- `YOUR_SUPABASE_ANON_KEY`

Anon/public key browser-এ ব্যবহার করা স্বাভাবিক; Service Role Key কখনো এখানে বসাবে না।

## ৩. Vercel deploy
1. এই ZIP GitHub repository-তে upload করো।
2. Vercel-এ New Project → Import Git Repository।
3. Framework Preset: Other; Build Command ও Output Directory ফাঁকা রাখো।
4. Deploy করো।

## ৪. Vercel Environment Variables
Project → Settings → Environment Variables-এ যোগ করো:
- `SUPABASE_URL` = Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase service_role key (শুধু server-side)
- `ADMIN_EMAIL` = তোমার Admin account-এর exact email

তারপর Redeploy করো। Admin overview page `/admin.html` এবং endpoint `/api/admin`। `admin.js`-এও একই Supabase URL ও anon key বসাতে হবে। Admin endpoint ব্যবহার করতে signed-in user's access token `Authorization: Bearer <token>` হিসেবে পাঠাতে হয়। এই starter-এ Admin UI dashboard আলাদা করে সম্পূর্ণ সাজানো হয়নি; API endpoint প্রস্তুত আছে।

## ৫. সীমাবদ্ধতা ও নিরাপত্তা
- “Unlimited” মানে এই অ্যাপে registered user-এর জন্য কোনো নিজস্ব question cap নেই। AI provider, Supabase এবং Vercel-এর quota/usage limit প্রযোজ্য।
- Email confirmation বন্ধ করলে ইমেইল মালিকানা যাচাই হয় না; যেকেউ অন্যের email লিখে account খুলতে পারে। তাই verified badge দেখানো হয় না।
- Password কখনো admin-এর কাছে readable রাখা হয় না; Supabase secure password handling করে। Admin account reset/disable করতে পারে, কিন্তু আসল password দেখতে পারে না।
- Guest limit browser-local; এটি শক্ত server-enforced abuse protection নয়।
- Chat history সংরক্ষিত হয়। Publish করার আগে Privacy Policy ও data retention নিয়ম যোগ করো।
- Admin API-তে প্রথম 1000 user পর্যন্ত তালিকা আনা হয়।
- API provider-এর SSE event-এ `data: {"delta":"..."}` format প্রত্যাশা করা হয়েছে।
- Production-এ rate limiting, abuse protection, pagination, admin UI এবং proper privacy controls আরও শক্ত করা উচিত।

## Developer link
`https://t.me/NightHex_X` — শুধু NIGHT HEX developer credit-এ ব্যবহার করা হয়েছে; কোনো channel link নেই।
