import { createFileRoute } from "@tanstack/react-router";
import { FamilyApp } from "@/components/family/FamilyApp";
import { loadTree } from "@/lib/tree/api";

export const Route = createFileRoute("/")({
  loader: () => loadTree(),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <FamilyApp initial={initial} />;
}
