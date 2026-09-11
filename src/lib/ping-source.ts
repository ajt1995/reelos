import { createServerFn } from "@tanstack/react-start";
import type { SourceId } from "./types";
import { pingWizardSource } from "./wizard-honesty";

export type PingResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export const pingSource = createServerFn({ method: "POST" })
  .validator((data: { source: SourceId; key: string }) => data)
  .handler(async ({ data }): Promise<PingResult> => {
    const result = await pingWizardSource(data.source, data.key);
    if (result.ok) return { ok: true, message: result.message };
    return { ok: false, error: result.error };
  });
