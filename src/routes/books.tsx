import { createFileRoute } from "@tanstack/react-router";
import { ReelOSWorld } from "@/experience/reelos-world";

export const Route = createFileRoute("/books")({ component: Page });

function Page() {
  return <ReelOSWorld initialView="books" />;
}
