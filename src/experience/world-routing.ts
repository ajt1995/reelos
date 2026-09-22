import type { ExperienceView } from "./experience-state.ts";

const WORLD_PATHS = {
  home: "/",
  discover: "/discover",
  library: "/library",
  books: "/books",
  taste: "/calibrate",
  companion: "/companion",
  party: "/party",
  devices: "/connect",
  profile: "/profile",
  family: "/family",
  ambiance: "/ambiance",
  settings: "/settings",
} as const satisfies Partial<Record<ExperienceView, string>>;

export type RoutedExperienceView = keyof typeof WORLD_PATHS;

export function pathForWorldView(view: ExperienceView): string | undefined {
  return WORLD_PATHS[view as RoutedExperienceView];
}

export function worldViewForPath(pathname: string): RoutedExperienceView | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (normalized === "/settings/advanced") return "settings";
  if (/^\/(?:title|person|collection)\/[^/]+$/.test(normalized)) return "home";
  return (Object.entries(WORLD_PATHS) as Array<[RoutedExperienceView, string]>)
    .find(([, path]) => path === normalized)?.[0];
}

export function isWorldPath(pathname: string): boolean {
  return worldViewForPath(pathname) !== undefined;
}

export type WorldContentDestination =
  | { type: "title"; id: string }
  | { type: "person"; id: string; name?: string }
  | { type: "collection"; id: string; name?: string; titleIds?: string[] };

export function pathForWorldDestination(destination: WorldContentDestination): string {
  return `/${destination.type}/${encodeURIComponent(destination.id)}`;
}
