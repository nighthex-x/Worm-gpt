# NIGHT HEX AI — Render-ready project

## Features
- Mobile-first AI chat interface with dark/light themes
- User-provided NIGHT HEX portrait logo (`assets/night-hex-logo.webp`)
- Separate admin login page at `/admin`
- Chat streaming through `/api/chat`
- Supabase email/password authentication with immediate sign-in when email confirmation is disabled
- Admin account controls: temporary blocks (1 hour, 1 day, 7 days, 30 days) and long-term block (100 years), plus unblock
- Registered-user history saved in Supabase
- Guest history saved locally in this browser using localStorage
- Guest question counter (browser-local; not abuse-proof)
- Sidebar closes using its close button, tapping outside, or selecting an item
- Mobile pinch zoom is disabled in the page viewport

## Deploy on Render
Create a **Web Service** connected to this GitHub repository.

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Instance: Free (if available)

## Render Environment Variables
Add these in Render → your Web Service → Environment:

- `SUPABASE_URL` = Supabase Project URL (without `/rest/v1/`)
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase backend Secret key or legacy service_role key
- `ADMIN_EMAIL` = exact email address of the administrator account

Do not put the backend Secret/service_role key in GitHub, browser JavaScript, or share it in screenshots/messages. The frontend uses only the Supabase Publishable key.

## Supabase frontend configuration
The current Project URL and Publishable key are configured in `app.js` and `admin.js`. If you create a different Supabase project, update both files with that project's URL and Publishable key.

The `schema.sql` file creates `chats` and `messages` tables with Row Level Security. It has already been applied in the user's project; do not rerun unless you intentionally need to recreate policies.

## Automatic sign-in after account creation
To make a new user sign in immediately without manual/admin approval:
1. Open Supabase Dashboard → Authentication → Sign In / Providers → Email.
2. Turn **Confirm email** OFF and save.
3. New signups should then return a session and the app signs the user in automatically.

This means the app does not verify that the person owns the email address at signup. If you prefer verified email addresses, leave confirmation ON and users must confirm their email before signing in.

Existing users can sign in from another phone using the same email and password. Supabase stores the session on each device; signing out on one device does not transfer the session to another.

## Admin login
Open `https://YOUR-RENDER-SUBDOMAIN.onrender.com/admin`.

Sign in with the same email configured in Render as `ADMIN_EMAIL`. The server validates the Supabase access token and compares the verified account email with `ADMIN_EMAIL` on every admin API request. Client-side role labels are never trusted. The dashboard stays hidden until that server check succeeds. Normal accounts cannot read admin data or perform account actions. The configured administrator account is protected from block/unblock actions. The admin can block accounts for 1 hour, 1 day, 7 days, 30 days, or a very long period (100 years), and can unblock them. This is not a literal permanent ban.

Passwords are never displayed to administrators. Supabase handles password authentication securely.

## Chat history
- Guest chat history is stored in localStorage on the current browser/device. Clearing browser site data or changing devices removes/does not carry over that guest history.
- Signed-in chat history is stored in Supabase under the signed-in user and protected by RLS.
- Guest usage limits are stored locally and can be reset by clearing browser storage; this is not a robust server-side rate limit.

## Important limitations
- Render Free services may sleep after inactivity and take time to wake up.
- AI provider, Supabase, and Render usage limits still apply.
- The admin endpoint lists up to 1,000 users in this version. On Render, both GET (dashboard) and POST (block/unblock) requests are routed through the same protected admin handler. Chat requests from signed-in users include their access token so the server can reject active bans.
- This is an updated starter build, not a guarantee of production security or load testing. Add server-side rate limiting, privacy policy, backups, and monitoring before a public launch.

## Advanced Update (November 2026)
এই সংস্করণে যোগ হয়েছে:
- স্থির নিচের Composer; চ্যাটের মাঝখানে স্ক্রল করলেও টাইপিং বক্স নিচে থাকবে।
- নিচে ফেরার Floating Arrow; নিচে পৌঁছালে নিজে থেকে লুকাবে।
- Chat Rename, Delete, Print-to-PDF এবং shareable read-only link.
- Admin Dashboard: নাম/ইমেইল, joined/last active, search, temporary/long-term block, unblock, password reset email.
- Maintenance mode: visitor-দের জন্য custom message এবং chat API-তেও server-side maintenance check; configured Admin bypass করতে পারবেন।
- Announcements/Notifications এবং ৩০ দিনের category-based usage overview. Message content analytics-এ রাখা হয় না।
- True white light theme এবং dark theme; mobile fixed layout.

### নতুন Environment Variable
Render → Environment:
- `SUPABASE_URL` = Supabase Project URL (শেষে `/rest/v1/` নয়)
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase secret/service-role key (শুধু Render Environment-এ; GitHub বা frontend-এ নয়)
- `ADMIN_EMAIL` = একমাত্র Admin account-এর email
- `SITE_URL` = ঐচ্ছিক, যেমন `https://your-render-domain.onrender.com` (share link এবং password reset redirect-এর জন্য সুপারিশকৃত)

### Database Update বাধ্যতামূলক
Supabase → SQL Editor-এ এই ZIP-এর `schema.sql` ফাইলের সম্পূর্ণ SQL আবার Run করুন। এটি আগের chats/messages টেবিল মুছে না; নতুন maintenance, announcements, analytics এবং shared conversation টেবিল তৈরি করে।

### Deploy
1. ZIP Extract করে সব ফাইল GitHub repository root-এ replace/upload করুন; `api` এবং `assets` ফোল্ডার root-এ থাকবে।
2. Supabase SQL update Run করুন।
3. Render-এ Environment Variables যাচাই করুন। Service-role key কখনো GitHub-এ রাখবেন না।
4. Render-এ Deploy latest commit দিন।
5. `/admin` খুলে নির্ধারিত Admin email দিয়ে লগইন করুন। Refresh করলে Supabase session valid থাকলে আবার password চাইবে না।

নিরাপত্তা/সীমাবদ্ধতা:
- Admin ইউজারের পুরোনো পাসওয়ার্ড দেখতে পারবেন না; শুধু reset email পাঠাতে পারবেন।
- Share link যার কাছে থাকবে সে ওই conversation পড়তে পারবে; সংবেদনশীল তথ্য থাকা chat share করবেন না।
- Analytics কেবল category count এবং authenticated active users-এর event count রাখে; raw prompt সংরক্ষণ করে না।
- Browser-এর PDF export Print dialog ব্যবহার করে; সেখানে Save as PDF নির্বাচন করুন।
- এই ZIP local syntax check করা হয়েছে; তোমার Render/Supabase live environment-এ deploy করে end-to-end test করা হয়নি।

### Signup-এর পর সঙ্গে সঙ্গে Login
Supabase Dashboard → Authentication → Sign In / Providers → Email-এ `Confirm email` OFF করলে নতুন অ্যাকাউন্ট তৈরি হওয়ার পর সঙ্গে সঙ্গে session তৈরি হবে এবং সাইটে ঢুকবে। Email ownership verify না হওয়ায় এটি কম নিরাপদ; public website-এ Confirm email ON রাখাই ভালো। Confirm email ON থাকলে inbox verification ছাড়া auto-login সম্ভব নয়।


## Admin Login stability update
- Admin browser session uses Supabase persistent session storage and auto-refresh.
- Admin API independently checks the signed-in user and the server-side `ADMIN_EMAIL`.
- The Admin API uses the configured Supabase Project URL in code; `SUPABASE_URL` is no longer required for Admin verification.
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_EMAIL` only in Render Environment. Never place the service-role key in GitHub or browser code.
- Render logs now include safe `/api/admin` request/response status lines; no passwords or access tokens are logged.


## Admin panel scroll and mobile layout update
- Admin page now has its own vertical document scrolling; the chat app keeps its fixed-height layout.
- Compact mobile dashboard cards and responsive user account rows.
- Added refresh control, account status filter, and server/admin health indicators.
- Existing maintenance, announcement, analytics, password-reset, block/unblock and persistent admin login flows are retained.
- JavaScript syntax and admin HTML element references were checked locally. Live deployment still needs testing on the user's Render/Supabase project.


## Admin Panel V2 Update
- Admin dashboard is now compact; every control opens in a separate modal panel.
- User manager supports username/email/ID search, active/blocked filtering, custom block durations, unblock and password-reset email.
- Maintenance supports minute/hour/day/30-day-month duration and automatically ends on the server when its timer expires. No extra SQL migration is required; the expiry is stored in the existing maintenance message field.
- Announcements, aggregate analytics, system health and security/session details each have separate panels.
- Admin page scrolling and modal scrolling are enabled for mobile screens.
- Chat stream headers are flushed immediately where supported; actual provider latency still depends on the upstream AI service.
- Client-side response cleanup replaces common accidental Rofiqul/Rahat identity mentions with NIGHT HEX branding.

## Response speed + live maintenance update (9 November 2026)
- The chat request now starts without waiting for chat-history writes. User/assistant history is saved after the answer has streamed, so database writes do not hold back the first AI token.
- The loading indicator stays visible until the first actual response text arrives; then the answer is rendered progressively as upstream chunks arrive.
- The stream reader preserves spaces between chunks and understands common SSE/OpenAI/Anthropic-style text events plus common JSON response shapes. The upstream provider still controls its own generation speed and first-token delay.
- Branding cleanup is restricted to clear self-identification phrases (for example, “I am Xrahat AI” or “My name is Rofiqul”). Ordinary mentions of those names in the body are left unchanged.
- The User Panel checks maintenance/notices every 5 seconds while visible, and refreshes immediately when the tab becomes active again. Chat API independently checks the latest database setting on every request, so a user cannot bypass maintenance by skipping the browser popup.
- The server checks the maintenance expiry timestamp itself. Expired maintenance becomes inactive; an Admin manual stop is effective on the next status refresh (normally within 5 seconds) and the next chat request.
- Admin updates to announcements are reflected on the next status refresh. The status endpoint disables caching.

**Deploy this update:** replace the repository files with the contents of this ZIP and deploy the latest commit on Render. No SQL rerun is required for this update, and do not change Render environment variables unless Render logs show a specific configuration error. Keep `SUPABASE_SERVICE_ROLE_KEY` private in Render only.

**Verification performed for this ZIP:** JavaScript syntax checks, branding replacement test cases, HTML parsing, CSS delimiter checks, and ZIP integrity checks. This environment cannot verify live Render/Supabase/upstream behavior; test the deployed site with a separate normal user account after deployment.
