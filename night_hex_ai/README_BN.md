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

Sign in with the same email configured in Render as `ADMIN_EMAIL`. Server-side API verification checks the email before returning admin statistics and user information or applying account blocks. Normal accounts cannot access the admin data. The admin can block accounts for 1 hour, 1 day, 7 days, 30 days, or a very long period (100 years), and can unblock them. This is not a literal permanent ban.

Passwords are never displayed to administrators. Supabase handles password authentication securely.

## Chat history
- Guest chat history is stored in localStorage on the current browser/device. Clearing browser site data or changing devices removes/does not carry over that guest history.
- Signed-in chat history is stored in Supabase under the signed-in user and protected by RLS.
- Guest usage limits are stored locally and can be reset by clearing browser storage; this is not a robust server-side rate limit.

## Important limitations
- Render Free services may sleep after inactivity and take time to wake up.
- AI provider, Supabase, and Render usage limits still apply.
- The admin endpoint lists up to 1,000 users in this version. Chat requests from signed-in users include their access token so the server can reject active bans.
- This is an updated starter build, not a guarantee of production security or load testing. Add server-side rate limiting, privacy policy, backups, and monitoring before a public launch.
