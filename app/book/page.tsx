import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUser } from "@/lib/auth";
import { book, getCourt, slotTime } from "@/lib/booking";
import { BookForm, type BookState } from "./form";

async function bookSlot(_: BookState, form: FormData): Promise<BookState> {
  "use server";
  const name = String(form.get("name") ?? "");
  const phone = String(form.get("phone") ?? "");
  let id: string;
  try {
    id = await book({
      courtId: Number(form.get("court")),
      startsAt: String(form.get("at")),
      name,
      phone,
    });
  } catch (error) {
    return { error: (error as Error).message, name, phone };
  }
  redirect(`/confirmation/${id}`);
}

export default function BookPage({ searchParams }: PageProps<"/book">) {
  return (
    <Suspense fallback={<p className="text-zinc-600">Loading…</p>}>
      <BookView searchParams={searchParams} />
    </Suspense>
  );
}

async function BookView({ searchParams }: Pick<PageProps<"/book">, "searchParams">) {
  const { court: courtParam, at } = await searchParams;
  const courtId = Number(courtParam);
  if (!Number.isInteger(courtId) || typeof at !== "string" || Number.isNaN(Date.parse(at))) {
    notFound();
  }
  const [court, user] = await Promise.all([getCourt(courtId), currentUser()]);
  if (!court) notFound();
  const slot = slotTime(at);

  return (
    <div className="max-w-md">
      <Link href={`/?day=${slot.date}`} className="text-club underline">
        ← Other times
      </Link>
      <h1 className="mt-4 font-heading text-4xl font-bold">Book {court.name}</h1>
      <p className="mt-2 text-lg">
        {slot.day}, {slot.time} to {slot.endTime}
      </p>
      <BookForm
        action={bookSlot}
        courtId={court.id}
        startsAt={at}
        name={user?.profile?.fullName ?? ""}
        phone={user?.profile?.phone ?? ""}
      />
    </div>
  );
}
