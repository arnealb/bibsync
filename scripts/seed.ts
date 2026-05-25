/**
 * Seed script for BibSync — creates a demo room with 3 users, proposals,
 * votes, presence and chat messages.
 *
 * Requires the Supabase service_role (secret) key, which bypasses RLS:
 *   SUPABASE_SECRET_KEY in .env.local (NOT needed by the app itself).
 *
 * Run with: pnpm seed
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.log(
    "⏭  Seed overgeslagen: zet NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SECRET_KEY in .env.local.\n" +
      "   (De secret/service_role key vind je in Supabase → Project Settings → API keys.)",
  );
  process.exit(0);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "test1234";
const JOIN_CODE = "DEMO42";

const USERS = [
  { email: "alice@bibsync.test", name: "Alice" },
  { email: "bob@bibsync.test", name: "Bob" },
  { email: "charlie@bibsync.test", name: "Charlie" },
];

function isoDatePlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function ensureUser(
  email: string,
  name: string,
): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (created.data.user) return created.data.user.id;

  // Already exists — find the id.
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = data.users.find((u) => u.email === email);
  if (!existing) throw new Error(`Kon gebruiker ${email} niet aanmaken/vinden`);
  return existing.id;
}

async function findOrCreateRoom(ownerId: string): Promise<string> {
  const { data: existing } = await admin
    .from("rooms")
    .select("id")
    .eq("join_code", JOIN_CODE)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await admin
    .from("rooms")
    .insert({
      name: "Demo bib-groep",
      description: "Voorbeeldroom aangemaakt door het seed-script.",
      join_code: JOIN_CODE,
      owner_id: ownerId,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Room aanmaken mislukt");
  return data.id;
}

async function reset(table: string, roomId: string, client: SupabaseClient) {
  await client.from(table).delete().eq("room_id", roomId);
}

async function main() {
  console.log("🌱 Seeding BibSync…");

  const [alice, bob, charlie] = await Promise.all(
    USERS.map((u) => ensureUser(u.email, u.name)),
  );
  console.log("  ✓ 3 gebruikers");

  const roomId = await findOrCreateRoom(alice);
  await admin.from("room_members").upsert(
    [alice, bob, charlie].map((user_id) => ({ room_id: roomId, user_id })),
    { onConflict: "room_id,user_id" },
  );
  console.log("  ✓ room + 3 leden");

  await reset("break_proposals", roomId, admin);
  const { data: proposals } = await admin
    .from("break_proposals")
    .insert([
      {
        room_id: roomId,
        created_by: alice,
        proposal_type: "lunch",
        proposal_date: isoDatePlus(0),
        start_time: "12:30",
        duration_minutes: 45,
        note: "Aan de hoofdingang",
      },
      {
        room_id: roomId,
        created_by: bob,
        proposal_type: "coffee",
        proposal_date: isoDatePlus(0),
        start_time: "15:00",
        duration_minutes: 15,
        note: null,
      },
      {
        room_id: roomId,
        created_by: charlie,
        proposal_type: "dinner",
        proposal_date: isoDatePlus(1),
        start_time: "18:30",
        duration_minutes: 60,
        note: null,
      },
      {
        room_id: roomId,
        created_by: alice,
        proposal_type: "other",
        proposal_date: isoDatePlus(2),
        start_time: "10:00",
        duration_minutes: 30,
        note: "Korte wandeling rond het blok",
      },
    ])
    .select("id");
  console.log("  ✓ 4 voorstellen");

  if (proposals && proposals.length > 0) {
    await admin.from("votes").upsert(
      [
        { proposal_id: proposals[0].id, user_id: alice, vote: "yes" },
        { proposal_id: proposals[0].id, user_id: bob, vote: "yes" },
        { proposal_id: proposals[0].id, user_id: charlie, vote: "maybe" },
        { proposal_id: proposals[1].id, user_id: bob, vote: "yes" },
        { proposal_id: proposals[1].id, user_id: alice, vote: "no" },
      ],
      { onConflict: "proposal_id,user_id" },
    );
    console.log("  ✓ stemmen");
  }

  await admin.from("presence").upsert(
    [
      { room_id: roomId, user_id: alice, status: "studying", back_at: null },
      { room_id: roomId, user_id: bob, status: "break", back_at: "15:15" },
      { room_id: roomId, user_id: charlie, status: "lunch", back_at: "13:00" },
    ],
    { onConflict: "room_id,user_id" },
  );
  console.log("  ✓ presence");

  await reset("messages", roomId, admin);
  await admin.from("messages").insert([
    { room_id: roomId, author_id: alice, content: "Hey allemaal! 👋" },
    { room_id: roomId, author_id: bob, content: "Ik ben er, koffie om 15u?" },
    { room_id: roomId, author_id: charlie, content: "Top, ik join na de lunch." },
  ]);
  console.log("  ✓ berichten");

  console.log(
    `\n✅ Klaar! Log in met ${USERS[0].email} / ${PASSWORD} (of bob/charlie).` +
      `\n   Join code van de demo-room: ${JOIN_CODE}`,
  );
}

main().catch((error) => {
  console.error("Seed mislukt:", error);
  process.exit(1);
});
