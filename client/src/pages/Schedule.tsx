/**
 * @file: Schedule.tsx
 * @description: Экран "График работ" (диаграмма Ганта): дефолтный график, bootstrap задач из ВОР, редактирование startDate/durationDays.
 * @dependencies: shared/routes.ts (контракт), client/src/hooks/use-schedules.ts, client/src/hooks/use-works.ts
 * @created: 2026-01-17
 */

import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/hooks/use-schedules";
import { useActTemplates } from "@/hooks/use-act-templates";
import { useReplaceTaskMaterials, useTaskMaterials } from "@/hooks/use-task-materials";
import { useCurrentObject } from "@/hooks/use-source-data";
import { useProjectMaterials } from "@/hooks/use-materials";
import { ExecutiveSchemesEditor, type ExecutiveSchemeItem } from "@/components/schedule/ExecutiveSchemesEditor";
import {
  TaskMaterialsEditor,
  type ProjectMaterialOption,
  type TaskMaterialEditorItem,
} from "@/components/schedule/TaskMaterialsEditor";
import type { ScheduleTask, Work } from "@shared/schema";
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, RotateCcw, AlertTriangle, ChevronsUpDown, Check, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ru, enUS } from "date-fns/locale";

export default function Schedule() {
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

  const tasks: ScheduleTask[] = schedule?.tasks ?? [];
  const sourceType = schedule?.sourceType ?? 'works';
  const scheduleEstimateId = sourceType === "estimate" ? (schedule?.estimateId ?? null) : null;

  type TaskFilter = 'all' | 'with-act' | 'without-act';
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'with-act') return tasks.filter((t) => t.actNumber != null);
    if (taskFilter === 'without-act') return tasks.filter((t) => !t.actNumber);
    return tasks;
  }, [tasks, taskFilter]);

  const [changeSourceDialogOpen, setChangeSourceDialogOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [pendingSourceType, setPendingSourceType] = useState<'works' | 'estimate' | null>(null);
  const [pendingEstimateId, setPendingEstimateId] = useState<number | null>(null);

  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    const update = () => setIsPortrait(window.innerHeight > window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const [editOpen, setEditOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ScheduleTask | null>(null);
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editDurationDays, setEditDurationDays] = useState<number>(1);
  const [editActNumber, setEditActNumber] = useState<string>("");
  const [editActTemplateId, setEditActTemplateId] = useState<string>("");
  const [actTemplatePopoverOpen, setActTemplatePopoverOpen] = useState(false);
  const [actTemplateSearch, setActTemplateSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [editQuantity, setEditQuantity] = useState<string>("");
  const [editUnit, setEditUnit] = useState<string>("");
  const [editProjectDrawings, setEditProjectDrawings] = useState<string>("");
  const [editNormativeRefs, setEditNormativeRefs] = useState<string>("");
  const [editExecutiveSchemes, setEditExecutiveSchemes] = useState<ExecutiveSchemeItem[]>([]);
  const [editMaterials, setEditMaterials] = useState<TaskMaterialEditorItem[]>([]);

  const { data: estimates = [] } = useEstimates();
  const activeEstimateId = scheduleEstimateId;
  const { data: activeEstimateDetail } = useEstimate(activeEstimateId);

  const { data: subrowStatuses } = useEstimateSubrowStatuses(sourceType === "estimate" ? scheduleId : null);

  const { data: currentObject } = useCurrentObject();
  const objectId = currentObject?.id;
  const { data: projectMaterials = [] } = useProjectMaterials(objectId);
  const { data: templatesData } = useActTemplates();

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
  const replaceTaskMaterials = useReplaceTaskMaterials(selectedTask?.id);

  const projectMaterialOptions: ProjectMaterialOption[] = useMemo(() => {
    return (projectMaterials as any[]).map((m: any) => {
      const label =
        String(m?.nameOverride ?? "").trim() ||
        String(m?.name ?? "").trim() ||
        (m?.catalogMaterial?.name ? String(m.catalogMaterial.name) : "") ||
        `Материал #${String(m?.id)}`;
      return { id: Number(m.id), label };
    });
  }, [projectMaterials]);

  // When dialog opens, load current task_materials
  useEffect(() => {
    if (!editOpen) return;
    const list = (taskMaterialsQuery.data ?? []) as any[];
    setEditMaterials(
      list.map((r) => ({
        projectMaterialId: Number(r.projectMaterialId),
        batchId: r.batchId == null ? null : Number(r.batchId),
        qualityDocumentId: r.qualityDocumentId == null ? null : Number(r.qualityDocumentId),
        note: r.note ?? null,
      })),
    );
  }, [editOpen, taskMaterialsQuery.data]);

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

  const dayWidth = 24;
  const visibleDays = 60;
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
      .reduce((sum, t) => sum + (((t as any).quantity != null) ? Number((t as any).quantity) : 0), 0);
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

  const openEdit = (task: ScheduleTask) => {
    setSelectedTask(task);
    setEditStartDate(String(task.startDate));
    setEditDurationDays(Number(task.durationDays || 1));
    setEditActNumber(task.actNumber == null ? "" : String(task.actNumber));
    setEditActTemplateId((task as any).actTemplateId == null ? "" : String((task as any).actTemplateId));
    const rawQty = (task as any).quantity;
    setEditQuantity(rawQty != null ? String(Number(rawQty)) : "");
    setEditUnit(String((task as any).unit ?? ""));
    setEditProjectDrawings(String((task as any).projectDrawings ?? ""));
    setEditNormativeRefs(String((task as any).normativeRefs ?? ""));
    setEditExecutiveSchemes(Array.isArray((task as any).executiveSchemes) ? ((task as any).executiveSchemes as any) : []);
    setEditOpen(true);
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
          durationDays: editDurationDays,
          actNumber: nextActNumber,
          actTemplateId: nextActTemplateId,
          quantity: nextQuantity,
          unit: nextUnit,
          projectDrawings: editProjectDrawings.trim() ? editProjectDrawings : null,
          normativeRefs: editNormativeRefs.trim() ? editNormativeRefs : null,
          executiveSchemes: (editExecutiveSchemes ?? []).filter((s) => String(s?.title ?? "").trim().length > 0),
          // change type for all tasks of this actNumber (with backend warning mechanics)
          updateAllTasks: nextActNumber != null && nextActTemplateId != null ? true : undefined,
        },
        scheduleId: scheduleId ?? undefined,
      });

      await replaceTaskMaterials.mutateAsync({
        items: (editMaterials ?? []).map((it, idx) => ({
          projectMaterialId: it.projectMaterialId,
          batchId: it.batchId ?? null,
          qualityDocumentId: it.qualityDocumentId ?? null,
          note: it.note ?? null,
          orderIndex: idx,
        })),
      });

      setEditOpen(false);
      setSelectedTask(null);
    } catch (err: any) {
      toast({
        title: t.errorTitle,
        description: err?.message || t.updateError,
        variant: "destructive",
      });
    }
  };

  const [viewOffsetDays, setViewOffsetDays] = useState(0);
  const viewCalendarStart = useMemo(
    () => format(addDays(parseISO(calendarStart), viewOffsetDays), "yyyy-MM-dd"),
    [calendarStart, viewOffsetDays],
  );

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header
        title={t.title}
        subtitle={
          currentObject?.title
            ? `${language === "ru" ? "ОБЪЕКТ" : "OBJECT"}: ${currentObject.title}`
            : undefined
        }
      />

      <div className="flex-1 px-3 py-4 pb-24 w-full max-w-none">
        <div className="max-w-5xl mx-auto w-full space-y-3">
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

          {defaultError || scheduleError ? (
            <div className="glass-card rounded-2xl p-4 text-sm text-destructive">
              {t.errorLoad}
            </div>
          ) : isLoadingDefault || isLoadingSchedule ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="glass-card rounded-2xl p-4">
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
            </div>
          ) : (
            <>
              {/* Навигация по месяцу */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewOffsetDays((d) => d - 30)}
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
                    onClick={() => setViewOffsetDays((d) => d + 30)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
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

              {/* Таблица Ганта */}
              <Card className="glass-card overflow-hidden">
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
                                {/* Статус + actions */}
                                <div className="flex items-center justify-between mb-1">
                                  <span className={cn(
                                    "text-[10px] font-medium uppercase px-2 py-0.5 rounded border",
                                    task.actNumber != null
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                      : "border-border text-muted-foreground bg-muted/40"
                                  )}>
                                    {task.actNumber != null
                                      ? (language === "ru" ? "ПРИНЯТО" : "ACCEPTED")
                                      : (language === "ru" ? "В РАБОТЕ" : "IN PROGRESS")}
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
                                <p className="text-[13px] leading-snug text-foreground line-clamp-1">{title}</p>

                                {/* Код + объём */}
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[11px] text-muted-foreground font-mono">{String(codeLabel)}</span>
                                  {((task as any).quantity != null) && (
                                    <span className="text-[12px] font-semibold text-primary">
                                      {Number((task as any).quantity).toLocaleString("ru-RU")} {(task as any).unit || unit}
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
                        return (
                          <button
                            key={task.id}
                            type="button"
                            className={cn(
                              buttonVariants({ variant: "default", size: "sm" }),
                              "absolute h-6 min-h-0 px-2 py-0 rounded-md border-0 bg-primary/80 hover:bg-primary text-[10px] leading-none truncate"
                            )}
                            style={{ left, top, width }}
                            onClick={() => openEdit(task)}
                            title={[
                              task.actNumber != null ? `Акт №${task.actNumber}` : null,
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
              </Card>
            </>
          )}
        </div>
      </div>

      <BottomNav />

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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t.edit}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{language === "ru" ? "Номер акта" : "Act number"}</label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={editActNumber}
                    onChange={(e) => setEditActNumber(e.target.value)}
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
                    type="number"
                    min={1}
                    value={editDurationDays}
                    onChange={(e) => setEditDurationDays(Number(e.target.value || 1))}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">{language === "ru" ? "Тип акта (шаблон)" : "Act type (template)"}</label>
                <Popover open={actTemplatePopoverOpen} onOpenChange={setActTemplatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={actTemplatePopoverOpen}
                      className="w-full justify-between font-normal h-9 px-3 text-sm"
                    >
                      <span className={cn("truncate", !selectedActTemplate && "text-muted-foreground")}>
                        {selectedActTemplate
                          ? `${String(selectedActTemplate.code ?? "")} — ${language === "ru" ? String(selectedActTemplate.title ?? "") : String((selectedActTemplate as any).titleEn ?? selectedActTemplate.title ?? "")}`
                          : (language === "ru" ? "Выбрать тип акта" : "Select act type")}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder={language === "ru" ? "Поиск шаблона..." : "Search template..."}
                        value={actTemplateSearch}
                        onValueChange={setActTemplateSearch}
                      />
                      <CommandList className="max-h-72">
                        <CommandEmpty>{language === "ru" ? "Шаблон не найден" : "No template found"}</CommandEmpty>
                        {Object.entries(groupedActTemplates).map(([categoryKey, templates]) => {
                          const catInfo = (templatesData?.categories as any)?.[categoryKey];
                          const catLabel = language === "ru"
                            ? (catInfo?.name ?? categoryKey)
                            : (catInfo?.nameEn ?? catInfo?.name ?? categoryKey);
                          const isSearching = actTemplateSearch.trim() !== "";
                          const filtered = isSearching
                            ? templates.filter((t: any) => {
                                const title = language === "ru" ? String(t.title ?? "") : String((t as any).titleEn ?? t.title ?? "");
                                const search = actTemplateSearch.toLowerCase();
                                return title.toLowerCase().includes(search) || String(t.code ?? "").toLowerCase().includes(search);
                              })
                            : templates;
                          if (filtered.length === 0) return null;
                          const isCollapsed = !isSearching && collapsedCategories.has(categoryKey);
                          return (
                            <div key={categoryKey}>
                              <button
                                type="button"
                                className="flex w-full items-center justify-between px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer"
                                onClick={() => {
                                  if (isSearching) return;
                                  setCollapsedCategories((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(categoryKey)) next.delete(categoryKey);
                                    else next.add(categoryKey);
                                    return next;
                                  });
                                }}
                              >
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {catLabel}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="secondary" className="text-xs h-4 px-1.5 py-0 leading-none">
                                    {filtered.length}
                                  </Badge>
                                  {!isSearching && (
                                    <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-150", isCollapsed && "-rotate-90")} />
                                  )}
                                </div>
                              </button>
                              {!isCollapsed && filtered.map((tpl: any) => (
                                <CommandItem
                                  key={tpl.id}
                                  value={String(tpl.id)}
                                  onSelect={(val) => {
                                    setEditActTemplateId(val === editActTemplateId ? "" : val);
                                    setActTemplatePopoverOpen(false);
                                    setActTemplateSearch("");
                                  }}
                                  className="pl-4"
                                >
                                  <Check className={cn("mr-2 h-4 w-4 shrink-0", editActTemplateId === String(tpl.id) ? "opacity-100" : "opacity-0")} />
                                  <span className="font-mono text-xs text-muted-foreground mr-2 shrink-0">{String(tpl.code ?? "")}</span>
                                  <span className="truncate">{language === "ru" ? String(tpl.title ?? "") : String((tpl as any).titleEn ?? tpl.title ?? "")}</span>
                                </CommandItem>
                              ))}
                            </div>
                          );
                        })}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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

              <div className="grid gap-2">
                <label className="text-sm font-medium">{language === "ru" ? "Материалы задачи (п.3 АОСР)" : "Task materials (AOSR p.3)"}</label>
                {taskMaterialsQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {language === "ru" ? "Загрузка материалов..." : "Loading materials..."}
                  </div>
                ) : (
                  <TaskMaterialsEditor
                    items={editMaterials}
                    projectMaterials={projectMaterialOptions}
                    onChange={setEditMaterials}
                    disabled={replaceTaskMaterials.isPending}
                  />
                )}
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">{language === "ru" ? "Исполнительные схемы" : "Executive schemes"}</label>
                <ExecutiveSchemesEditor
                  items={editExecutiveSchemes}
                  onChange={setEditExecutiveSchemes}
                  disabled={patchTask.isPending}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">{language === "ru" ? "Номера чертежей проекта" : "Project drawings"}</label>
                <Textarea
                  value={editProjectDrawings}
                  onChange={(e) => setEditProjectDrawings(e.target.value)}
                  placeholder={language === "ru" ? "например: КЖ-12, КЖ-13, КЖ-14" : "e.g. KZh-12, KZh-13"}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">{language === "ru" ? "СНиП/ГОСТ/РД" : "Normative references"}</label>
                <Textarea
                  value={editNormativeRefs}
                  onChange={(e) => setEditNormativeRefs(e.target.value)}
                  placeholder={language === "ru" ? "например: СП 70.13330.2012, СП 63.13330" : "e.g. SP 70.13330.2012"}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={saveEdit} disabled={patchTask.isPending}>
              {patchTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t.save}
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
    </div>
  );
}

