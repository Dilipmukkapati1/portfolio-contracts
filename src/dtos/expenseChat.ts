import { z } from "zod";

export const ExpenseChatTimeRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().min(1),
});
export type ExpenseChatTimeRange = z.infer<typeof ExpenseChatTimeRangeSchema>;

export const ExpenseChatHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});
export type ExpenseChatHistoryMessage = z.infer<
  typeof ExpenseChatHistoryMessageSchema
>;

export const ExpenseChatTextBlockSchema = z.object({
  type: z.literal("text"),
  markdown: z.string(),
});
export type ExpenseChatTextBlock = z.infer<typeof ExpenseChatTextBlockSchema>;

export const ExpenseChatTableColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  align: z.enum(["left", "right", "center"]).optional(),
});
export type ExpenseChatTableColumn = z.infer<
  typeof ExpenseChatTableColumnSchema
>;

export const ExpenseChatTableBlockSchema = z.object({
  type: z.literal("table"),
  title: z.string().optional(),
  columns: z.array(ExpenseChatTableColumnSchema).min(1).max(8),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))).max(50),
});
export type ExpenseChatTableBlock = z.infer<typeof ExpenseChatTableBlockSchema>;

export const ExpenseChatChartPointSchema = z.object({
  label: z.string(),
  value: z.number(),
});
export type ExpenseChatChartPoint = z.infer<typeof ExpenseChatChartPointSchema>;

export const ExpenseChatPieChartBlockSchema = z.object({
  type: z.literal("pie_chart"),
  title: z.string().optional(),
  data: z.array(ExpenseChatChartPointSchema).min(1).max(20),
  total: z.number().optional(),
});
export type ExpenseChatPieChartBlock = z.infer<
  typeof ExpenseChatPieChartBlockSchema
>;

export const ExpenseChatBarSeriesSchema = z.object({
  name: z.string(),
  values: z.array(z.number()),
});
export type ExpenseChatBarSeries = z.infer<typeof ExpenseChatBarSeriesSchema>;

export const ExpenseChatBarChartBlockSchema = z.object({
  type: z.literal("bar_chart"),
  title: z.string().optional(),
  labels: z.array(z.string()).min(1).max(90),
  series: z.array(ExpenseChatBarSeriesSchema).min(1).max(4),
});
export type ExpenseChatBarChartBlock = z.infer<
  typeof ExpenseChatBarChartBlockSchema
>;

export const ExpenseChatLineChartBlockSchema = z.object({
  type: z.literal("line_chart"),
  title: z.string().optional(),
  labels: z.array(z.string()).min(1).max(90),
  series: z.array(ExpenseChatBarSeriesSchema).min(1).max(4),
});
export type ExpenseChatLineChartBlock = z.infer<
  typeof ExpenseChatLineChartBlockSchema
>;

export const ExpenseChatBlockSchema = z.discriminatedUnion("type", [
  ExpenseChatTextBlockSchema,
  ExpenseChatTableBlockSchema,
  ExpenseChatPieChartBlockSchema,
  ExpenseChatBarChartBlockSchema,
  ExpenseChatLineChartBlockSchema,
]);
export type ExpenseChatBlock = z.infer<typeof ExpenseChatBlockSchema>;

export const ExpenseChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  blocks: z.array(ExpenseChatBlockSchema).optional(),
  createdAt: z.string(),
});
export type ExpenseChatMessage = z.infer<typeof ExpenseChatMessageSchema>;

export const ExpenseChatRequestSchema = z.object({
  message: z.string().min(1).max(8000),
  timeRange: ExpenseChatTimeRangeSchema.optional(),
  history: z.array(ExpenseChatHistoryMessageSchema).max(20).optional(),
});
export type ExpenseChatRequest = z.infer<typeof ExpenseChatRequestSchema>;

export const ExpenseChatResponseSchema = z.object({
  message: ExpenseChatMessageSchema,
  timeRange: ExpenseChatTimeRangeSchema,
  rangeNotice: z.string().optional(),
});
export type ExpenseChatResponse = z.infer<typeof ExpenseChatResponseSchema>;

export const ExpenseChatModelOutputSchema = z.object({
  timeRange: ExpenseChatTimeRangeSchema.nullable().optional(),
  blocks: z.array(ExpenseChatBlockSchema).min(1).max(8),
});
export type ExpenseChatModelOutput = z.infer<typeof ExpenseChatModelOutputSchema>;
