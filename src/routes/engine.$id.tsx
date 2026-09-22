import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/engine/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/advanced", replace: true });
  },
});
