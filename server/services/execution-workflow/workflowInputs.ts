/**
 * Deterministic catalog, validation and dependency rules for schedule inputs.
 * The agent presents returned questions; it does not invent defaults or rules.
 */

import { createHash } from "node:crypto";
import { z } from "zod";

import type { ExecutionWorkflowInput, WorkflowInputSource } from "@shared/schema";
import { MCP_ERROR_CODES, McpToolError } from "../../mcp/errors";

export const WORKFLOW_INPUT_KEYS = [
  "projectStartDate",
  "workingCalendar",
  "planningMode",
  "targetDurationDays",
  "crewSize",
  "shiftHours",
  "utilizationFactor",
] as const;

export type WorkflowInputKey = (typeof WORKFLOW_INPUT_KEYS)[number];
export type WorkflowInputValue = string | number;
export type WorkflowQuestionType = "date" | "single_select" | "number";

export interface WorkflowInputValidation {
  required: true;
  format?: "YYYY-MM-DD";
  allowedValues?: readonly string[];
  min?: number;
  max?: number;
  exclusiveMin?: boolean;
  integer?: boolean;
}

export interface WorkflowInputDefinition {
  key: WorkflowInputKey;
  type: WorkflowQuestionType;
  question: string;
  reason: string;
  required: true;
  options?: readonly string[];
  validation: WorkflowInputValidation;
  defaultValue?: WorkflowInputValue;
  schema: z.ZodType<WorkflowInputValue>;
}

const strictIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date in YYYY-MM-DD format").refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Expected a real calendar date");

const positiveInteger = z.number().int().positive();

export const WORKFLOW_INPUT_DEFINITIONS: Readonly<Record<WorkflowInputKey, WorkflowInputDefinition>> = {
  projectStartDate: {
    key: "projectStartDate",
    type: "date",
    question: "Когда должны начаться работы?",
    reason: "Дата начала нужна для расчёта календарных дат графика.",
    required: true,
    validation: { required: true, format: "YYYY-MM-DD" },
    schema: strictIsoDate,
  },
  workingCalendar: {
    key: "workingCalendar",
    type: "single_select",
    question: "Какой рабочий календарь использовать?",
    reason: "Календарь определяет, какие дни считаются рабочими.",
    required: true,
    options: ["5x2", "6x1"],
    validation: { required: true, allowedValues: ["5x2", "6x1"] },
    schema: z.enum(["5x2", "6x1"]),
  },
  planningMode: {
    key: "planningMode",
    type: "single_select",
    question: "Что известно точнее: срок выполнения или численность бригады?",
    reason: "Режим определяет формулу расчёта продолжительности работ.",
    required: true,
    options: ["target_duration", "crew_size"],
    validation: { required: true, allowedValues: ["target_duration", "crew_size"] },
    schema: z.enum(["target_duration", "crew_size"]),
  },
  targetDurationDays: {
    key: "targetDurationDays",
    type: "number",
    question: "За сколько рабочих дней нужно выполнить работы?",
    reason: "Целевой срок нужен для распределения длительности между работами.",
    required: true,
    validation: { required: true, min: 1, integer: true },
    schema: positiveInteger,
  },
  crewSize: {
    key: "crewSize",
    type: "number",
    question: "Сколько человек в бригаде?",
    reason: "Численность нужна для расчёта срока по трудоёмкости.",
    required: true,
    validation: { required: true, min: 1, integer: true },
    schema: positiveInteger,
  },
  shiftHours: {
    key: "shiftHours",
    type: "number",
    question: "Подтвердите продолжительность смены в часах.",
    reason: "Продолжительность смены входит в формулу производительности бригады.",
    required: true,
    defaultValue: 8,
    validation: { required: true, min: 0, exclusiveMin: true, max: 24 },
    schema: z.number().positive().max(24),
  },
  utilizationFactor: {
    key: "utilizationFactor",
    type: "number",
    question: "Подтвердите коэффициент использования рабочего времени.",
    reason: "Коэффициент учитывает неполное использование доступных часов смены.",
    required: true,
    defaultValue: 0.85,
    validation: { required: true, min: 0, exclusiveMin: true, max: 1 },
    schema: z.number().positive().max(1),
  },
};

export type MissingInput = Omit<WorkflowInputDefinition, "schema">;

export interface MissingInputsContext {
  analysisInputHash?: string;
  laborHoursAvailable?: boolean;
  analysisAvailable?: boolean;
}

export interface WorkflowBlockingIssue {
  code: "LABOR_DATA_REQUIRED";
  blocking: true;
  reason: string;
  suggestedInput: { key: "planningMode"; value: "target_duration" };
}

export interface MissingInputsEvaluation {
  questions: MissingInput[];
  blockingIssues: WorkflowBlockingIssue[];
  ready: boolean;
  scheduleInputHash: string;
}

type WorkflowInputLike = Pick<ExecutionWorkflowInput, "key" | "valueJson" | "confirmed">;

function definitionQuestion(key: WorkflowInputKey): MissingInput {
  const { schema: _schema, ...question } = WORKFLOW_INPUT_DEFINITIONS[key];
  return question;
}

function parseKnownInput(key: string, value: unknown): { key: WorkflowInputKey; value: WorkflowInputValue } | null {
  if (!WORKFLOW_INPUT_KEYS.includes(key as WorkflowInputKey)) return null;
  const typedKey = key as WorkflowInputKey;
  const parsed = WORKFLOW_INPUT_DEFINITIONS[typedKey].schema.safeParse(value);
  return parsed.success ? { key: typedKey, value: parsed.data } : null;
}

/** Validate at the service trust boundary and return the canonical value. */
export function validateAndNormalizeWorkflowInput(
  key: string,
  value: unknown,
): { key: WorkflowInputKey; value: WorkflowInputValue } {
  if (!WORKFLOW_INPUT_KEYS.includes(key as WorkflowInputKey)) {
    throw new McpToolError(MCP_ERROR_CODES.VALIDATION_ERROR, `Unknown workflow input key "${key}"`);
  }

  const typedKey = key as WorkflowInputKey;
  const parsed = WORKFLOW_INPUT_DEFINITIONS[typedKey].schema.safeParse(value);
  if (!parsed.success) {
    throw new McpToolError(
      MCP_ERROR_CODES.VALIDATION_ERROR,
      `Invalid value for workflow input "${key}": ${parsed.error.issues[0]?.message ?? "validation failed"}`,
    );
  }
  return { key: typedKey, value: parsed.data };
}

function confirmedValues(inputs: WorkflowInputLike[]): Map<WorkflowInputKey, WorkflowInputValue> {
  const result = new Map<WorkflowInputKey, WorkflowInputValue>();
  for (const input of inputs) {
    if (!input.confirmed) continue;
    const parsed = parseKnownInput(input.key, input.valueJson);
    if (parsed) result.set(parsed.key, parsed.value);
  }
  return result;
}

const COMMON_KEYS: readonly WorkflowInputKey[] = ["projectStartDate", "workingCalendar", "planningMode"];
const CREW_KEYS: readonly WorkflowInputKey[] = ["crewSize", "shiftHours", "utilizationFactor"];
const RULES_VERSION = 1;

export function evaluateMissingWorkflowInputs(
  inputs: WorkflowInputLike[],
  context: MissingInputsContext = {},
): MissingInputsEvaluation {
  const values = confirmedValues(inputs);
  const requiredKeys: WorkflowInputKey[] = [...COMMON_KEYS];
  const blockingIssues: WorkflowBlockingIssue[] = [];
  const planningMode = values.get("planningMode");
  const analysisKnown = context.analysisAvailable ?? context.laborHoursAvailable !== undefined;

  if (planningMode === "target_duration") {
    requiredKeys.push("targetDurationDays");
  } else if (planningMode === "crew_size" && analysisKnown) {
    if (context.laborHoursAvailable) {
      requiredKeys.push(...CREW_KEYS);
    } else {
      blockingIssues.push({
        code: "LABOR_DATA_REQUIRED",
        blocking: true,
        reason: "В смете нет пригодной трудоёмкости для расчёта по численности бригады.",
        suggestedInput: { key: "planningMode", value: "target_duration" },
      });
    }
  }

  const questions = requiredKeys.filter((key) => !values.has(key)).map(definitionQuestion);
  const relevantValues = Object.fromEntries(
    requiredKeys.filter((key) => values.has(key)).sort().map((key) => [key, values.get(key)]),
  );
  const scheduleInputHash = createHash("sha256").update(JSON.stringify({
    schemaVersion: 1,
    rulesVersion: RULES_VERSION,
    analysisInputHash: context.analysisInputHash ?? null,
    inputs: relevantValues,
  })).digest("hex");

  return {
    questions,
    blockingIssues,
    ready: questions.length === 0 && blockingIssues.length === 0 && context.analysisAvailable === true,
    scheduleInputHash,
  };
}

/** TASK-002 compatibility for existing callers; TASK-005 callers use the full evaluation. */
export function computeMissingInputs(existing: WorkflowInputLike[]): MissingInput[] {
  return evaluateMissingWorkflowInputs(existing).questions;
}

export const BASE_REQUIRED_INPUTS: MissingInput[] = COMMON_KEYS.map(definitionQuestion);

export const VALID_INPUT_SOURCES: readonly WorkflowInputSource[] = [
  "user",
  "estimate",
  "system_default",
  "calculated",
] as const;
