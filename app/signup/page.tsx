import Link from "next/link";
import { redirect } from "next/navigation";
import { signUp } from "@/lib/auth";
import { SignupForm, type AccountState } from "../login/forms";

async function signUpAction(_: AccountState, form: FormData): Promise<AccountState> {
  "use server";
  const values = {
    full_name: String(form.get("full_name") ?? "").trim(),
    phone: String(form.get("phone") ?? "").trim(),
    email: String(form.get("email") ?? "").trim(),
  };
  let needsConfirmation: boolean;
  try {
    ({ needsConfirmation } = await signUp({
      email: values.email,
      password: String(form.get("password") ?? ""),
      fullName: values.full_name,
      phone: values.phone,
    }));
  } catch (error) {
    return { error: (error as Error).message, done: null, values };
  }
  if (!needsConfirmation) redirect("/my-bookings");
  return {
    error: null,
    done: `Check your email (${values.email}) and tap the link to confirm your account.`,
    values,
  };
}

export default function SignupPage() {
  return (
    <div className="max-w-md">
      <h1 className="font-heading text-4xl font-bold">Sign up</h1>
      <p className="mt-2 text-lg">See all your bookings in one place. Become a member to book up to 7 days ahead.</p>
      <SignupForm action={signUpAction} />
      <p className="mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-club underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
