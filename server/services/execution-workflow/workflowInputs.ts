/**
 * @file: workflowInputs.ts
 * @description: Временный базовый контракт "missing workflow inputs" (TASK-002).
 *   Содержит только вопросы, не зависящие от анализа сметы (планирование графика).
 *   TASK-005 (missing inputs engine) заменит/расширит это реальным движком, привязанным
 *   к результатам анализа сметы. Non-goal TASK-002: не реализовывать анализ сметы.
 * @dependencies: @shared/schema
 * @created: 2026-08-02
 */

import type { ExecutionWorkflowInput, WorkflowInputSource } from "@shared/schema";

export interface BaseRequiredInputDef {
  key: string;
  type: "date" | "enum";
  question: string;
  options?: string[];
  required: true;
}

export const BASE_REQUIRED_INPUTS: BaseRequiredInputDef[] = [
  {
    key: "projectStartDate",
    type: "date",
    question: "Когда должны начаться работы?",
    required: true,
  },
  {
    key: "workingCalendar",
    type: "enum",
    options: ["5x2", "6x1"],
    question: "Какой рабочий календарь использовать?",
    required: true,
  },
  {
    key: "planningMode",
    type: "enum",
    options: ["target_duration", "crew_size"],
    question: "Что известно точнее: срок выполнения или численность бригады?",
    required: true,
  },
];

export interface MissingInput {
  key: string;
  type: "date" | "enum";
  question: string;
  options?: string[];
  required: true;
}

/**
 * An input is considered satisfied only once explicitly confirmed — a stored but
 * unconfirmed value (e.g. a system default) is still reported as missing, per
 * 00-mvp-scenario.md §"Правила": "системные defaults должны быть явно показаны и подтверждены".
 */
export function computeMissingInputs(existing: ExecutionWorkflowInput[]): MissingInput[] {
  const confirmedKeys = new Set(existing.filter((i) => i.confirmed).map((i) => i.key));
  return BASE_REQUIRED_INPUTS.filter((def) => !confirmedKeys.has(def.key)).map((def) => ({ ...def }));
}

export const VALID_INPUT_SOURCES: readonly WorkflowInputSource[] = [
  "user",
  "estimate",
  "system_default",
  "calculated",
] as const;
