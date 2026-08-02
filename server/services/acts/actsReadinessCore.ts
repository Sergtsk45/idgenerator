export const ACT_READINESS_ISSUE_CODES = [
  "ACT_NUMBER_MISSING",
  "ACT_TEMPLATE_MISSING",
  "ACT_TEMPLATE_CONFLICT",
  "ACT_DATE_INVALID",
  "ACT_WORK_MISSING",
  "ACT_MATERIAL_MISSING",
  "QUALITY_DOCUMENT_MISSING",
  "PROJECT_DOCUMENTATION_MISSING",
  "NORMATIVE_REFERENCE_MISSING",
  "EXECUTIVE_SCHEME_MISSING",
  "SOURCE_DATA_MISSING",
  "MATERIAL_CLASSIFICATION_REQUIRED",
] as const;

export type ActReadinessIssueCode = (typeof ACT_READINESS_ISSUE_CODES)[number];

export const REQUIRED_ACT_SOURCE_FIELDS = [
  "object.title",
  "object.address",
  "object.city",
  "parties.customer.fullName",
  "parties.builder.fullName",
  "parties.designer.fullName",
  "persons.rep_customer_control.personName",
  "persons.rep_builder.personName",
  "persons.rep_builder_control.personName",
  "persons.rep_designer.personName",
  "persons.rep_work_performer.personName",
] as const;

export type RequiredActSourceField = (typeof REQUIRED_ACT_SOURCE_FIELDS)[number];
export type ActReadinessEntityType =
  | "schedule"
  | "schedule_task"
  | "act_group"
  | "project_material"
  | "material_register_item"
  | "object";

export interface ActReadinessIssue {
  code: ActReadinessIssueCode;
  entityType: ActReadinessEntityType;
  entityId: number;
  reason: string;
  question: string;
  details?: Record<string, unknown>;
}

export interface ActReadinessTaskInput {
  id: number;
  actNumber: number | null;
  actTemplateId: number | null;
  startDate: string;
  durationDays: number;
  workId: number | null;
  estimatePositionId: number | null;
  projectDrawings: string | null;
  normativeRefs: string | null;
  executiveSchemes: ReadonlyArray<{ title: string }> | null;
  hasMaterials: boolean;
}

export interface MissingQualityRequirementInput {
  projectMaterialId: number;
  ruleId: string;
  reason: string;
  acceptableDocTypes: readonly string[];
  usedInTaskIds: readonly number[];
}

export interface ActsReadinessInput {
  scheduleId: number;
  tasks: readonly ActReadinessTaskInput[];
  missingQualityRequirements: readonly MissingQualityRequirementInput[];
  materialClassificationIssues: ReadonlyArray<{ registerItemId: number; reason: string }>;
  sourceData: {
    objectId: number;
    fields: Partial<Record<RequiredActSourceField, boolean>>;
  };
}

export interface ActReadinessGroup {
  actNumber: number;
  taskIds: number[];
  ready: boolean;
  blockingIssues: ActReadinessIssue[];
}

export interface ActsReadinessResult {
  ready: boolean;
  groups: ActReadinessGroup[];
  unassignedIssues: ActReadinessIssue[];
  globalIssues: ActReadinessIssue[];
  blockingIssues: ActReadinessIssue[];
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function nonBlank(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function positiveId(value: number | null): boolean {
  return Number.isInteger(value) && Number(value) > 0;
}

function qualityIssue(requirement: MissingQualityRequirementInput): ActReadinessIssue {
  const acceptableDocTypes = Array.from(new Set(requirement.acceptableDocTypes)).sort();
  return {
    code: "QUALITY_DOCUMENT_MISSING",
    entityType: "project_material",
    entityId: requirement.projectMaterialId,
    reason: requirement.reason,
    question: `Приложите документ качества для материала #${requirement.projectMaterialId}: ${acceptableDocTypes.join(", ")}.`,
    details: {
      ruleId: requirement.ruleId,
      acceptableDocTypes,
      usedInTaskIds: Array.from(new Set(requirement.usedInTaskIds)).sort((a, b) => a - b),
    },
  };
}

function taskIssues(task: ActReadinessTaskInput): ActReadinessIssue[] {
  const issues: ActReadinessIssue[] = [];
  if (!isRealIsoDate(task.startDate) || !Number.isInteger(task.durationDays) || task.durationDays < 1) {
    issues.push({
      code: "ACT_DATE_INVALID",
      entityType: "schedule_task",
      entityId: task.id,
      reason: "Для задачи нужна корректная дата начала и положительная целая длительность.",
      question: `Уточните дату начала и длительность задачи #${task.id}.`,
    });
  }
  if (positiveId(task.workId) === positiveId(task.estimatePositionId)) {
    issues.push({
      code: "ACT_WORK_MISSING",
      entityType: "schedule_task",
      entityId: task.id,
      reason: "Задача должна ссылаться ровно на одну работу или позицию сметы.",
      question: `Укажите источник работы для задачи #${task.id}.`,
    });
  }
  if (!task.hasMaterials) {
    issues.push({
      code: "ACT_MATERIAL_MISSING",
      entityType: "schedule_task",
      entityId: task.id,
      reason: "К задаче не привязаны используемые материалы.",
      question: `Укажите материалы для задачи #${task.id}.`,
    });
  }
  return issues;
}

export function evaluateActsReadiness(input: ActsReadinessInput): ActsReadinessResult {
  const tasks = [...input.tasks].sort((a, b) => a.id - b.id);
  const assigned = new Map<number, ActReadinessTaskInput[]>();
  const unassignedTasks: ActReadinessTaskInput[] = [];

  for (const task of tasks) {
    if (!Number.isInteger(task.actNumber) || Number(task.actNumber) <= 0) {
      unassignedTasks.push(task);
      continue;
    }
    const actNumber = Number(task.actNumber);
    const group = assigned.get(actNumber) ?? [];
    group.push(task);
    assigned.set(actNumber, group);
  }

  const qualityRequirements = [...input.missingQualityRequirements].sort(
    (a, b) => a.projectMaterialId - b.projectMaterialId || a.ruleId.localeCompare(b.ruleId),
  );
  const groups: ActReadinessGroup[] = [];

  for (const [actNumber, groupTasks] of Array.from(assigned.entries()).sort(([a], [b]) => a - b)) {
    const taskIds = groupTasks.map((task) => task.id);
    const taskIdSet = new Set(taskIds);
    const issues = groupTasks.flatMap(taskIssues);
    const templateIds: number[] = Array.from(new Set(groupTasks
      .map((task) => task.actTemplateId)
      .filter((id): id is number => positiveId(id))))
      .sort((a, b) => a - b);

    if (templateIds.length === 0) {
      issues.push({
        code: "ACT_TEMPLATE_MISSING",
        entityType: "act_group",
        entityId: actNumber,
        reason: "Для группы работ не выбран шаблон акта.",
        question: `Выберите шаблон для акта №${actNumber}.`,
      });
    } else if (templateIds.length > 1) {
      issues.push({
        code: "ACT_TEMPLATE_CONFLICT",
        entityType: "act_group",
        entityId: actNumber,
        reason: "В группе работ выбрано несколько шаблонов акта.",
        question: `Выберите один шаблон для акта №${actNumber}.`,
        details: { actTemplateIds: templateIds },
      });
    }
    if (!groupTasks.some((task) => nonBlank(task.projectDrawings))) {
      issues.push({
        code: "PROJECT_DOCUMENTATION_MISSING",
        entityType: "act_group",
        entityId: actNumber,
        reason: "Не указана проектная документация для работ акта.",
        question: `Укажите проектную документацию для акта №${actNumber}.`,
      });
    }
    if (!groupTasks.some((task) => nonBlank(task.normativeRefs))) {
      issues.push({
        code: "NORMATIVE_REFERENCE_MISSING",
        entityType: "act_group",
        entityId: actNumber,
        reason: "Не указаны нормативные ссылки для работ акта.",
        question: `Укажите нормативные ссылки для акта №${actNumber}.`,
      });
    }
    if (!groupTasks.some((task) => task.executiveSchemes?.some((scheme) => nonBlank(scheme.title)))) {
      issues.push({
        code: "EXECUTIVE_SCHEME_MISSING",
        entityType: "act_group",
        entityId: actNumber,
        reason: "Не указана исполнительная схема для работ акта.",
        question: `Укажите исполнительную схему для акта №${actNumber}.`,
      });
    }
    issues.push(...qualityRequirements
      .filter((requirement) => requirement.usedInTaskIds.some((taskId) => taskIdSet.has(taskId)))
      .map(qualityIssue));
    groups.push({ actNumber, taskIds, ready: issues.length === 0, blockingIssues: issues });
  }

  const unassignedTaskIds = new Set(unassignedTasks.map((task) => task.id));
  const unassignedIssues: ActReadinessIssue[] = unassignedTasks.map((task) => ({
    code: "ACT_NUMBER_MISSING",
    entityType: "schedule_task",
    entityId: task.id,
    reason: "Задача не включена ни в одну группу акта.",
    question: `Укажите номер акта для задачи #${task.id}.`,
  }));
  unassignedIssues.push(...qualityRequirements
    .filter((requirement) => requirement.usedInTaskIds.some((taskId) => unassignedTaskIds.has(taskId)))
    .map(qualityIssue));

  const knownTaskIds = new Set(tasks.map((task) => task.id));
  const globalIssues: ActReadinessIssue[] = [];
  if (tasks.length === 0) {
    globalIssues.push({
      code: "ACT_WORK_MISSING",
      entityType: "schedule",
      entityId: input.scheduleId,
      reason: "В утверждённом графике нет задач для формирования актов.",
      question: "Добавьте работы в график перед формированием актов.",
    });
  }
  for (const fieldPath of REQUIRED_ACT_SOURCE_FIELDS) {
    if (input.sourceData.fields[fieldPath] === true) continue;
    globalIssues.push({
      code: "SOURCE_DATA_MISSING",
      entityType: "object",
      entityId: input.sourceData.objectId,
      reason: `Не заполнено обязательное исходное поле ${fieldPath}.`,
      question: `Заполните поле ${fieldPath} в исходных данных объекта.`,
      details: { fieldPath },
    });
  }
  globalIssues.push(...input.materialClassificationIssues
    .slice()
    .sort((a, b) => a.registerItemId - b.registerItemId)
    .map((issue): ActReadinessIssue => ({
      code: "MATERIAL_CLASSIFICATION_REQUIRED",
      entityType: "material_register_item",
      entityId: issue.registerItemId,
      reason: issue.reason,
      question: `Подтвердите классификацию позиции реестра #${issue.registerItemId}.`,
    })));
  globalIssues.push(...qualityRequirements
    .filter((requirement) => !requirement.usedInTaskIds.some((taskId) => knownTaskIds.has(taskId)))
    .map(qualityIssue));

  const blockingIssues = [
    ...groups.flatMap((group) => group.blockingIssues),
    ...unassignedIssues,
    ...globalIssues,
  ];
  return {
    ready: blockingIssues.length === 0,
    groups,
    unassignedIssues,
    globalIssues,
    blockingIssues,
  };
}
