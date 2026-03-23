/**
 * @file: Schedule.tsx
 * @description: Экран "График работ" (диаграмма Ганта): дефолтный график, bootstrap задач из ВОР, редактирование startDate/durationDays.
 * @dependencies: shared/routes.ts (контракт), client/src/hooks/use-schedules.ts, client/src/hooks/use-works.ts
 * @created: 2026-01-17
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { TariffGuard } from "@/components/TariffGuard";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { OdooCard } from "@/components/ui/odoo-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguageStore, translations } from "@/lib/i18n";
import { useWorks } from "@/hooks/use-works";
import { useEstimate, useEstimates } from "@/hooks/use-estimates";
import { useEstimateSubrowStatuses } from "@/hooks/use-estimate-position-links";
import { useUpsertEstimatePositionLink, useDeleteEstimatePositionLink } from "@/hooks/use-estimate-position-links";
import { 
  useBootstrapScheduleFromWorks, 
  useBootstrapScheduleFromEstimate,
  useChangeScheduleSource,
  useDefaultSchedule, 
  usePatchScheduleTask, 
  useSchedule,
  useScheduleSourceInfo,
  useSplitScheduleTask,
  useSplitSiblings,
} from "@/hooks/use-schedules";
import { useActTemplates } from "@/hooks/use-act-templates";
import { useReplaceTaskMaterials, useTaskMaterials } from "@/hooks/use-task-materials";
import { useCurrentObject } from "@/hooks/use-source-data";
import { useProjectMaterials } from "@/hooks/use-materials";
import { ExecutiveSchemesEditor, type ExecutiveSchemeItem } from "@/components/schedule/ExecutiveSchemesEditor";
import { SplitTaskDialog } from "@/components/schedule/SplitTaskDialog";
import type { ScheduleTask, Work } from "@shared/schema";
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, RotateCcw, AlertTriangle, ChevronsUpDown, Check, MoreVertical, Package, Scissors, ZoomIn, ZoomOut, Search, BarChart2 } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PillTabs } from "@/components/ui/pill-tabs";
import { cn } from "@/lib/utils";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ru, enUS } from "date-fns/locale";

const SPLIT_ERROR_MESSAGES: Record<string, { ru: string; en: string }> = {
  "Sum of split quantities exceeds original task quantity": {
    ru: "Сумма объёмов частей превышает исходный объём задачи. Уменьшите значения.",
    en: "Sum of split quantities exceeds the original task quantity. Please reduce the values.",
  },
  "Split date is out of task date range": {
    ru: "Дата разделения выходит за пределы периода задачи.",
    en: "Split date is outside the task date range.",
  },
  "Schedule task not found": {
    ru: "Задача не найдена.",
    en: "Schedule task not found.",
  },
};

function parseSplitTaskError(rawMessage: string | undefined, language: string): string {
  const fallback = language === "ru" ? "Не удалось разделить задачу" : "Failed to split task";
  if (!rawMessage) return fallback;

  const jsonMatch = rawMessage.match(/^\d+: (.+)$/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      const serverMsg: string = parsed?.message ?? "";
      const mapped = SPLIT_ERROR_MESSAGES[serverMsg];
      if (mapped) return language === "ru" ? mapped.ru : mapped.en;
      if (serverMsg) return serverMsg;
    } catch {
      // not JSON — fall through
    }
  }

  return rawMessage || fallback;
}

// Helper: Generate consistent color for split task group
function getSplitTaskColor(splitGroupId: string | null | undefined): string | null {
  if (!splitGroupId) return null;
  
  let hash = 0;
  for (let i = 0; i < splitGroupId.length; i++) {
    hash = splitGroupId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

export default function Schedule() {
  const [, navigate] = useLocation();
  const { language } = useLanguageStore();
  const t = translations[language].schedule;
  const { toast } = useToast();

  const { data: works = [] } = useWorks();
  const worksById = useMemo(() => new Map<number, Work>(works.map((w) => [w.id, w])), [works]);

  const { data: defaultSchedule, isLoading: isLoadingDefault, error: defaultError } = useDefaultSchedule();
  const scheduleId = defaultSchedule?.id;

  const {
    data: schedule,
    isLoading: isLoadingSchedule,
    error: scheduleError,
  } = useSchedule(scheduleId);

  const bootstrapFromWorks = useBootstrapScheduleFromWorks(scheduleId);
  const bootstrapFromEstimate = useBootstrapScheduleFromEstimate(scheduleId);
  const changeSource = useChangeScheduleSource(scheduleId);
  const { data: sourceInfo } = useScheduleSourceInfo(scheduleId);
  const patchTask = usePatchScheduleTask();
  const splitTask = useSplitScheduleTask(scheduleId);

  const tasks: ScheduleTask[] = schedule?.tasks ?? [];
  const tasksRef = useRef<ScheduleTask[]>(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const sourceType = schedule?.sourceType ?? 'works';
  const scheduleEstimateId = sourceType === "estimate" ? (schedule?.estimateId ?? null) : null;

  type TaskFilter = 'all' | 'with-act' | 'without-act';
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'with-act') return tasks.filter((t) => t.actNumber != null);
    if (taskFilter === 'without-act') return tasks.filter((t) => !t.actNumber);
    return tasks;
  }, [tasks, taskFilter]);

  const splitTasksInfo = useMemo(() => {
    const groupedBySplitId = new Map<string, ScheduleTask[]>();
    for (const task of tasks) {
      const splitGroupId = task.splitGroupId;
      if (splitGroupId) {
        if (!groupedBySplitId.has(splitGroupId)) {
          groupedBySplitId.set(splitGroupId, []);
        }
        groupedBySplitId.get(splitGroupId)!.push(task);
      }
    }

    const taskSplitInfo = new Map<number, { position: number; total: number }>();
    groupedBySplitId.forEach((siblings) => {
      const sorted = siblings.sort((a, b) => {
        const indexA = a.splitIndex ?? 0;
        const indexB = b.splitIndex ?? 0;
        return indexA - indexB;
      });
      sorted.forEach((task, idx) => {
        taskSplitInfo.set(task.id, { position: idx + 1, total: sorted.length });
      });
    });

    return taskSplitInfo;
  }, [tasks]);

  const [changeSourceDialogOpen, setChangeSourceDialogOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [pendingSourceType, setPendingSourceType] = useState<'works' | 'estimate' | null>(null);
  const [pendingEstimateId, setPendingEstimateId] = useState<number | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ScheduleTask | null>(null);
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editDurationDays, setEditDurationDays] = useState<string>("1");
  const [pendingEditTaskId, setPendingEditTaskId] = useState<number | null>(null);
  const [pendingEditTemplateId, setPendingEditTemplateId] = useState<string | null>(null);
  const [editActNumber, setEditActNumber] = useState<string>("");
  const [editActTemplateId, setEditActTemplateId] = useState<string>("");
  const [editQuantity, setEditQuantity] = useState<string>("");
  const [editUnit, setEditUnit] = useState<string>("");
  const [editProjectDrawings, setEditProjectDrawings] = useState<string>("");
  const [editNormativeRefs, setEditNormativeRefs] = useState<string>("");
  const [editExecutiveSchemes, setEditExecutiveSchemes] = useState<ExecutiveSchemeItem[]>([]);
  const [editIndependentMaterials, setEditIndependentMaterials] = useState<boolean>(false);
  
  // Act type conflict dialog state
  const [actConflictDialogOpen, setActConflictDialogOpen] = useState(false);
  const [actConflictData, setActConflictData] = useState<{
    actNumber: number;
    currentTemplateId: number | null;
    otherTasksCount: number;
    conflictKind?: "actNumberAssign" | "actNumberChange" | "templateChange";
  } | null>(null);

  // Split task dialog state
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [taskToSplit, setTaskToSplit] = useState<ScheduleTask | null>(null);

  // Inline act template picker (tablet modal stacking, Task 4.4)
  const [actTemplatePickerOpen, setActTemplatePickerOpen] = useState(false);
  const [actTemplateSearch, setActTemplateSearch] = useState("");

  // Task editor active tab (Task 4.3)
  const [editTab, setEditTab] = useState<"basic" | "materials" | "docs">("basic");

  const { data: estimates = [] } = useEstimates();
  const activeEstimateId = scheduleEstimateId;
  const { data: activeEstimateDetail } = useEstimate(activeEstimateId);

  const { data: subrowStatuses } = useEstimateSubrowStatuses(sourceType === "estimate" ? scheduleId : null);

  const { data: currentObject } = useCurrentObject();
  const { data: templatesData } = useActTemplates();
  const { data: projectMaterials = [] } = useProjectMaterials(currentObject?.id);

  const groupedActTemplates = useMemo(() => {
    const templates = templatesData?.templates ?? [];
    const acc: Record<string, import("@/hooks/use-act-templates").ActTemplateDto[]> = {};
    for (const tpl of templates) {
      if (!acc[tpl.category]) acc[tpl.category] = [];
      acc[tpl.category].push(tpl);
    }
    return acc;
  }, [templatesData]);

  const selectedActTemplate = useMemo(() => {
    if (!editActTemplateId) return null;
    return (templatesData?.templates ?? []).find((t: any) => String(t.id) === editActTemplateId) ?? null;
  }, [editActTemplateId, templatesData]);

  const taskMaterialsQuery = useTaskMaterials(selectedTask?.id);

  // Handle return from SelectActTemplate / SelectTaskMaterials sub-pages
  useEffect(() => {
    const handlePopState = () => {
      // Check if returning from a sub-page (taskId was saved before navigate)
      const savedTaskIdStr = sessionStorage.getItem("scheduleEditTaskId");
      if (savedTaskIdStr) {
        sessionStorage.removeItem("scheduleEditTaskId");
        const savedTaskId = Number(savedTaskIdStr);

        // Template selection result (from SelectActTemplate via sessionStorage)
        let resolvedTemplateId: string | null | undefined = undefined;
        const storedTemplateId = sessionStorage.getItem("selectedActTemplateId");
        if (storedTemplateId !== null) {
          sessionStorage.removeItem("selectedActTemplateId");
          resolvedTemplateId = storedTemplateId === "__clear__" ? null : storedTemplateId;
        }

        const currentTasks = tasksRef.current;
        const task = currentTasks.find((t) => t.id === savedTaskId);
        if (task) {
          if (openEditRef.current) {
            openEditRef.current(task, resolvedTemplateId);
          } else {
            // openEditRef not yet assigned (component just mounted) — defer
            setPendingEditTaskId(savedTaskId);
            if (resolvedTemplateId !== undefined) {
              setPendingEditTemplateId(resolvedTemplateId);
            }
          }
        } else {
          // Tasks not loaded yet — defer until they are
          setPendingEditTaskId(savedTaskId);
          if (resolvedTemplateId !== undefined) {
            setPendingEditTemplateId(resolvedTemplateId);
          }
        }
      }
    };

    // Check immediately in case we just navigated back
    handlePopState();

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upsertLink = useUpsertEstimatePositionLink(scheduleId);
  const deleteLink = useDeleteEstimatePositionLink(scheduleId);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkTargetAux, setLinkTargetAux] = useState<any | null>(null);
  const [linkMaterialId, setLinkMaterialId] = useState<number | null>(null);
  const [linkMaterialSearch, setLinkMaterialSearch] = useState("");

  const openLinkDialog = (aux: any) => {
    setLinkTargetAux(aux);
    const s = (subrowStatuses as any)?.byEstimatePositionId?.[String(aux?.id)];
    const existingMaterialId = typeof s?.projectMaterialId === "number" ? s.projectMaterialId : null;
    setLinkMaterialId(existingMaterialId);
    setLinkMaterialSearch("");
    setLinkDialogOpen(true);
  };

  // Helper: check if estimate position is "main" (ГЭСН/ФЕР/ТЕР)
  const isMainEstimatePosition = (pos: { code?: string | null }): boolean => {
    const code = String(pos.code ?? "").trim().toUpperCase();
    if (!code) return false;
    return code.startsWith("ГЭСН") || code.startsWith("ФЕР") || code.startsWith("ТЕР");
  };

  const parseNumeric = (value: unknown): number | null => {
    if (value == null) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const s = String(value).trim();
    if (!s) return null;
    // Support "123,45" and "1 234,56" formats
    const normalized = s.replace(/\s+/g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  };

  const getLaborManHours = (position: any): number | null => {
    const resources: any[] = position?.resources ?? [];
    if (!Array.isArray(resources) || resources.length === 0) return null;

    // Prefer explicit labor resource types (ОТ + ОТМ) if present
    const laborByType = resources.filter((r: any) => {
      const type = String(r?.resourceType ?? "")
        .toUpperCase()
        .replace(/[()]/g, "")
        .trim();
      return type === "ОТ" || type === "ОТМ";
    });

    let laborResources = laborByType;
    let laborMode: "type" | "unit" = "type";

    // Fallback: some estimate exports store labor without resourceType; then use unit "чел.-ч"
    if (laborResources.length === 0) {
      const laborByUnit = resources.filter((r: any) => {
        const u = String(r?.unit ?? "").toLowerCase().replace(/\s+/g, "");
        return u.includes("чел") && u.includes("ч");
      });

      if (laborByUnit.length > 0) {
        laborResources = laborByUnit;
        laborMode = "unit";
      } else {
        return null;
      }
    }

    let total = 0;
    for (const r of laborResources) {
      const n = parseNumeric(r?.quantityTotal ?? r?.quantity);
      if (n != null) total += n;
    }

    return total > 0 ? total : null;
  };

  const formatTzHours = (hoursRaw: number): string => {
    const hours = Number(hoursRaw);
    if (!Number.isFinite(hours) || hours <= 0) return "0";
    const int = Math.round(hours);
    if (Math.abs(hours - int) < 1e-9) return String(int);
    // Show at most 1 digit after decimal (Russian locale uses comma).
    return hours.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
  };

  // Build flat list of all estimate positions (ordered)
  const allEstimatePositions = useMemo(() => {
    const list: any[] = [];
    const sections: any[] = (activeEstimateDetail as any)?.sections ?? [];
    for (const s of sections) {
      for (const p of (s?.positions ?? []) as any[]) {
        if (typeof p?.id === "number") list.push(p);
      }
    }
    return list;
  }, [activeEstimateDetail]);

  const estimatePositionsById = useMemo(() => {
    const map = new Map<number, any>();
    for (const p of allEstimatePositions) {
      map.set(p.id, p);
    }
    return map;
  }, [allEstimatePositions]);

  // Group auxiliary positions under main positions
  const auxiliaryPositionsByMainId = useMemo(() => {
    const map = new Map<number, any[]>();
    if (sourceType !== "estimate") return map;

    let currentMainId: number | null = null;
    for (const pos of allEstimatePositions) {
      if (isMainEstimatePosition(pos)) {
        const posId = Number(pos.id);
        if (Number.isFinite(posId)) {
          currentMainId = posId;
          map.set(currentMainId, []);
        }
      } else if (currentMainId !== null) {
        const list = map.get(currentMainId) ?? [];
        list.push(pos);
        map.set(currentMainId, list);
      }
    }
    return map;
  }, [allEstimatePositions, sourceType]);

  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set());

  const toggleTaskExpanded = (taskId: number) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const sourceSelectValue = useMemo(() => {
    if (sourceType === "works") return "works";
    const id = schedule?.estimateId;
    return typeof id === "number" ? `estimate:${id}` : "estimate:0";
  }, [schedule?.estimateId, sourceType]);

  const calendarStart = useMemo(() => {
    if (schedule?.calendarStart) return String(schedule.calendarStart);
    const min = tasks
      .map((t) => t.startDate)
      .filter(Boolean)
      .sort()[0];
    return min ? String(min) : format(new Date(), "yyyy-MM-dd");
  }, [schedule?.calendarStart, tasks]);

  const ZOOM_CONFIGS = [
    { dayWidth: 18, visibleDays: 84, label: language === "ru" ? "3М" : "3M" },
    { dayWidth: 24, visibleDays: 60, label: language === "ru" ? "2М" : "2M" },
    { dayWidth: 32, visibleDays: 42, label: language === "ru" ? "6Н" : "6W" },
    { dayWidth: 48, visibleDays: 28, label: language === "ru" ? "4Н" : "4W" },
  ] as const;
  const [zoomLevel, setZoomLevel] = useState<0 | 1 | 2 | 3>(1);
  const { dayWidth, visibleDays } = ZOOM_CONFIGS[zoomLevel];
  const timelineWidth = visibleDays * dayWidth;
  const rowHeight = 88;

  // When auxiliary rows are expanded (estimate source), the left table grows,
  // so the timeline must also grow and shift bars down accordingly.
  const scheduleRowLayout = useMemo(() => {
    const expandedAuxCountByTaskId = new Map<number, number>();
    if (sourceType === "estimate") {
      for (const task of tasks) {
        const auxiliaries = task.estimatePositionId
          ? (auxiliaryPositionsByMainId.get(task.estimatePositionId) ?? [])
          : [];
        const isExpanded = expandedTaskIds.has(task.id);
        expandedAuxCountByTaskId.set(task.id, isExpanded ? auxiliaries.length : 0);
      }
    }

    const taskTopRowIndexByTaskId = new Map<number, number>();
    let rowIndex = 0;
    for (const task of tasks) {
      taskTopRowIndexByTaskId.set(task.id, rowIndex);
      rowIndex += 1 + (expandedAuxCountByTaskId.get(task.id) ?? 0);
    }

    return {
      expandedAuxCountByTaskId,
      taskTopRowIndexByTaskId,
      totalRows: rowIndex,
    };
  }, [tasks, sourceType, expandedTaskIds, auxiliaryPositionsByMainId]);

  // Warning: total quantity of all tasks for the same source exceeds the source reference value.
  const quantityExceedWarning = useMemo(() => {
    if (!selectedTask || editQuantity.trim() === "") return null;
    const newQty = Number(editQuantity);
    if (isNaN(newQty) || newQty < 0) return null;

    const sourceId = selectedTask.workId ?? selectedTask.estimatePositionId ?? null;
    if (sourceId == null) return null;

    // Sum of all tasks with the same source (excluding current task, adding new value)
    const totalOthers = tasks
      .filter((t) => t.id !== selectedTask.id && (t.workId ?? t.estimatePositionId) === sourceId)
      .reduce((sum, t) => sum + ((t.quantity != null) ? Number(t.quantity) : 0), 0);
    const totalNew = totalOthers + newQty;

    // Reference quantity from source
    let sourceQty: number | null = null;
    if (selectedTask.workId) {
      const w = worksById.get(selectedTask.workId);
      const raw = (w as any)?.quantityTotal;
      if (raw != null) sourceQty = Number(raw);
    } else if (selectedTask.estimatePositionId) {
      const p = estimatePositionsById.get(selectedTask.estimatePositionId);
      const raw = (p as any)?.quantity;
      if (raw != null) sourceQty = Number(raw);
    }

    if (sourceQty == null || !Number.isFinite(sourceQty) || sourceQty <= 0) return null;
    if (totalNew > sourceQty + 1e-9) {
      return {
        totalNew,
        sourceQty,
        excess: totalNew - sourceQty,
      };
    }
    return null;
  }, [selectedTask, editQuantity, tasks, worksById, estimatePositionsById]);

  const openEditRef = useRef<((task: ScheduleTask, overrideTemplateId?: string | null) => void) | null>(null);

  const saveEditFormState = () => {
    const state = {
      actNumber: editActNumber,
      startDate: editStartDate,
      durationDays: editDurationDays,
      quantity: editQuantity,
      unit: editUnit,
      projectDrawings: editProjectDrawings,
      normativeRefs: editNormativeRefs,
      executiveSchemes: editExecutiveSchemes,
      independentMaterials: editIndependentMaterials,
      actTemplateId: editActTemplateId,
    };
    sessionStorage.setItem("scheduleEditFormState", JSON.stringify(state));
  };

  const openEdit = (task: ScheduleTask, overrideTemplateId?: string | null) => {
    setSelectedTask(task);

    // Restore form state saved before navigating to sub-pages (SelectActTemplate, etc.)
    const savedStr = sessionStorage.getItem("scheduleEditFormState");
    let saved: Record<string, any> | null = null;
    if (savedStr) {
      sessionStorage.removeItem("scheduleEditFormState");
      try { saved = JSON.parse(savedStr); } catch { /* ignore */ }
    }

    setEditStartDate(saved?.startDate ?? String(task.startDate));
    setEditDurationDays(saved?.durationDays ?? String(Number(task.durationDays || 1)));
    setEditActNumber(saved?.actNumber ?? (task.actNumber == null ? "" : String(task.actNumber)));

    const rawTemplateId = overrideTemplateId !== undefined
      ? (overrideTemplateId === null ? "" : String(overrideTemplateId))
      : (saved?.actTemplateId ?? (task.actTemplateId == null ? "" : String(task.actTemplateId)));
    setEditActTemplateId(rawTemplateId);

    const rawQty = task.quantity;
    setEditQuantity(saved?.quantity ?? (rawQty != null ? String(Number(rawQty)) : ""));
    setEditUnit(saved?.unit ?? String(task.unit ?? ""));
    setEditProjectDrawings(saved?.projectDrawings ?? String(task.projectDrawings ?? ""));
    setEditNormativeRefs(saved?.normativeRefs ?? String(task.normativeRefs ?? ""));
    setEditExecutiveSchemes(
      Array.isArray(saved?.executiveSchemes) ? saved.executiveSchemes
        : (Array.isArray(task.executiveSchemes) ? task.executiveSchemes : [])
    );
    setEditIndependentMaterials(
      saved?.independentMaterials != null ? Boolean(saved.independentMaterials) : Boolean(task.independentMaterials)
    );
    setEditTab("basic");
    setEditOpen(true);
  };

  useEffect(() => {
    openEditRef.current = openEdit;
  });

  // Restore edit dialog when returning from sub-pages (SelectActTemplate, SelectTaskMaterials)
  useEffect(() => {
    if (pendingEditTaskId === null || tasks.length === 0) return;
    const task = tasks.find((t) => t.id === pendingEditTaskId);
    if (!task) return;
    openEdit(task, pendingEditTemplateId);
    setPendingEditTaskId(null);
    setPendingEditTemplateId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEditTaskId, tasks]);

  const openSplitDialog = (task: ScheduleTask) => {
    setTaskToSplit(task);
    setSplitDialogOpen(true);
  };

  const closeSplitDialog = () => {
    setSplitDialogOpen(false);
    setTaskToSplit(null);
  };

  const handleSplitTask = async (data: {
    taskId: number;
    splitDate: string;
    quantityFirst?: string;
    quantitySecond?: string;
    newActNumber?: number;
    inherit?: {
      materials?: boolean;
      projectDrawings?: boolean;
      normativeRefs?: boolean;
      executiveSchemes?: boolean;
    };
  }) => {
    try {
      const result = await splitTask.mutateAsync(data);
      toast({
        title: language === "ru" ? "Задача разделена" : "Task split",
        description: language === "ru" 
          ? "Задача успешно разделена на две части" 
          : "Task successfully split into two parts",
      });
      closeSplitDialog();
    } catch (err: any) {
      const errorMessage = parseSplitTaskError(err?.message, language);
      toast({
        title: t.errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleBootstrap = async () => {
    try {
      const result = sourceType === 'estimate' 
        ? await bootstrapFromEstimate.mutateAsync({})
        : await bootstrapFromWorks.mutateAsync({});
      toast({
        title: t.bootstrapDoneTitle,
        description: t.bootstrapDoneDesc
          .replace("{created}", String(result.created))
          .replace("{skipped}", String(result.skipped)),
      });
    } catch (err: any) {
      toast({
        title: t.errorTitle,
        description: err?.message || t.bootstrapError,
        variant: "destructive",
      });
    }
  };

  const changeSourceAndMaybeBootstrap = async (nextSourceType: 'works' | 'estimate', nextEstimateId?: number) => {
    if (!sourceInfo) return;
    try {
      await changeSource.mutateAsync({
        newSourceType: nextSourceType,
        estimateId: nextEstimateId,
        confirmReset: true,
      });

      // Auto-bootstrap from the new source (so user immediately "sees" the schedule)
      if (nextSourceType === "estimate") {
        await bootstrapFromEstimate.mutateAsync({});
      } else {
        await bootstrapFromWorks.mutateAsync({});
      }

      setChangeSourceDialogOpen(false);
      setConfirmationInput("");
      setPendingSourceType(null);
      setPendingEstimateId(null);

      toast({
        title: language === "ru" ? "Источник изменён" : "Source changed",
        description:
          nextSourceType === "estimate"
            ? (language === "ru"
                ? `Источник графика изменён на "Смета". Задачи удалены (${sourceInfo.tasksCount} шт.)`
                : `Schedule source changed to \"Estimate\". Tasks deleted (${sourceInfo.tasksCount}).`)
            : (language === "ru"
                ? `Источник графика изменён на "ВОР". Задачи удалены (${sourceInfo.tasksCount} шт.)`
                : `Schedule source changed to \"Works\". Tasks deleted (${sourceInfo.tasksCount}).`),
      });
    } catch (err: any) {
      toast({
        title: t.errorTitle,
        description: err?.message || "Failed to change source",
        variant: "destructive",
      });
    }
  };

  const requestChangeSource = (nextSourceType: 'works' | 'estimate', nextEstimateId?: number) => {
    if (!sourceInfo) {
      toast({
        title: t.errorTitle,
        description: language === "ru" ? "Подождите, данные графика ещё загружаются" : "Please wait, schedule data is still loading",
        variant: "destructive",
      });
      return;
    }
    // If nothing to reset, do it immediately (no scary dialog)
    const tasksCount = sourceInfo?.tasksCount ?? 0;
    setPendingSourceType(nextSourceType);
    setPendingEstimateId(nextSourceType === "estimate" ? (nextEstimateId ?? null) : null);

    if (tasksCount === 0) {
      void changeSourceAndMaybeBootstrap(nextSourceType, nextEstimateId);
      return;
    }

    setConfirmationInput("");
    setChangeSourceDialogOpen(true);
  };

  const handleConfirmChangeSource = async () => {
    if (!sourceInfo || !pendingSourceType) return;
    const isConfirmed = confirmationInput.trim().toUpperCase() === "ПОДТВЕРЖДАЮ";
    if ((sourceInfo.tasksCount ?? 0) > 0 && !isConfirmed) return;
    await changeSourceAndMaybeBootstrap(
      pendingSourceType,
      pendingSourceType === "estimate" ? (pendingEstimateId ?? undefined) : undefined
    );
  };

  const shiftTask = async (task: ScheduleTask, deltaDays: number) => {
    try {
      const current = parseISO(String(task.startDate));
      const next = addDays(current, deltaDays);
      await patchTask.mutateAsync({
        id: task.id,
        patch: { startDate: format(next, "yyyy-MM-dd") },
        scheduleId: scheduleId ?? undefined,
      });
    } catch (err: any) {
      toast({
        title: t.errorTitle,
        description: err?.message || t.updateError,
        variant: "destructive",
      });
    }
  };

  const saveEdit = async () => {
    if (!selectedTask) return;
    try {
      const durationTrimmed = editDurationDays.trim();
      const durationNum = durationTrimmed === "" ? 1 : Number(durationTrimmed);
      if (!Number.isFinite(durationNum) || durationNum < 1 || !Number.isInteger(durationNum)) {
        toast({
          title: t.errorTitle,
          description: language === "ru" ? "Длительность должна быть целым числом ≥ 1" : "Duration must be an integer ≥ 1",
          variant: "destructive",
        });
        return;
      }
      const trimmed = editActNumber.trim();
      const nextActNumber = trimmed === "" ? null : Number(trimmed);
      if (trimmed !== "") {
        const n = Number(trimmed);
        if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
          toast({
            title: t.errorTitle,
            description: language === "ru" ? "Номер акта должен быть целым числом > 0" : "Act number must be an integer > 0",
            variant: "destructive",
          });
          return;
        }
      }
      if (trimmed !== "" && nextActNumber == null) {
        toast({
          title: t.errorTitle,
          description: language === "ru" ? "Номер акта должен быть целым числом > 0" : "Act number must be an integer > 0",
          variant: "destructive",
        });
        return;
      }

      const tplTrimmed = editActTemplateId.trim();
      const nextActTemplateId = tplTrimmed === "" ? null : Number(tplTrimmed);
      if (tplTrimmed !== "") {
        const n = Number(tplTrimmed);
        if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
          toast({
            title: t.errorTitle,
            description: language === "ru" ? "Тип акта должен быть целым числом > 0" : "Act type must be an integer > 0",
            variant: "destructive",
          });
          return;
        }
      }

      const nextQuantity = editQuantity.trim() === "" ? null : Number(editQuantity);
      if (editQuantity.trim() !== "" && (isNaN(nextQuantity!) || nextQuantity! < 0)) {
        toast({
          title: t.errorTitle,
          description: language === "ru" ? "Объём должен быть числом ≥ 0" : "Quantity must be a number ≥ 0",
          variant: "destructive",
        });
        return;
      }
      const nextUnit = editUnit.trim() || null;

      await patchTask.mutateAsync({
        id: selectedTask.id,
        patch: {
          startDate: editStartDate,
          durationDays: durationNum,
          actNumber: nextActNumber,
          actTemplateId: nextActTemplateId,
          quantity: nextQuantity,
          unit: nextUnit,
          projectDrawings: editProjectDrawings.trim() ? editProjectDrawings : null,
          normativeRefs: editNormativeRefs.trim() ? editNormativeRefs : null,
          executiveSchemes: (editExecutiveSchemes ?? []).filter((s) => String(s?.title ?? "").trim().length > 0),
          independentMaterials: editIndependentMaterials,
          // Do not auto-send updateAllTasks — let backend enforce rules and return 409 if needed
          updateAllTasks: undefined,
        },
        scheduleId: scheduleId ?? undefined,
      });

      toast({
        title: language === "ru" ? "Сохранено" : "Saved",
        description: language === "ru" ? "Данные задачи обновлены" : "Task data updated",
        duration: 1800,
      });
      setEditOpen(false);
    } catch (err: any) {
      // Check if this is a 409 conflict error (act type mismatch)
      if (err?.status === 409 && err?.data?.actNumber && err?.data?.currentTemplateId !== undefined) {
        setActConflictData({
          actNumber: err.data.actNumber,
          currentTemplateId: err.data.currentTemplateId,
          otherTasksCount: err.data.otherTasksCount ?? 0,
          conflictKind: err.data.conflictKind,
        });
        setActConflictDialogOpen(true);
        return;
      }
      
      toast({
        title: t.errorTitle,
        description: err?.message || t.updateError,
        variant: "destructive",
      });
    }
  };

  const handleActConflictAccept = async () => {
    if (!selectedTask || !actConflictData) return;
    
    try {
      const conflictKind = actConflictData.conflictKind;
      
      if (conflictKind === "actNumberAssign" || conflictKind === "actNumberChange") {
        const conflictTemplateId = actConflictData.currentTemplateId;
        setEditActTemplateId(conflictTemplateId ? String(conflictTemplateId) : "");

        setActConflictDialogOpen(false);
        setActConflictData(null);

        const durationNum = Number(editDurationDays.trim() || "1");
        const nextActNumber = editActNumber.trim() === "" ? null : Number(editActNumber);
        const nextQuantity = editQuantity.trim() === "" ? null : Number(editQuantity);
        const nextUnit = editUnit.trim() || null;

        await patchTask.mutateAsync({
          id: selectedTask.id,
          patch: {
            startDate: editStartDate,
            durationDays: durationNum,
            actNumber: nextActNumber,
            actTemplateId: conflictTemplateId,
            quantity: nextQuantity,
            unit: nextUnit,
            projectDrawings: editProjectDrawings.trim() ? editProjectDrawings : null,
            normativeRefs: editNormativeRefs.trim() ? editNormativeRefs : null,
            executiveSchemes: (editExecutiveSchemes ?? []).filter((s) => String(s?.title ?? "").trim().length > 0),
            independentMaterials: editIndependentMaterials,
            updateAllTasks: true,
          },
          scheduleId: scheduleId ?? undefined,
        });

        toast({
          title: language === "ru" ? "Сохранено" : "Saved",
          description: language === "ru"
            ? "Тип акта из существующего акта применён к текущей работе"
            : "Act type from existing act applied to current task",
          duration: 2000,
        });
        setEditOpen(false);
      } else {
        // Scenario: changing type for all tasks in act (templateChange)
        // Re-send request with updateAllTasks: true
        setActConflictDialogOpen(false);
        setActConflictData(null);
        
        const durationNum = Number(editDurationDays.trim() || "1");
        const nextActNumber = editActNumber.trim() === "" ? null : Number(editActNumber);
        const nextActTemplateId = editActTemplateId.trim() === "" ? null : Number(editActTemplateId);
        const nextQuantity = editQuantity.trim() === "" ? null : Number(editQuantity);
        const nextUnit = editUnit.trim() || null;
        
        await patchTask.mutateAsync({
          id: selectedTask.id,
          patch: {
            startDate: editStartDate,
            durationDays: durationNum,
            actNumber: nextActNumber,
            actTemplateId: nextActTemplateId,
            quantity: nextQuantity,
            unit: nextUnit,
            projectDrawings: editProjectDrawings.trim() ? editProjectDrawings : null,
            normativeRefs: editNormativeRefs.trim() ? editNormativeRefs : null,
            executiveSchemes: (editExecutiveSchemes ?? []).filter((s) => String(s?.title ?? "").trim().length > 0),
            updateAllTasks: true, // Confirmed by user
          },
          scheduleId: scheduleId ?? undefined,
        });
        
        toast({
          title: language === "ru" ? "Сохранено" : "Saved",
          description: language === "ru" ? "Тип акта изменён для всех задач" : "Act type changed for all tasks",
          duration: 2000,
        });
        setEditOpen(false);
      }
    } catch (err: any) {
      toast({
        title: t.errorTitle,
        description: err?.message || t.updateError,
        variant: "destructive",
      });
    }
  };

  const handleActConflictReject = () => {
    // Close conflict dialog and return to editing
    setActConflictDialogOpen(false);
    setActConflictData(null);
  };

  const [viewOffsetDays, setViewOffsetDays] = useState(0);
  // 15.2 Period switcher: шаг навигации
  const [viewPeriod, setViewPeriod] = useState<"week" | "month">("month");
  const navStep = viewPeriod === "week" ? 7 : 30;

  const viewCalendarStart = useMemo(
    () => format(addDays(parseISO(calendarStart), viewOffsetDays), "yyyy-MM-dd"),
    [calendarStart, viewOffsetDays],
  );

  return (
    <ResponsiveShell
      className="bg-background bg-grain"
      title={t.title}
      subtitle={
        currentObject?.title
          ? `${language === "ru" ? "ОБЪЕКТ" : "OBJECT"}: ${currentObject.title}`
          : undefined
      }
      showObjectSelector
    >

      <div className="flex-1 px-3 py-4 pb-24 lg:px-6 w-full max-w-none">
        <div className="max-w-5xl lg:max-w-none mx-auto w-full space-y-3">
          {/* Управляющий блок */}
          <div className="mx-0 bg-card border border-border/60 rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">
                {language === "ru" ? "ИСТОЧНИК ДАННЫХ" : "DATA SOURCE"}
              </p>
              <div className="flex gap-2">
                <Select
                  value={sourceSelectValue}
                  onValueChange={(v) => {
                    if (v === sourceSelectValue) return;
                    if (v === "works") {
                      requestChangeSource("works");
                      return;
                    }
                    if (v.startsWith("estimate:")) {
                      const raw = v.split(":")[1];
                      const nextId = Number(raw);
                      if (Number.isFinite(nextId) && nextId > 0) {
                        requestChangeSource("estimate", nextId);
                      }
                    }
                  }}
                >
                  <SelectTrigger className="flex-1 h-10 rounded-xl text-[14px] font-medium" disabled={!scheduleId || !schedule}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="works">{language === "ru" ? "ВОР (Ведомость работ)" : "Works (BoQ)"}</SelectItem>
                    {estimates.length === 0 ? (
                      <SelectItem value="estimate:0" disabled>
                        {language === "ru" ? "Нет смет (импортируйте на /works)" : "No estimates (import on /works)"}
                      </SelectItem>
                    ) : (
                      estimates.map((e) => (
                        <SelectItem key={e.id} value={`estimate:${e.id}`}>
                          {language === "ru" ? "Смета" : "Estimate"}: {String((e as any).code ?? "").trim() ? `${(e as any).code} ` : ""}{e.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="h-10 px-3 rounded-xl gap-1.5 text-primary border-primary/30"
                  onClick={handleBootstrap}
                  disabled={!scheduleId || bootstrapFromWorks.isPending || bootstrapFromEstimate.isPending}
                  data-testid="button-schedule-bootstrap"
                >
                  {(bootstrapFromWorks.isPending || bootstrapFromEstimate.isPending)
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <RefreshCw className="h-4 w-4" />}
                  <span className="text-[13px]">{language === "ru" ? "Обновить" : "Refresh"}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* 15.1 Info-card «График сформирован» */}
          {!isLoadingSchedule && schedule && tasks.length > 0 && (
            <OdooCard>
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-[--o-radius-md] bg-[--p50] flex items-center justify-center text-[--p500] shrink-0">
                    <BarChart2 className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[--g900]">
                      {language === "ru" ? "График сформирован" : "Schedule ready"}
                    </p>
                    <p className="text-[11px] text-[--g500]">
                      {tasks.length} {language === "ru" ? "задач" : "tasks"} ·{" "}
                      {sourceType === "estimate"
                        ? (language === "ru" ? "источник: смета" : "source: estimate")
                        : (language === "ru" ? "источник: ВОР" : "source: BoQ")}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-[--g500] tabular-nums shrink-0">
                  {calendarStart && format(parseISO(calendarStart), "d MMM", { locale: language === "ru" ? ru : enUS })}
                  {" — "}
                  {(schedule as any)?.calendarEnd && format(parseISO(String((schedule as any).calendarEnd)), "d MMM yyyy", { locale: language === "ru" ? ru : enUS })}
                </p>
              </div>
            </OdooCard>
          )}

          {defaultError || scheduleError ? (
            <OdooCard className="text-sm text-destructive">
              {t.errorLoad}
            </OdooCard>
          ) : isLoadingDefault || isLoadingSchedule ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : tasks.length === 0 ? (
            <OdooCard>
              <div className="text-base font-semibold mb-1">{t.emptyTitle}</div>
              <div className="text-sm text-muted-foreground mb-4">
                {sourceType === "estimate"
                  ? (estimates.length === 0
                      ? (language === "ru" ? "Нет смет. Импортируйте смету на /works и выберите её как источник." : "No estimates. Import an estimate on /works and select it as the source.")
                      : (language === "ru" ? "Выберите смету как источник и нажмите «Создать»." : "Select an estimate as the source and click \"Create\"."))
                  : (works.length === 0 ? t.emptyNoWorks : t.emptyHasWorks)}
              </div>
              <Button
                onClick={handleBootstrap}
                disabled={
                  bootstrapFromWorks.isPending ||
                  bootstrapFromEstimate.isPending ||
                  (sourceType === "works" ? works.length === 0 : estimates.length === 0)
                }
              >
                {(bootstrapFromWorks.isPending || bootstrapFromEstimate.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                {t.bootstrap}
              </Button>
            </OdooCard>
          ) : (
            <>
              {/* Навигация по месяцу */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewOffsetDays((d) => d - navStep)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center">
                    <p className="text-[15px] font-semibold">
                      {format(parseISO(viewCalendarStart), language === "ru" ? "LLLL yyyy" : "MMMM yyyy", {
                        locale: language === "ru" ? ru : enUS,
                      })}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {language === "ru"
                        ? `НЕДЕЛЯ ${format(parseISO(viewCalendarStart), "ww")}`
                        : `WEEK ${format(parseISO(viewCalendarStart), "ww")}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewOffsetDays((d) => d + navStep)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {/* Zoom controls (Task 4.2) */}
                  <div className="flex items-center gap-0.5 bg-muted/40 rounded-full p-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 min-h-0 rounded-full"
                      disabled={zoomLevel === 0}
                      onClick={() => setZoomLevel((z) => Math.max(0, z - 1) as 0 | 1 | 2 | 3)}
                      aria-label={language === "ru" ? "Уменьшить масштаб" : "Zoom out"}
                    >
                      <ZoomOut className="h-3 w-3" />
                    </Button>
                    <span className="text-[11px] font-medium px-1 min-w-[28px] text-center tabular-nums">
                      {ZOOM_CONFIGS[zoomLevel].label}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 min-h-0 rounded-full"
                      disabled={zoomLevel === 3}
                      onClick={() => setZoomLevel((z) => Math.min(3, z + 1) as 0 | 1 | 2 | 3)}
                      aria-label={language === "ru" ? "Увеличить масштаб" : "Zoom in"}
                    >
                      <ZoomIn className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* 15.2 Period switcher */}
                  <div className="flex items-center gap-0.5 bg-muted/40 rounded-full p-0.5">
                    {(["week", "month"] as const).map((p) => (
                      <Button
                        key={p}
                        type="button"
                        variant={viewPeriod === p ? "default" : "ghost"}
                        onClick={() => setViewPeriod(p)}
                        className="h-6 min-h-0 px-2.5 py-0 rounded-full text-[11px] font-medium"
                      >
                        {p === "week"
                          ? (language === "ru" ? "Нед." : "Wk")
                          : (language === "ru" ? "Мес." : "Mo")}
                      </Button>
                    ))}
                  </div>

                  {/* Task filter pills */}
                  <div className="flex items-center gap-1 bg-muted/40 rounded-full p-0.5">
                    {(["all", "with-act", "without-act"] as TaskFilter[]).map((f) => {
                      const labels: Record<TaskFilter, { ru: string; en: string }> = {
                        all: { ru: "Все", en: "All" },
                        "with-act": { ru: "С актом", en: "W/ act" },
                        "without-act": { ru: "Без акта", en: "No act" },
                      };
                      return (
                        <Button
                          key={f}
                          type="button"
                          variant={taskFilter === f ? "default" : "ghost"}
                          onClick={() => setTaskFilter(f)}
                          className={cn(
                            "h-6 min-h-0 px-2.5 py-0 rounded-full text-[11px] font-medium transition-all",
                            taskFilter === f
                              ? "shadow-sm border-0"
                              : "bg-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground"
                          )}
                        >
                          {language === "ru" ? labels[f].ru : labels[f].en}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Легенда цветов (task 15.5) */}
              <div className="flex flex-wrap items-center gap-3 px-1 mb-2">
                {[
                  { color: "var(--success)", label: language === "ru" ? "Завершено" : "Done" },
                  { color: "var(--p500)",    label: language === "ru" ? "В работе" : "In progress" },
                  { color: "var(--danger)",  label: language === "ru" ? "Просрочено" : "Overdue" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[11px] text-[--g600]">{label}</span>
                  </div>
                ))}
              </div>

              {/* Таблица Ганта */}
              <OdooCard className="overflow-hidden" padding="none">
                <CardContent className="p-0">
                <div className="overflow-x-auto">
                {/* Header */}
                <div className="flex border-b bg-muted/20">
                  <div className="w-[160px] md:w-[400px] shrink-0 px-3 py-2">
                    <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      {language === "ru" ? "НАИМЕНОВАНИЕ РАБОТ" : "WORKS"}
                    </div>
                  </div>
                  <div className="flex shrink-0" style={{ width: timelineWidth }}>
                    {Array.from({ length: visibleDays }).map((_, i) => {
                      const d = addDays(parseISO(viewCalendarStart), i);
                      return (
                        <div
                          key={i}
                          className="shrink-0 border-l border-border/40 px-1 py-2 text-[10px] text-muted-foreground"
                          style={{ width: dayWidth }}
                          title={format(d, "yyyy-MM-dd")}
                        >
                          {format(d, "dd")}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Body */}
                <div className="flex">
                  <div className="w-[160px] md:w-[400px] shrink-0 border-r">
                    {filteredTasks.map((task) => {
                      const w = task.workId ? worksById.get(task.workId) : null;
                      const p = task.estimatePositionId ? estimatePositionsById.get(task.estimatePositionId) : null;
                      const title =
                        task.titleOverride ||
                        (sourceType === "estimate"
                          ? (p?.name ?? `${language === "ru" ? "Позиция" : "Position"} #${task.estimatePositionId ?? task.id}`)
                          : (w?.description ?? `${t.task} #${task.id}`));
                      
                      const auxiliaries = task.estimatePositionId ? (auxiliaryPositionsByMainId.get(task.estimatePositionId) ?? []) : [];
                      const hasAuxiliaries = auxiliaries.length > 0;
                      const isExpanded = expandedTaskIds.has(task.id);

                      const codeLabel =
                        sourceType === "estimate"
                          ? (p?.lineNo || p?.code || `ID:${task.estimatePositionId ?? task.id}`)
                          : (w?.code || `ID:${task.workId ?? task.id}`);
                      const unit = sourceType === "estimate" ? String(p?.unit ?? "").trim() : "";

                      const actNumber =
                        typeof task.actNumber === "number" && Number(task.actNumber) > 0
                          ? Number(task.actNumber)
                          : null;
                      const actLabel = language === "ru"
                        ? `акт ${actNumber ?? "-"}`
                        : `act ${actNumber ?? "-"}`;
                      const tzHours =
                        sourceType === "estimate" ? (getLaborManHours(p) ?? 0) : 0;
                      const tzLabel = language === "ru"
                        ? `${formatTzHours(tzHours)} ч`
                        : `${formatTzHours(tzHours)} h`;
                      const brgPeople = 0;
                      const brgLabel = language === "ru"
                        ? `${brgPeople} чел`
                        : `${brgPeople} ppl`;
                      const actTzBrgLine = `${actLabel} · ${tzLabel} · ${brgLabel}`;

                      return (
                        <div key={task.id} className="border-b border-border/40 last:border-b-0">
                          {/* Main task row */}
                          <div className="px-3 py-2" style={{ height: rowHeight, overflow: 'hidden' }}>
                            <div className="flex items-start gap-2">
                              {/* Дата */}
                              <div className="w-10 shrink-0 text-center hidden md:block">
                                <div className="text-[13px] font-semibold leading-tight">
                                  {format(parseISO(String(task.startDate)), "dd", { locale: language === "ru" ? ru : enUS })}
                                </div>
                                <div className="text-[10px] text-muted-foreground uppercase">
                                  {format(parseISO(String(task.startDate)), "MMM", { locale: language === "ru" ? ru : enUS })}
                                </div>
                                <div className="text-[10px] text-muted-foreground uppercase">
                                  {format(parseISO(String(task.startDate)), "EEE", { locale: language === "ru" ? ru : enUS })}
                                </div>
                              </div>

                              {/* Основной контент */}
                              <div className="flex-1 min-w-0">
                                {/* Акт + ТЗ + БРГ (вместо статуса) + actions */}
                                <div className="flex items-center justify-between mb-1">
                                  <span className={cn(
                                    "text-[11px] font-medium px-2 py-0.5 rounded border",
                                    actNumber != null
                                      ? "border-primary/30 bg-primary/10 text-primary"
                                      : "border-border text-muted-foreground bg-muted/40"
                                  )}>
                                    {actTzBrgLine}
                                  </span>
                                  <div className="flex items-center gap-0.5">
                                    {sourceType === "estimate" && hasAuxiliaries && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground/60"
                                        onClick={() => toggleTaskExpanded(task.id)}
                                      >
                                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded ? "rotate-0" : "-rotate-90")} />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground/60 hidden md:inline-flex"
                                      onClick={() => shiftTask(task, -1)}
                                      disabled={patchTask.isPending}
                                      aria-label={t.shiftLeft}
                                    >
                                      <ChevronLeft className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground/60 hidden md:inline-flex"
                                      onClick={() => shiftTask(task, +1)}
                                      disabled={patchTask.isPending}
                                      aria-label={t.shiftRight}
                                    >
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    </Button>
                                    {task.durationDays > 1 && (
                                      <TariffGuard 
                                        feature="SPLIT_TASK"
                                        fallback={
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground/60 opacity-50"
                                            disabled
                                            aria-label={language === "ru" ? "Разделить задачу (требуется Стандарт)" : "Split task (Standard required)"}
                                          >
                                            <Scissors className="h-3.5 w-3.5" />
                                          </Button>
                                        }
                                      >
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-muted-foreground/60"
                                          onClick={() => openSplitDialog(task)}
                                          aria-label={language === "ru" ? "Разделить задачу" : "Split task"}
                                        >
                                          <Scissors className="h-3.5 w-3.5" />
                                        </Button>
                                      </TariffGuard>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground/60"
                                      onClick={() => openEdit(task)}
                                      aria-label={t.edit}
                                    >
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Название */}
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] leading-snug text-foreground line-clamp-1 flex-1">{title}</p>
                                  {task.splitGroupId && splitTasksInfo.has(task.id) && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                                      {splitTasksInfo.get(task.id)!.position}/{splitTasksInfo.get(task.id)!.total}
                                    </Badge>
                                  )}
                                </div>

                                {/* Код + объём */}
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[11px] text-muted-foreground font-mono">{String(codeLabel)}</span>
                                  {(task.quantity != null) && (
                                    <span className="text-[12px] font-semibold text-primary">
                                      {Number(task.quantity).toLocaleString("ru-RU")} {task.unit || unit}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Auxiliary positions (collapsed by default) */}
                          {isExpanded && auxiliaries.map((aux: any, idx: number) => (
                            <div
                              key={`aux-${task.id}-${idx}`}
                              className="pl-12 pr-3 py-1 bg-muted/20 border-b border-border/40 text-xs text-muted-foreground flex items-center"
                              style={{ height: rowHeight }}
                            >
                              <div className="flex items-start gap-2">
                                <span className="font-mono shrink-0">{aux.lineNo || aux.code}</span>
                                <span className="truncate">{aux.name}</span>
                              </div>
                              {/* Quality documents status */}
                              <div className="ml-auto pl-2 shrink-0">
                                {(() => {
                                  const s = (subrowStatuses as any)?.byEstimatePositionId?.[String(aux?.id)];
                                  const status: "none" | "partial" | "ok" = (s?.status ?? "none") as any;
                                  const reason: string | undefined = typeof s?.reason === "string" ? s.reason : undefined;

                                  const label =
                                    status === "ok"
                                      ? (language === "ru" ? "ок" : "ok")
                                      : status === "partial"
                                        ? (language === "ru" ? "частично" : "partial")
                                        : (language === "ru" ? "нет" : "none");

                                  const badgeClassName =
                                    status === "ok"
                                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                      : status === "partial"
                                        ? "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                        : "border-destructive/30 bg-destructive/10 text-destructive";

                                  const tooltip =
                                    reason ??
                                    (status === "ok"
                                      ? (language === "ru" ? "Документы качества: ок" : "Quality docs: ok")
                                      : status === "partial"
                                        ? (language === "ru" ? "Документы качества: частично" : "Quality docs: partial")
                                        : (language === "ru" ? "Документы качества: нет" : "Quality docs: none"));

                                  return (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            className="cursor-pointer"
                                            onClick={() => openLinkDialog(aux)}
                                            aria-label={language === "ru" ? "Привязка материала" : "Link material"}
                                          >
                                            <Badge variant="outline" className={badgeClassName}>
                                              {label}
                                            </Badge>
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                          {tooltip}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  <div
                    className="relative shrink-0"
                    style={{
                      width: timelineWidth,
                      height: scheduleRowLayout.totalRows * rowHeight,
                      backgroundImage:
                        `repeating-linear-gradient(to right, rgba(0,0,0,0.06) 0, rgba(0,0,0,0.06) 1px, transparent 1px, transparent ${dayWidth}px),` +
                        `repeating-linear-gradient(to bottom, rgba(0,0,0,0.04) 0, rgba(0,0,0,0.04) 1px, transparent 1px, transparent ${rowHeight}px)`,
                    }}
                  >
                    {filteredTasks.map((task) => {
                        const start = differenceInCalendarDays(parseISO(String(task.startDate)), parseISO(viewCalendarStart));
                        const left = Math.max(0, start) * dayWidth;
                        const width = Math.max(1, Number(task.durationDays || 1)) * dayWidth;
                        const topRow = scheduleRowLayout.taskTopRowIndexByTaskId.get(task.id) ?? 0;
                        const barHeight = 24; // h-6
                        const top = topRow * rowHeight + Math.max(0, Math.floor((rowHeight - barHeight) / 2));
                        
                        const splitGroupId = task.splitGroupId;
                        const splitColor = getSplitTaskColor(splitGroupId);

                        // Odoo-style bar color by status (task 15.3)
                        const taskEndDate = task.startDate
                          ? addDays(parseISO(String(task.startDate)), Number(task.durationDays || 1) - 1)
                          : null;
                        const isOverdue = !task.actNumber && taskEndDate && taskEndDate < new Date();
                        const ganttBarColor = task.actNumber != null
                          ? "var(--success)"
                          : isOverdue
                            ? "var(--danger)"
                            : "var(--p500)";

                        const barStyle: React.CSSProperties = {
                          left,
                          top,
                          width,
                          ...(splitColor
                            ? { backgroundColor: splitColor, borderLeft: '3px solid', borderColor: splitColor }
                            : { backgroundColor: ganttBarColor }),
                        };

                        return (
                          <button
                            key={task.id}
                            type="button"
                            className={cn(
                              buttonVariants({ variant: "default", size: "sm" }),
                              "absolute h-6 min-h-0 px-2 py-0 rounded-md border-0 text-[10px] leading-none truncate text-white hover:opacity-90"
                            )}
                            style={barStyle}
                            onClick={() => openEdit(task)}
                            title={[
                              task.actNumber != null ? `Акт №${task.actNumber}` : null,
                              splitTasksInfo.has(task.id) 
                                ? `Разделено: ${splitTasksInfo.get(task.id)!.position}/${splitTasksInfo.get(task.id)!.total}`
                                : null,
                              format(parseISO(String(task.startDate)), "dd.MM.yy"),
                              `${task.durationDays ?? 1} д`,
                            ].filter(Boolean).join(" / ")}
                          >
                            {task.actNumber != null ? task.actNumber : "—"}
                          </button>
                        );
                    })}
                  </div>
                </div>
                </div>
                </CardContent>
              </OdooCard>
            </>
          )}
        </div>
      </div>

      <Dialog open={changeSourceDialogOpen} onOpenChange={setChangeSourceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {language === "ru" ? "Смена источника графика" : "Change schedule source"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="text-sm">
              <span className="text-muted-foreground">{language === "ru" ? "Переключение:" : "Switching:"}</span>{" "}
              <span className="font-medium">
                {sourceType === "works"
                  ? (language === "ru" ? "ВОР" : "Works")
                  : (language === "ru" ? "Смета" : "Estimate")}
              </span>{" "}
              →{" "}
              <span className="font-medium">
                {pendingSourceType === "estimate"
                  ? `${language === "ru" ? "Смета" : "Estimate"}: ${
                      estimates.find((e) => e.id === pendingEstimateId)?.name ?? `#${pendingEstimateId ?? ""}`
                    }`
                  : (language === "ru" ? "ВОР" : "Works")}
              </span>
            </div>

            <div className="rounded-md bg-destructive/10 p-3 text-sm space-y-2">
              <p className="font-medium">
                {language === "ru" ? "⚠ Это действие необратимо!" : "⚠ This action is irreversible!"}
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>
                  {language === "ru" 
                    ? `Будут удалены все задачи графика: ${sourceInfo?.tasksCount ?? 0} шт.`
                    : `All schedule tasks will be deleted: ${sourceInfo?.tasksCount ?? 0}`}
                </li>
                <li>
                  {language === "ru"
                    ? `Будут очищены списки работ в актах: ${sourceInfo?.affectedActNumbers.length ?? 0} шт.`
                    : `Work lists in acts will be cleared: ${sourceInfo?.affectedActNumbers.length ?? 0}`}
                </li>
              </ul>
              <p className="text-xs">
                {language === "ru"
                  ? "Сами акты (номера, даты) сохранятся, но их нужно будет заново заполнить из нового графика."
                  : "Acts themselves (numbers, dates) will be preserved, but will need to be refilled from the new schedule."}
              </p>
            </div>

            {(sourceInfo?.tasksCount ?? 0) > 0 && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  {language === "ru" 
                    ? 'Введите "ПОДТВЕРЖДАЮ" для продолжения:' 
                    : 'Type "ПОДТВЕРЖДАЮ" to continue:'}
                </label>
                <Input
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="ПОДТВЕРЖДАЮ"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setChangeSourceDialogOpen(false);
                setConfirmationInput("");
                setPendingSourceType(null);
                setPendingEstimateId(null);
              }}
            >
              {language === "ru" ? "Отмена" : "Cancel"}
            </Button>
            <Button 
              variant="destructive"
              onClick={handleConfirmChangeSource} 
              disabled={
                changeSource.isPending || 
                ((sourceInfo?.tasksCount ?? 0) > 0 && confirmationInput.trim().toUpperCase() !== "ПОДТВЕРЖДАЮ")
              }
            >
              {changeSource.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {language === "ru" ? "Сменить источник" : "Change source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setSelectedTask(null);
        }}
      >
        <DialogContent
          className="sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col touch-pan-y overscroll-contain overflow-x-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t.edit}</DialogTitle>
          </DialogHeader>

          {/* Task editor tabs (Task 4.3) */}
          <Tabs value={editTab} onValueChange={(v) => setEditTab(v as "basic" | "materials" | "docs")} className="flex-1 min-h-0 flex flex-col">
            <PillTabs
              className="shrink-0 px-1 mb-2"
              activeTab={editTab}
              onTabChange={(v) => setEditTab(v as "basic" | "materials" | "docs")}
              tabs={[
                { label: language === "ru" ? "Основное" : "Basic", value: "basic" },
                {
                  label: language === "ru" ? "Материалы" : "Materials",
                  value: "materials",
                  count: (taskMaterialsQuery.data?.length ?? 0) > 0 ? taskMaterialsQuery.data!.length : undefined,
                },
                { label: language === "ru" ? "Документация" : "Docs", value: "docs" },
              ]}
            />

            {/* Tab: Основное */}
            <TabsContent value="basic" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y mt-0 pr-1">
              <div className="grid gap-4 pt-2">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">{language === "ru" ? "Номер акта" : "Act number"}</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={editActNumber}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const digitsOnly = raw.replace(/[^\d]/g, "");
                        setEditActNumber(digitsOnly);
                      }}
                      placeholder={language === "ru" ? "Напр.: 5" : "e.g. 5"}
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">{t.startDate}</label>
                    <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">{t.durationDays}</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={editDurationDays}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                        setEditDurationDays(digitsOnly);
                      }}
                      placeholder="1"
                    />
                  </div>
                </div>

                {/* Act type — inline picker on tablet (Task 4.4) */}
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === "ru" ? "Тип акта (шаблон)" : "Act type (template)"}</label>
                  <Button
                    variant="outline"
                    onClick={() => setActTemplatePickerOpen(true)}
                    className="w-full justify-between font-normal h-9 px-3 text-sm"
                  >
                    <span className={cn("truncate", !selectedActTemplate && "text-muted-foreground")}>
                      {selectedActTemplate
                        ? `${String(selectedActTemplate.code ?? "")} — ${language === "ru" ? String(selectedActTemplate.title ?? "") : String((selectedActTemplate as any).titleEn ?? selectedActTemplate.title ?? "")}`
                        : (language === "ru" ? "Выбрать тип акта" : "Select act type")}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    {language === "ru"
                      ? "При смене типа акта он будет применён ко всем задачам с тем же номером акта."
                      : "When changing act type, it will be applied to all tasks with the same act number."}
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === "ru" ? "Объём работ" : "Work quantity"}</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      className="flex-1"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value)}
                      placeholder={language === "ru" ? "Напр.: 120.5" : "e.g. 120.5"}
                    />
                    <Input
                      className="w-28"
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      placeholder={language === "ru" ? "Ед. изм." : "Unit"}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {language === "ru"
                      ? "Объём независим от справочника ВОР/сметы и попадёт в акт."
                      : "Quantity is independent from the source and will be included in the act."}
                  </div>
                  {quantityExceedWarning && (
                    <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 p-2 text-xs text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                      <span>
                        {language === "ru"
                          ? `Суммарный объём по задачам (${quantityExceedWarning.totalNew.toLocaleString("ru-RU")}) превышает объём в справочнике (${quantityExceedWarning.sourceQty.toLocaleString("ru-RU")}) на ${quantityExceedWarning.excess.toLocaleString("ru-RU")}.`
                          : `Total quantity across tasks (${quantityExceedWarning.totalNew.toLocaleString()}) exceeds the source reference (${quantityExceedWarning.sourceQty.toLocaleString()}) by ${quantityExceedWarning.excess.toLocaleString()}.`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Материалы */}
            <TabsContent value="materials" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y mt-0 pr-1">
              <div className="grid gap-4 pt-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === "ru" ? "Материалы задачи (п.3 АОСР)" : "Task materials (AOSR p.3)"}</label>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedTask) {
                        sessionStorage.setItem("scheduleEditTaskId", String(selectedTask.id));
                        saveEditFormState();
                        navigate("/select-task-materials", {
                          state: { taskId: selectedTask.id }
                        });
                      }
                    }}
                    className="w-full justify-start h-auto py-3 px-4"
                  >
                    <Package className="h-4 w-4 mr-2 shrink-0" />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">
                        {language === "ru" ? "Управление материалами" : "Manage Materials"}
                      </div>
                      {taskMaterialsQuery.isLoading ? (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {language === "ru" ? "Загрузка..." : "Loading..."}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {taskMaterialsQuery.data?.length ?? 0}{" "}
                          {language === "ru" ? "материалов" : "materials"}
                        </div>
                      )}
                    </div>
                  </Button>

                  {/* Independent Materials Toggle (only for split tasks) */}
                  {selectedTask && selectedTask.splitGroupId && (
                    <div className="flex items-center justify-between rounded-md border p-3 bg-muted/20">
                      <div className="flex-1 space-y-0.5">
                        <Label htmlFor="independent-materials" className="text-sm font-medium cursor-pointer">
                          {language === "ru" ? "Независимые материалы" : "Independent Materials"}
                        </Label>
                        <div className="text-xs text-muted-foreground">
                          {editIndependentMaterials
                            ? (language === "ru"
                                ? "Материалы только для этой задачи"
                                : "Materials only for this task")
                            : (language === "ru"
                                ? "Материалы синхронизируются между разделёнными задачами"
                                : "Materials sync across split tasks")}
                        </div>
                      </div>
                      <Switch
                        id="independent-materials"
                        checked={editIndependentMaterials}
                        onCheckedChange={setEditIndependentMaterials}
                      />
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Документация */}
            <TabsContent value="docs" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y mt-0 pr-1">
              <div className="grid gap-4 pt-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === "ru" ? "Исполнительные схемы" : "Executive schemes"}</label>
                  {selectedTask && selectedTask.splitGroupId && !editIndependentMaterials && (
                    <div className="text-xs text-muted-foreground bg-muted/20 rounded-md p-2 border">
                      {language === "ru"
                        ? `Синхронизация: Изменения синхронизируются между ${splitTasksInfo.get(selectedTask.id)?.total ?? 2} разделёнными задачами`
                        : `Sync: Changes sync across ${splitTasksInfo.get(selectedTask.id)?.total ?? 2} split tasks`}
                    </div>
                  )}
                  <ExecutiveSchemesEditor
                    items={editExecutiveSchemes}
                    onChange={setEditExecutiveSchemes}
                    disabled={patchTask.isPending}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === "ru" ? "Номера чертежей проекта" : "Project drawings"}</label>
                  {selectedTask && selectedTask.splitGroupId && !editIndependentMaterials && (
                    <div className="text-xs text-muted-foreground bg-muted/20 rounded-md p-2 border">
                      {language === "ru"
                        ? `Синхронизация: Изменения синхронизируются между ${splitTasksInfo.get(selectedTask.id)?.total ?? 2} разделёнными задачами`
                        : `Sync: Changes sync across ${splitTasksInfo.get(selectedTask.id)?.total ?? 2} split tasks`}
                    </div>
                  )}
                  <Textarea
                    value={editProjectDrawings}
                    onChange={(e) => setEditProjectDrawings(e.target.value)}
                    placeholder={language === "ru" ? "например: КЖ-12, КЖ-13, КЖ-14" : "e.g. KZh-12, KZh-13"}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === "ru" ? "СНиП/ГОСТ/РД" : "Normative references"}</label>
                  {selectedTask && selectedTask.splitGroupId && !editIndependentMaterials && (
                    <div className="text-xs text-muted-foreground bg-muted/20 rounded-md p-2 border">
                      {language === "ru"
                        ? `Синхронизация: Изменения синхронизируются между ${splitTasksInfo.get(selectedTask.id)?.total ?? 2} разделёнными задачами`
                        : `Sync: Changes sync across ${splitTasksInfo.get(selectedTask.id)?.total ?? 2} split tasks`}
                    </div>
                  )}
                  <Textarea
                    value={editNormativeRefs}
                    onChange={(e) => setEditNormativeRefs(e.target.value)}
                    placeholder={language === "ru" ? "например: СП 70.13330.2012, СП 63.13330" : "e.g. SP 70.13330.2012"}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex flex-row gap-2 pt-2 shrink-0">
            <Button variant="outline" className="flex-1" onClick={() => {
              setEditOpen(false);
              setSelectedTask(null);
            }}>
              {t.cancel}
            </Button>
            <Button className="flex-1" onClick={saveEdit} disabled={patchTask.isPending}>
              {patchTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline act template picker (Task 4.4 — modal stacking) */}
      <Dialog open={actTemplatePickerOpen} onOpenChange={(open) => {
        setActTemplatePickerOpen(open);
        if (!open) setActTemplateSearch("");
      }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Выбрать тип акта" : "Select act type"}</DialogTitle>
          </DialogHeader>
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 h-9"
              placeholder={language === "ru" ? "Поиск шаблона..." : "Search template..."}
              value={actTemplateSearch}
              onChange={(e) => setActTemplateSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {Object.entries(groupedActTemplates).map(([category, tpls]) => {
              const filtered = actTemplateSearch.trim()
                ? tpls.filter((t) =>
                    `${t.code} ${t.title} ${(t as any).titleEn ?? ""}`.toLowerCase().includes(actTemplateSearch.toLowerCase())
                  )
                : tpls;
              if (filtered.length === 0) return null;
              return (
                <div key={category} className="mb-2">
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted/30 sticky top-0">
                    {category}
                  </div>
                  {filtered.map((tpl) => {
                    const isSelected = String(tpl.id) === editActTemplateId;
                    const label = language === "ru" ? tpl.title : (tpl as any).titleEn ?? tpl.title;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors min-h-[44px]",
                          isSelected && "bg-primary/10"
                        )}
                        onClick={() => {
                          setEditActTemplateId(String(tpl.id));
                          setActTemplatePickerOpen(false);
                          setActTemplateSearch("");
                        }}
                      >
                        <span className="text-xs font-mono text-muted-foreground shrink-0 w-14">{tpl.code}</span>
                        <span className="flex-1 text-sm">{label}</span>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {editActTemplateId && (
              <button
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors min-h-[44px] border-t text-muted-foreground"
                onClick={() => {
                  setEditActTemplateId("");
                  setActTemplatePickerOpen(false);
                  setActTemplateSearch("");
                }}
              >
                <span className="text-sm">{language === "ru" ? "Снять выбор" : "Clear selection"}</span>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Act type conflict dialog */}
      <Dialog open={actConflictDialogOpen} onOpenChange={setActConflictDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === "ru" ? "Конфликт типа акта" : "Act type conflict"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Template info block — shared across all conflict kinds */}
            <p className="text-sm text-muted-foreground">
              {language === "ru"
                ? `В акте №${actConflictData?.actNumber ?? ""} назначен тип:`
                : `Act #${actConflictData?.actNumber ?? ""} has assigned type:`}
            </p>

            {actConflictData?.currentTemplateId && (
              <div className="p-3 border rounded-lg bg-muted/50">
                <div className="text-sm font-medium">
                  {(() => {
                    const tpl = (templatesData?.templates ?? []).find(
                      (t: any) => t.id === actConflictData.currentTemplateId
                    );
                    if (!tpl) return `ID: ${actConflictData.currentTemplateId}`;
                    return `${String(tpl.code ?? "")} — ${
                      language === "ru"
                        ? String(tpl.title ?? "")
                        : String((tpl as any).titleEn ?? tpl.title ?? "")
                    }`;
                  })()}
                </div>
              </div>
            )}

            {/* Question text depends on conflict kind */}
            <p className="text-sm">
              {actConflictData?.conflictKind === "actNumberAssign" && (
                language === "ru"
                  ? "Назначить этот тип текущей задаче?"
                  : "Assign this type to the current task?"
              )}
              {actConflictData?.conflictKind === "actNumberChange" && (
                language === "ru"
                  ? "Добавить текущую работу в акт с этим типом?"
                  : "Add current task to this act with this type?"
              )}
              {actConflictData?.conflictKind === "templateChange" && (() => {
                const newTpl = (templatesData?.templates ?? []).find(
                  (t: any) => t.id === Number(editActTemplateId)
                );
                const newTplLabel = newTpl
                  ? `${String(newTpl.code ?? "")} — ${language === "ru" ? String(newTpl.title ?? "") : String((newTpl as any).titleEn ?? newTpl.title ?? "")}`
                  : editActTemplateId || "—";
                return language === "ru"
                  ? `Изменить тип для всех задач акта (ещё ${actConflictData?.otherTasksCount ?? 0} задач) на «${newTplLabel}»?`
                  : `Change type for all tasks in act (${actConflictData?.otherTasksCount ?? 0} more tasks) to "${newTplLabel}"?`;
              })()}
              {!actConflictData?.conflictKind && (
                language === "ru" ? "Применить тип к текущей задаче?" : "Apply type to current task?"
              )}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleActConflictReject}>
              {language === "ru" ? "Нет" : "No"}
            </Button>
            <Button onClick={handleActConflictAccept}>
              {language === "ru" ? "Да" : "Yes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link estimate subrow to project material (MVP) */}
      <Dialog
        open={linkDialogOpen}
        onOpenChange={(open) => {
          setLinkDialogOpen(open);
          if (!open) {
            setLinkTargetAux(null);
            setLinkMaterialSearch("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Документы качества: привязка материала" : "Quality docs: material link"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            {linkTargetAux ? (
              <div className="text-xs text-muted-foreground">
                <div className="font-mono">
                  {String(linkTargetAux.lineNo ?? linkTargetAux.code ?? linkTargetAux.id)}
                </div>
                <div className="text-sm text-foreground">{String(linkTargetAux.name ?? "")}</div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <label className="text-sm font-medium">{language === "ru" ? "Поиск материала" : "Search material"}</label>
              <Input
                value={linkMaterialSearch}
                onChange={(e) => setLinkMaterialSearch(e.target.value)}
                placeholder={language === "ru" ? "Введите часть названия..." : "Type to filter..."}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">{language === "ru" ? "Материал проекта" : "Project material"}</label>
              <Select
                value={linkMaterialId == null ? "" : String(linkMaterialId)}
                onValueChange={(v) => {
                  const id = Number(v);
                  setLinkMaterialId(Number.isFinite(id) && id > 0 ? id : null);
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={language === "ru" ? "Выберите материал" : "Select material"} />
                </SelectTrigger>
                <SelectContent>
                  {(projectMaterials as any[])
                    .map((m) => {
                      const name =
                        String((m as any).nameOverride ?? "").trim() ||
                        ((m as any).catalogMaterialId ? `${language === "ru" ? "Каталог" : "Catalog"} #${(m as any).catalogMaterialId}` : "") ||
                        `${language === "ru" ? "Материал" : "Material"} #${(m as any).id}`;
                      return { id: Number((m as any).id), name };
                    })
                    .filter((m) => {
                      const q = linkMaterialSearch.trim().toLowerCase();
                      if (!q) return true;
                      return m.name.toLowerCase().includes(q);
                    })
                    .slice(0, 200)
                    .map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="text-[11px] text-muted-foreground">
                {language === "ru"
                  ? "Привязка нужна, чтобы вычислять статус документов качества по подстроке сметы."
                  : "Link is used to compute quality documents status for this estimate subrow."}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setLinkDialogOpen(false)}
              disabled={upsertLink.isPending || deleteLink.isPending}
            >
              {language === "ru" ? "Отмена" : "Cancel"}
            </Button>

            <Button
              variant="destructive"
              onClick={async () => {
                const auxId = Number(linkTargetAux?.id);
                if (!Number.isFinite(auxId) || auxId <= 0) return;
                try {
                  await deleteLink.mutateAsync(auxId);
                  setLinkMaterialId(null);
                  setLinkDialogOpen(false);
                } catch (err: any) {
                  toast({
                    title: t.errorTitle,
                    description: err?.message || (language === "ru" ? "Не удалось убрать привязку" : "Failed to remove link"),
                    variant: "destructive",
                  });
                }
              }}
              disabled={upsertLink.isPending || deleteLink.isPending || !linkTargetAux}
            >
              {deleteLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {language === "ru" ? "Убрать привязку" : "Remove link"}
            </Button>

            <Button
              onClick={async () => {
                const auxId = Number(linkTargetAux?.id);
                const estimateId = Number(scheduleEstimateId);
                const projectMaterialId = Number(linkMaterialId);
                if (!Number.isFinite(auxId) || auxId <= 0) return;
                if (!Number.isFinite(estimateId) || estimateId <= 0) return;
                if (!Number.isFinite(projectMaterialId) || projectMaterialId <= 0) return;
                try {
                  await upsertLink.mutateAsync({
                    estimateId,
                    estimatePositionId: auxId,
                    projectMaterialId,
                    batchId: null,
                  });
                  setLinkDialogOpen(false);
                } catch (err: any) {
                  toast({
                    title: t.errorTitle,
                    description: err?.message || (language === "ru" ? "Не удалось сохранить привязку" : "Failed to save link"),
                    variant: "destructive",
                  });
                }
              }}
              disabled={
                upsertLink.isPending ||
                deleteLink.isPending ||
                !linkTargetAux ||
                linkMaterialId == null ||
                scheduleEstimateId == null
              }
            >
              {upsertLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {language === "ru" ? "Сохранить" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Task Dialog */}
      <SplitTaskDialog
        task={taskToSplit}
        open={splitDialogOpen}
        onClose={closeSplitDialog}
        scheduleId={scheduleId ?? null}
        onSplit={handleSplitTask}
        isSubmitting={splitTask.isPending}
      />
    </ResponsiveShell>
  );
}

