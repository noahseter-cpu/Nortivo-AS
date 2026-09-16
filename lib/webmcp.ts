import { dateSchema, dailyCalories, goalAt, type State } from "./tracker-core";
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
export function registerTrackerTools(getState: () => State) {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool: (
          tool: Tool,
          options: { signal: AbortSignal },
        ) => void | Promise<void>;
      };
    }
  ).modelContext;
  const lifecycle = new AbortController();
  if (context?.registerTool) {
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "read_tracker_day",
            description:
              "Read this browser's locally recorded steps, calorie total and entry counts for a selected calendar date. Does not change records or contact providers.",
            inputSchema: {
              type: "object",
              properties: { date: { type: "string", format: "date" } },
              required: ["date"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input) {
              if (!input || typeof input !== "object" || !("date" in input))
                throw Error("Dato mangler.");
              const date = dateSchema.parse(input.date);
              const s = getState();
              const a = s.activity.find((x) => x.date === date);
              return {
                date,
                steps: a?.steps ?? null,
                calories: dailyCalories(s, date),
                goals: goalAt(s, date) ?? null,
                transactionCount: s.transactions.filter((x) => x.date === date)
                  .length,
                foodEntryCount: s.logs.filter((x) => x.date === date).length,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional browser capability. */
    }
  }
  return () => lifecycle.abort();
}
