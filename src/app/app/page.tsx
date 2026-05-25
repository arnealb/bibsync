import { getAuthContext } from "@/lib/auth";
import { copy } from "@/lib/copy";

export default async function AppHomePage() {
  const ctx = await getAuthContext();
  const name = ctx?.profile?.display_name ?? "student";

  return (
    <div className="mx-auto max-w-5xl space-y-3 px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">
        {copy.appHome.welcome(name)}
      </h1>
      <p className="text-muted-foreground">{copy.appHome.placeholder}</p>
    </div>
  );
}
