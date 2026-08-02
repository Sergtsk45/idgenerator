export const CREW_LABOR_COVERAGE_THRESHOLD_PERCENT = 100;
export const SCHEDULE_PLANNER_VERSION = "1";
export const SCHEDULE_DRAFT_SCHEMA_VERSION = 1;

export type WorkingCalendar = "5x2" | "6x1";
export type PlanningMode = "target_duration" | "crew_size";
export type PlanningConfidence = "high" | "medium" | "low";
export type ScheduleWeightSource = "labor_hours" | "labor_machine_cost" | "quantity" | "equal";

export interface PlanningMainWork {
  positionId: number;
  name: string;
  laborHours: number;
  laborMachineCost?: number | null;
  quantity?: number | null;
}

export interface PlanScheduleInput {
  projectStartDate: string;
  workingCalendar: WorkingCalendar;
  planningMode: PlanningMode;
  mainWorks: PlanningMainWork[];
  laborCoveragePercent: number;
  targetDurationDays?: number;
  crewSize?: number;
  shiftHours?: number;
  utilizationFactor?: number;
}

export interface SchedulePlanningWarning {
  code:
    | "START_DATE_ADJUSTED"
    | "TARGET_DURATION_BELOW_MINIMUM"
    | "WEIGHT_FALLBACK_LABOR_MACHINE_COST"
    | "WEIGHT_FALLBACK_QUANTITY"
    | "WEIGHT_FALLBACK_EQUAL";
  message: string;
  positionIds: number[];
}

export interface SchedulePlanningAssumption {
  code: "SEQUENTIAL_EXECUTION" | "WORKING_CALENDAR" | "MINIMUM_TASK_DURATION" | "PROPORTIONAL_WEIGHTS" | "CREW_PRODUCTIVITY";
  message: string;
}

export interface PlannedScheduleTask {
  estimatePositionId: number;
  name: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  orderIndex: number;
  weightSource: ScheduleWeightSource;
  confidence: PlanningConfidence;
}

export interface PlannedSchedule {
  calendarStart: string;
  calendarEnd: string;
  totalWorkingDays: number;
  confidence: PlanningConfidence;
  tasks: PlannedScheduleTask[];
  assumptions: SchedulePlanningAssumption[];
  warnings: SchedulePlanningWarning[];
}

export type SchedulePlanningErrorCode = "SCHEDULE_INPUTS_INCOMPLETE" | "LABOR_DATA_REQUIRED";

export class SchedulePlanningError extends Error {
  constructor(readonly code: SchedulePlanningErrorCode, message: string) {
    super(message);
    this.name = "SchedulePlanningError";
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string): Date {
  if (!ISO_DATE.test(value)) throw new SchedulePlanningError("SCHEDULE_INPUTS_INCOMPLETE", "Invalid project start date");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new SchedulePlanningError("SCHEDULE_INPUTS_INCOMPLETE", "Invalid project start date");
  }
  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addCalendarDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

export function isWorkingDay(date: string, calendar: WorkingCalendar): boolean {
  const day = parseIsoDate(date).getUTCDay();
  return calendar === "5x2" ? day !== 0 && day !== 6 : day !== 0;
}

export function nextWorkingDay(date: string, calendar: WorkingCalendar, includeCurrent = false): string {
  let current = includeCurrent ? parseIsoDate(date) : addCalendarDay(parseIsoDate(date));
  while (!isWorkingDay(toIsoDate(current), calendar)) current = addCalendarDay(current);
  return toIsoDate(current);
}

/** Inclusive end date for a positive number of working days. */
export function addWorkingDays(date: string, durationDays: number, calendar: WorkingCalendar): string {
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new SchedulePlanningError("SCHEDULE_INPUTS_INCOMPLETE", "Task duration must be a positive integer");
  }
  let current = nextWorkingDay(date, calendar, true);
  for (let elapsed = 1; elapsed < durationDays; elapsed++) current = nextWorkingDay(current, calendar);
  return current;
}

function positive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function assertPositiveInteger(value: number | undefined, name: string): asserts value is number {
  if (!Number.isInteger(value) || (value ?? 0) < 1) {
    throw new SchedulePlanningError("SCHEDULE_INPUTS_INCOMPLETE", `${name} must be a positive integer`);
  }
}

function weightFor(work: PlanningMainWork): { value: number; source: ScheduleWeightSource; confidence: PlanningConfidence } {
  if (positive(work.laborHours)) return { value: work.laborHours, source: "labor_hours", confidence: "high" };
  if (positive(work.laborMachineCost)) return { value: work.laborMachineCost, source: "labor_machine_cost", confidence: "medium" };
  if (positive(work.quantity)) return { value: work.quantity, source: "quantity", confidence: "low" };
  return { value: 1, source: "equal", confidence: "low" };
}

function allocateTargetDuration(targetDays: number, weights: number[]): number[] {
  const minimumTotal = weights.length;
  if (targetDays <= minimumTotal) return weights.map(() => 1);

  const remaining = targetDays - minimumTotal;
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const quotas = weights.map((weight) => remaining * weight / weightTotal);
  const additions = quotas.map(Math.floor);
  let unallocated = remaining - additions.reduce((sum, value) => sum + value, 0);
  const largestRemainders = quotas
    .map((quota, index) => ({ index, remainder: quota - additions[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let index = 0; index < unallocated; index++) additions[largestRemainders[index].index]++;
  return additions.map((addition) => addition + 1);
}

function confidenceRank(confidence: PlanningConfidence): number {
  return confidence === "high" ? 2 : confidence === "medium" ? 1 : 0;
}

function overallConfidence(values: PlanningConfidence[]): PlanningConfidence {
  return values.reduce((lowest, value) => confidenceRank(value) < confidenceRank(lowest) ? value : lowest, "high");
}

function fallbackWarnings(
  works: PlanningMainWork[],
  sources: ScheduleWeightSource[],
): SchedulePlanningWarning[] {
  const definitions: Array<[ScheduleWeightSource, SchedulePlanningWarning["code"], string]> = [
    ["labor_machine_cost", "WEIGHT_FALLBACK_LABOR_MACHINE_COST", "Labor hours were unavailable; labor and machine cost was used as the task weight"],
    ["quantity", "WEIGHT_FALLBACK_QUANTITY", "Labor hours and cost were unavailable; quantity was used as the task weight"],
    ["equal", "WEIGHT_FALLBACK_EQUAL", "No suitable labor, cost or quantity value was available; equal task weight was used"],
  ];
  return definitions.flatMap(([source, code, message]) => {
    const positionIds = works.filter((_, index) => sources[index] === source).map((work) => work.positionId);
    return positionIds.length ? [{ code, message, positionIds }] : [];
  });
}

/** Pure deterministic linear schedule planner. */
export function planSchedule(input: PlanScheduleInput): PlannedSchedule {
  parseIsoDate(input.projectStartDate);
  if (input.workingCalendar !== "5x2" && input.workingCalendar !== "6x1") {
    throw new SchedulePlanningError("SCHEDULE_INPUTS_INCOMPLETE", "Unsupported working calendar");
  }
  if (input.mainWorks.length === 0) {
    throw new SchedulePlanningError("SCHEDULE_INPUTS_INCOMPLETE", "Estimate has no main works to schedule");
  }

  const selectedWeights = input.mainWorks.map(weightFor);
  let durations: number[];
  let confidence: PlanningConfidence[];
  const warnings: SchedulePlanningWarning[] = [];
  const assumptions: SchedulePlanningAssumption[] = [
    { code: "SEQUENTIAL_EXECUTION", message: "Main works are scheduled sequentially in estimate order" },
    { code: "WORKING_CALENDAR", message: `The ${input.workingCalendar} working calendar is used` },
    { code: "MINIMUM_TASK_DURATION", message: "Every main work takes at least one working day" },
  ];

  if (input.planningMode === "target_duration") {
    assertPositiveInteger(input.targetDurationDays, "targetDurationDays");
    durations = allocateTargetDuration(input.targetDurationDays, selectedWeights.map((weight) => weight.value));
    confidence = selectedWeights.map((weight) => weight.confidence);
    warnings.push(...fallbackWarnings(input.mainWorks, selectedWeights.map((weight) => weight.source)));
    assumptions.push({
      code: "PROPORTIONAL_WEIGHTS",
      message: "Target duration is allocated by labor hours, then labor/machine cost, quantity, or equal fallback weight",
    });
    if (input.targetDurationDays < input.mainWorks.length) {
      warnings.unshift({
        code: "TARGET_DURATION_BELOW_MINIMUM",
        message: `Target duration ${input.targetDurationDays} is below the ${input.mainWorks.length}-day minimum; minimum durations were used`,
        positionIds: input.mainWorks.map((work) => work.positionId),
      });
    }
  } else if (input.planningMode === "crew_size") {
    assertPositiveInteger(input.crewSize, "crewSize");
    if (!positive(input.shiftHours) || input.shiftHours > 24 || !positive(input.utilizationFactor) || input.utilizationFactor > 1) {
      throw new SchedulePlanningError("SCHEDULE_INPUTS_INCOMPLETE", "Invalid crew productivity inputs");
    }
    if (input.laborCoveragePercent < CREW_LABOR_COVERAGE_THRESHOLD_PERCENT || input.mainWorks.some((work) => !positive(work.laborHours))) {
      throw new SchedulePlanningError(
        "LABOR_DATA_REQUIRED",
        `Crew-size planning requires ${CREW_LABOR_COVERAGE_THRESHOLD_PERCENT}% labor coverage`,
      );
    }
    const dailyCapacity = input.crewSize * input.shiftHours * input.utilizationFactor;
    durations = input.mainWorks.map((work) => Math.max(1, Math.ceil(work.laborHours / dailyCapacity)));
    confidence = input.mainWorks.map(() => "high");
    assumptions.push({
      code: "CREW_PRODUCTIVITY",
      message: `One crew of ${input.crewSize} works ${input.shiftHours} hours per shift at utilization ${input.utilizationFactor}`,
    });
  } else {
    throw new SchedulePlanningError("SCHEDULE_INPUTS_INCOMPLETE", "Unsupported planning mode");
  }

  const calendarStart = nextWorkingDay(input.projectStartDate, input.workingCalendar, true);
  if (calendarStart !== input.projectStartDate) {
    warnings.unshift({
      code: "START_DATE_ADJUSTED",
      message: `Project start was moved from ${input.projectStartDate} to the next working day ${calendarStart}`,
      positionIds: [],
    });
  }

  let nextStart = calendarStart;
  const tasks = input.mainWorks.map((work, index): PlannedScheduleTask => {
    const startDate = nextStart;
    const endDate = addWorkingDays(startDate, durations[index], input.workingCalendar);
    nextStart = nextWorkingDay(endDate, input.workingCalendar);
    return {
      estimatePositionId: work.positionId,
      name: work.name,
      startDate,
      endDate,
      durationDays: durations[index],
      orderIndex: index,
      weightSource: input.planningMode === "crew_size" ? "labor_hours" : selectedWeights[index].source,
      confidence: confidence[index],
    };
  });

  return {
    calendarStart,
    calendarEnd: tasks[tasks.length - 1].endDate,
    totalWorkingDays: durations.reduce((sum, duration) => sum + duration, 0),
    confidence: overallConfidence(confidence),
    tasks,
    assumptions,
    warnings,
  };
}
