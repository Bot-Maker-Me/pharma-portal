# Tech Stack
- **Next.js 16 (App Router)** with **React 19** and **TypeScript** (`strict: true`). Server Components by default; add `'use client'` only when a file needs state, effects, or browser APIs.
- **Tailwind CSS v4** via `@tailwindcss/postcss`. There is no `tailwind.config.js` — theme tokens live in `app/globals.css` (`@theme`, CSS variables).
- **shadcn/ui** components in `components/ui`, generated in the **`base-nova`** style on top of **Base UI** primitives (`@base-ui/react`), not Radix.
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) for authentication and Postgres, using row-level security for multi-tenant data isolation.
- **SheetJS (`xlsx`)** for importing/exporting spreadsheets (`.xlsx`, `.csv`).
- **lucide-react** for icons and **`@vercel/analytics`** for web analytics.
- Path alias `@/*` maps to the project root; the app code lives in `app/` and `lib/` (there is no `src/` folder).
- Package manager: **pnpm**.

# Library Rules
- **Routing:** Use the Next.js App Router only (files under `app/`). Never add React Router or another client-side router. Routes: `app/page.tsx` (marketing + auth), `app/workspace/page.tsx` (real, tenant-scoped workspace), `app/chat/page.tsx` (Chat with Home), `app/admin/page.tsx` (platform-admin console), `app/platform/page.tsx`, `app/workspace/[feature]/page.tsx`, and `app/auth/callback/route.ts`.
- **UI components:** Reuse existing shadcn/ui components from `components/ui` first. Add new shadcn components in the `base-nova` style rather than hand-rolling primitives. Do **not** edit files in `components/ui` directly — wrap them in `components/` or the page instead.
- **Styling:** Use Tailwind CSS utility classes and the design tokens in `app/globals.css`. Reuse the existing semantic classes (e.g. `site-shell`, `workspace`, `panel-kicker`) for consistency; avoid new global CSS files and inline styles.
- **Class names:** Use `cn()` from `@/lib/utils` for conditional or merged Tailwind classes; don't concatenate class strings by hand.
- **Icons:** Use `lucide-react` exclusively.
- **Data & auth:** Access Supabase only through `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server). Read config from `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — never hardcode keys or URLs. Keep server-only logic in `lib/features/server.ts` and mark those modules `import 'server-only'`.
- **Access control:** Gate tenant/feature access with the guards in `lib/features/server.ts` (`requireTenant`, `requireFeature`, `requirePlatformAdmin`) and register features in `lib/features/registry.ts`. Enforce permissions server-side, not just in the UI.
- **Spreadsheets:** Use SheetJS (`xlsx`) for any tabular file parsing/generation; don't add another CSV/Excel library.
- **Dates & numbers:** Use the native `Intl` APIs; do not add `moment`, `dayjs`, or `date-fns`.

# Conventions
- Keep source in `app/` (routes, layouts) and `lib/` (shared logic); put reusable components in `components/` and shadcn primitives in `components/ui/`.
- Database changes go in `supabase/migrations/` as SQL migrations with RLS policies enabled.
- `next.config.mjs` ignores TypeScript build errors, so keep the code type-clean yourself and verify with type checks.
- When adding a new workspace feature, wire it into both `lib/features/registry.ts` and the sidebar so it is reachable.
