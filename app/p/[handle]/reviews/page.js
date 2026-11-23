// All approved reviews for a pro, newest first.
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProfile } from "@/lib/publicProfile";
import { displayName } from "@/lib/bookingHeader";
import { BRAND_NAME } from "@/lib/brand";
import Reviews from "../../Reviews";

async function viewerId() {
  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const p = await loadProfile(handle, await viewerId());
  return p ? { title: `Reviews · ${displayName(p.name)}` } : { title: `Not found · ${BRAND_NAME}` };
}

export default async function AllReviews({ params }) {
  const { handle } = await params;
  const p = await loadProfile(handle, await viewerId());
  if (!p || !p.show.reviews || !p.reviews) notFound();
  const name = displayName(p.name);
  return (
    <main className="bk-main pp">
      <p className="small-text">
        <Link href={`/p/${p.handle}`}>‹ {name}</Link>
      </p>
      <Reviews reviews={p.reviews} handle={p.handle} limit={1000} name={name} />
      <div className="pp-actions">
        <Link className="button" href={`/book/${p.slug}`}>
          See availability
        </Link>
      </div>
    </main>
  );
}
