import Link from "next/link";
import { logIn } from "@/app/auth/actions";
import { AuthForm } from "@/app/auth/auth-form";

export default function LogInPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <AuthForm action={logIn} />
      <p className="mt-4">
        New here? <Link href="/signup" className="underline">Sign up</Link>
      </p>
    </main>
  );
}
