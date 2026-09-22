import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dev")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/advanced", replace: true });
  },
});
