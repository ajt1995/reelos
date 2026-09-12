import { createFileRoute } from "@tanstack/react-router";
import { DiscoverView } from "@/components/discover-view";

export const Route = createFileRoute("/discover/")({ component: DiscoverView });
