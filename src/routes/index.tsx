import { createFileRoute } from "@tanstack/react-router";
import { FamilyApp } from "@/components/family/FamilyApp";
import { loadTree } from "@/lib/tree/api";
import { createSeed } from "@/lib/tree/seed";

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      return await loadTree();
    } catch {
      return createSeed();
    }
  },
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <FamilyApp initial={initial} />;
}
