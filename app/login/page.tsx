import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logIn, safeNext } from "@/lib/auth";
import { LoginForm, type AccountState } from "./forms";

async function logInAction(_: AccountState, form: FormData): Promise<AccountState> {
  "use server";
  const email = String(form.get("email") ?? "").trim();
  try {
    await logIn(email, String(form.get("password") ?? ""));
  } catch (error) {
    return { error: (error as Error).message, done: null, values: { email } };
  }
  redirect(safeNext(form.get("next")));
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="max-w-md">
      <h1 className="font-heading text-4xl font-bold">Log in</h1>
      <p className="mt-2 text-lg">Members can book up to 7 days ahead and see their bookings.</p>
      <Suspense fallback={<p className="mt-6 text-zinc-600">Loading…</p>}>
        <LoginView searchParams={searchParams} />
      </Suspense>
      <p className="mt-6">
        No account yet?{" "}
        <Link href="/signup" className="text-club underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

async function LoginView({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, error } = await searchParams;
  return (
    <>
      {typeof error === "string" && (
        <p role="alert" className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      <LoginForm action={logInAction} next={safeNext(next)} />
    </>
  );
}
