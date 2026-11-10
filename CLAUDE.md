# Padel Club Navigli booking app

Spec: SPEC.md. Plan: PLAN.md.

- Next.js (App Router), Supabase, deployed on Vercel.
- The keys are in .env.local: NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY. Use these names.
- Never put a secret key in a NEXT_PUBLIC_ variable or in client code.
- Rules that protect data go in the database (constraints, RLS),
  not only in the page.
- Show errors from Supabase on the page, never hide them.
- Every page and server action checks the user's role on the server.
  Never rely on hiding links.

## How we work

- When I say "grill me", interview me until we agree on every decision.
  Ask one question at a time, in the chat, as plain text. With each
  question, give your recommended answer and why. Start with the questions
  that change the most. Don't change any file until I say we're done.
  Then write my decisions into the file I asked about, and add each
  question and answer to GRILL.md.
- Plan first. Build one slice from PLAN.md at a time.
- If the spec doesn't answer something, ask me. Don't guess.
- Keep the code in a few modules. Each one has a small, simple interface
  and hides the details behind it. Add to a module before making a new
  small file.
- Follow the Look section of SPEC.md. After each slice, say how to check
  the screen at phone size against it.
- After each slice, tell me exactly how to check it in the browser. Then
  tick it in PLAN.md and write one line under it: what's done, what's
  left. I start each slice in a new conversation.
