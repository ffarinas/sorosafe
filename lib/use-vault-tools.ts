"use client";
import { useEffect, useRef } from "react";
import type { State } from "./domain";
type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean };
  execute: (input: Record<string, unknown>) => Promise<string>;
};
type ModelContext = {
  registerTool: (tool: Tool, options: { signal: AbortSignal }) => Promise<void>;
};
export function useVaultTools(data: State, selectTab: (tab: string) => void) {
  const current = useRef(data);
  useEffect(() => {
    current.current = data;
  }, [data]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context) return;
    const controller = new AbortController();
    const register = async () => {
      await context.registerTool(
        {
          name: "get_vault_summary",
          description:
            "Read the currently visible vault name, approval rule, member count, and pending payment count. No keys or signatures are exposed.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: async () => {
            const d = current.current;
            return JSON.stringify(
              d.vault
                ? {
                    name: d.vault.name,
                    status: d.vault.status,
                    requiredApprovals: d.vault.threshold,
                    members: d.people.length,
                    pendingPayments: d.payments.filter((p) =>
                      ["pending", "submitting"].includes(p.status),
                    ).length,
                  }
                : { vault: null },
            );
          },
        },
        { signal: controller.signal },
      );
      await context.registerTool(
        {
          name: "open_vault_view",
          description:
            "Navigate the current vault to overview, payments, contacts, or team. This does not create, approve, sign, or send anything.",
          inputSchema: {
            type: "object",
            properties: {
              view: {
                type: "string",
                enum: ["overview", "payments", "contacts", "team"],
              },
            },
            required: ["view"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: async ({ view }) => {
            if (!current.current.vault) throw new Error("No vault is open");
            if (
              typeof view !== "string" ||
              !["overview", "payments", "contacts", "team"].includes(view)
            )
              throw new Error("Unknown view");
            selectTab(view);
            return `Opened ${view}`;
          },
        },
        { signal: controller.signal },
      );
    };
    void register().catch(() => {});
    return () => controller.abort();
  }, [selectTab]);
}
