import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { accounts, logIn, milanDate, missingEnv } from './helpers';

test.skip(
  !!missingEnv('MEMBER_EMAIL', 'MEMBER_PASSWORD', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY'),
  'needs the member account and SUPABASE_SECRET_KEY',
);

test('the 21st question of the day is refused without calling the model', async ({ page }) => {
  const { member } = accounts();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  const { data: users, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  expect(listError).toBeNull();
  const userId = users!.users.find((u) => u.email === member.email)!.id;

  const row = { user_id: userId, day: milanDate(0), n: 20 };
  const { error: setError } = await admin.from('ai_daily_count').upsert(row);
  expect(setError).toBeNull();
  try {
    await logIn(page, member.email, member.password);
    await page.goto('/ask');
    await page.getByLabel('Your question').fill('Can I cancel a booking?');
    await page.getByRole('button', { name: 'Ask' }).click();
    await expect(page.locator('p[role=alert]')).toHaveText(
      "You've asked 20 questions today, the daily limit. Ask again tomorrow, or ask the desk.",
    );
  } finally {
    await admin.from('ai_daily_count').delete().eq('user_id', userId).eq('day', row.day);
  }
});
