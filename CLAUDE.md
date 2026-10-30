# Padel Club Navigli booking app

Spec: SPEC.md. Plan: PLAN.md. Build one task at a time.

- Next.js (App Router), Supabase, deployed on Vercel.
- The keys are in .env.local: NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY. Use these names.
- Never put a secret key in a NEXT_PUBLIC_ variable or in client code.
- Rules that protect data go in the database (constraints, RLS),
  not only in the page.
- Show errors from Supabase on the page, never hide them.
- After each task, tell me exactly how to check it in the browser.
