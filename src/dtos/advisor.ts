import { z } from "zod";

export const AdvisorPageDefinitionSchema = z.object({
  route: z.string(),
  label: z.string(),
  pageDescription: z.string(),
  scopeTopics: z.array(z.string()),
  outOfScopeHint: z.string(),
  defaultStarterPrompts: z.array(z.string()),
  snapshotFields: z.array(z.string()),
});
export type AdvisorPageDefinition = z.infer<typeof AdvisorPageDefinitionSchema>;

export const AdvisorPageContextSchema = z.object({
  sourceRoute: z.string(),
  sourceLabel: z.string(),
  pageDescription: z.string(),
  scopeTopics: z.array(z.string()),
  outOfScopeHint: z.string(),
  pageSnapshot: z.record(z.string(), z.unknown()).default({}),
  snapshotCapturedAt: z.string(),
  starterPrompts: z.array(z.string()).optional(),
});
export type AdvisorPageContext = z.infer<typeof AdvisorPageContextSchema>;

export const AdvisorMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  createdAt: z.string(),
});
export type AdvisorMessage = z.infer<typeof AdvisorMessageSchema>;

export const AdvisorConversationSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  title: z.string(),
  taxYear: z.number().int(),
  pageContext: AdvisorPageContextSchema.optional(),
  messages: z.array(AdvisorMessageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdvisorConversation = z.infer<typeof AdvisorConversationSchema>;

export const AdvisorConversationSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  sourceRoute: z.string().optional(),
  sourceLabel: z.string().optional(),
  messageCount: z.number().int(),
  updatedAt: z.string(),
});
export type AdvisorConversationSummary = z.infer<typeof AdvisorConversationSummarySchema>;

export const AdvisorChatRequestSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(8000),
  pageContext: AdvisorPageContextSchema.optional(),
});
export type AdvisorChatRequest = z.infer<typeof AdvisorChatRequestSchema>;

export const AdvisorChatResponseSchema = z.object({
  conversationId: z.string(),
  message: AdvisorMessageSchema,
  disclaimer: z.string(),
});
export type AdvisorChatResponse = z.infer<typeof AdvisorChatResponseSchema>;

export const ADVISOR_PAGE_DEFINITIONS: Record<string, AdvisorPageDefinition> = {
  "/tax": {
    route: "/tax",
    label: "Tax",
    pageDescription:
      "Federal tax estimate, paid vs deferred tax outlook, strategy checklist, contribution room, and tax plan recommendations for the household.",
    scopeTopics: ["federal_tax", "deferral", "withholding", "strategies", "contribution_room"],
    outOfScopeHint:
      "For portfolio allocation and fund selection, open Financial Plan. For budgeting, open Expense Planner.",
    defaultStarterPrompts: [
      "What's the fastest way to cut my federal tax?",
      "How much 401(k) room do I have left?",
      "Should I max my HSA this year?",
    ],
    snapshotFields: [
      "tab",
      "taxView",
      "earnerScope",
      "taxYear",
      "onTrackPct",
      "openStrategies",
      "contributionRoom",
    ],
  },
  "/household": {
    route: "/household",
    label: "Household",
    pageDescription:
      "Household member setup including income sources, pre-tax contributions, filing status, dependents, and persona configuration.",
    scopeTopics: ["members", "income", "contributions", "filing_status", "dependents"],
    outOfScopeHint:
      "For tax estimates and strategies, open the Tax page. For account balances, open Accounts or Holdings.",
    defaultStarterPrompts: [
      "Are my income entries complete for tax estimation?",
      "How should I split contributions between spouses?",
      "What setup gaps remain?",
    ],
    snapshotFields: ["persona", "filingStatus", "dependents", "members", "setupGaps"],
  },
  "/financial-plan": {
    route: "/financial-plan",
    label: "Financial Plan",
    pageDescription:
      "Target vs actual investment allocation, drift analysis, execution outlook, and uninvested cash positioning.",
    scopeTopics: ["allocation", "rebalancing", "asset_location", "execution"],
    outOfScopeHint:
      "For federal tax estimates and deferral strategies, open the Tax page.",
    defaultStarterPrompts: [
      "How far am I from my target allocation?",
      "Where should I place bonds for tax efficiency?",
      "What should I buy with uninvested cash?",
    ],
    snapshotFields: ["driftPct", "uninvestedCash", "topDrifts", "targetAllocation"],
  },
  "/expense-planner": {
    route: "/expense-planner",
    label: "Expense Planner",
    pageDescription:
      "Monthly budget vs actual spend by category, merchant mapping rules, and spending optimization.",
    scopeTopics: ["budgeting", "spend_optimization", "categories"],
    outOfScopeHint:
      "For tax reduction and deferral strategies, open the Tax page.",
    defaultStarterPrompts: [
      "Which categories am I over budget on?",
      "How can I reduce discretionary spend?",
      "What's my monthly burn rate?",
    ],
    snapshotFields: ["overBudgetCategories", "monthlyTotal", "activeTab"],
  },
  "/": {
    route: "/",
    label: "Dashboard",
    pageDescription:
      "Net worth overview, financial independence freedom score, and high-level portfolio allocation summary.",
    scopeTopics: ["net_worth", "fi_planning", "high_level_allocation"],
    outOfScopeHint:
      "For detailed tax strategies, open the Tax page. For holdings detail, open Holdings.",
    defaultStarterPrompts: [
      "How is my freedom score calculated?",
      "What's driving my net worth change?",
      "Am I on track for financial independence?",
    ],
    snapshotFields: ["freedomScore", "netWorth", "topAllocationBuckets"],
  },
  "/holdings": {
    route: "/holdings",
    label: "Holdings",
    pageDescription:
      "Portfolio positions with cost basis, unrealized gains and losses, and tax-loss harvesting candidates.",
    scopeTopics: ["holdings", "cost_basis", "tax_loss_harvest", "capital_gains"],
    outOfScopeHint:
      "For 401(k) and HSA deferral strategies, open the Tax page. For target allocation, open Financial Plan.",
    defaultStarterPrompts: [
      "Which positions should I harvest for tax losses?",
      "What's my total unrealized gain?",
      "Explain wash-sale rules for my holdings",
    ],
    snapshotFields: ["topHoldings", "unrealizedGainLoss", "filters"],
  },
  "/accounts": {
    route: "/accounts",
    label: "Accounts",
    pageDescription:
      "Linked accounts grouped by tax treatment including taxable brokerage, retirement, HSA, and cash accounts.",
    scopeTopics: ["account_types", "cash_positions", "tax_treatment"],
    outOfScopeHint:
      "For tax estimates and deferral planning, open the Tax page.",
    defaultStarterPrompts: [
      "Which accounts are tax-advantaged?",
      "How much uninvested cash do I have?",
      "Where should I hold bonds vs stocks?",
    ],
    snapshotFields: ["accountsByTreatment", "totalCash"],
  },
  "/advisor": {
    route: "/advisor",
    label: "Tax Advisor",
    pageDescription:
      "General tax and financial planning advisor with access to full household context across all areas.",
    scopeTopics: ["tax_planning", "financial_planning", "deferral", "allocation", "budgeting"],
    outOfScopeHint:
      "I focus on personal finance and tax planning topics related to your portfolio data.",
    defaultStarterPrompts: [
      "What's my biggest tax-saving opportunity?",
      "Help me prioritize deferral vs reduction strategies",
      "Review my overall financial plan",
    ],
    snapshotFields: [],
  },
};

export function getAdvisorPageDefinition(route: string): AdvisorPageDefinition {
  return ADVISOR_PAGE_DEFINITIONS[route] ?? ADVISOR_PAGE_DEFINITIONS["/advisor"]!;
}

export function composeAdvisorPageContext(
  route: string,
  snapshot: Record<string, unknown> = {},
  options?: { starterPrompts?: string[]; sourceLabelSuffix?: string }
): AdvisorPageContext {
  const def = getAdvisorPageDefinition(route);
  const sourceLabel = options?.sourceLabelSuffix
    ? `${def.label} · ${options.sourceLabelSuffix}`
    : def.label;
  return {
    sourceRoute: def.route,
    sourceLabel,
    pageDescription: def.pageDescription,
    scopeTopics: def.scopeTopics,
    outOfScopeHint: def.outOfScopeHint,
    pageSnapshot: snapshot,
    snapshotCapturedAt: new Date().toISOString(),
    starterPrompts: options?.starterPrompts ?? def.defaultStarterPrompts,
  };
}
