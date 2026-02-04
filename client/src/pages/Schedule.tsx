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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  useGenerateActsFromSchedule
} from "@/hooks/use-schedules";
import { useCurrentObject } from "@/hooks/use-source-data";
import { useProjectMaterials } from "@/hooks/use-materials";
import type { ScheduleTask, Work } from "@shared/schema";
import { GanttChartSquare, Loader2, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Pencil, RotateCcw, AlertTriangle } from "lucide-react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

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
  const generateActs = useGenerateActsFromSchedule(scheduleId);
  const { data: sourceInfo } = useScheduleSourceInfo(scheduleId);
  const patchTask = usePatchScheduleTask();

  const tasks: ScheduleTask[] = schedule?.tasks ?? [];
  const sourceType = schedule?.sourceType ?? 'works';
  const scheduleEstimateId = sourceType === "estimate" ? (schedule?.estimateId ?? null) : null;
  
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

  const { data: estimates = [] } = useEstimates();
  const activeEstimateId = scheduleEstimateId;
  const { data: activeEstimateDetail } = useEstimate(activeEstimateId);

  const { data: subrowStatuses } = useEstimateSubrowStatuses(sourceType === "estimate" ? scheduleId : null);

  const { data: currentObject } = useCurrentObject();
  const objectId = currentObject?.id;
  const { data: projectMaterials = [] } = useProjectMaterials(objectId);

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
  const rowHeight = 72;

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

  const openEdit = (task: ScheduleTask) => {
    setSelectedTask(task);
    setEditStartDate(String(task.startDate));
    setEditDurationDays(Number(task.durationDays || 1));
    setEditActNumber(task.actNumber == null ? "" : String(task.actNumber));
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

  const handleGenerateActs = async () => {
    try {
      const result = await generateActs.mutateAsync();
      toast({
        title: language === "ru" ? "Акты сформированы" : "Acts generated",
        description: language === "ru"
          ? `Создано: ${result.created}, обновлено: ${result.updated}`
          : `Created: ${result.created}, updated: ${result.updated}`,
      });
    } catch (err: any) {
      toast({
        title: t.errorTitle,
        description: err?.message || "Failed to generate acts",
        variant: "destructive",
      });
    }
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
      await patchTask.mutateAsync({
        id: selectedTask.id,
        patch: {
          startDate: editStartDate,
          durationDays: editDurationDays,
          actNumber: nextActNumber,
        },
        scheduleId: scheduleId ?? undefined,
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

  return (
    <div className="flex flex-col min-h-screen bg-background bg-grain">
      <Header title={t.title} />

      <div className="flex-1 px-3 py-4 pb-24 w-full max-w-none">
        <div className="max-w-5xl mx-auto w-full space-y-3">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <GanttChartSquare className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base">{t.title}</CardTitle>
                  <CardDescription className="text-xs">
                    {isPortrait ? t.rotateHint : t.rotateHintOk}
                  </CardDescription>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {language === "ru" ? "Источник" : "Source"}
                  </div>
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
                    <SelectTrigger className="h-8 text-xs w-[260px]" disabled={!scheduleId || !schedule}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="works">{language === "ru" ? "ВОР (справочник работ)" : "Works (BoQ)"}</SelectItem>
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
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleBootstrap}
                    disabled={!scheduleId || bootstrapFromWorks.isPending || bootstrapFromEstimate.isPending}
                    data-testid="button-schedule-bootstrap"
                  >
                    {(bootstrapFromWorks.isPending || bootstrapFromEstimate.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {tasks.length === 0 ? t.bootstrap : t.refreshFromWorks}
                  </Button>
                  {tasks.length > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-2"
                      onClick={handleGenerateActs}
                      disabled={generateActs.isPending}
                    >
                      {generateActs.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {language === "ru" ? "Сформировать акты" : "Generate acts"}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {defaultError || scheduleError ? (
            <Card className="glass-card">
              <CardContent className="p-4 text-sm text-destructive">
                {t.errorLoad}
              </CardContent>
            </Card>
          ) : isLoadingDefault || isLoadingSchedule ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : tasks.length === 0 ? (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">{t.emptyTitle}</CardTitle>
                <CardDescription className="text-sm">
                  {sourceType === "estimate"
                    ? (estimates.length === 0
                        ? (language === "ru" ? "Нет смет. Импортируйте смету на /works и выберите её как источник." : "No estimates. Import an estimate on /works and select it as the source.")
                        : (language === "ru" ? "Выберите смету как источник и нажмите «Создать»." : "Select an estimate as the source and click “Create”."))
                    : (works.length === 0 ? t.emptyNoWorks : t.emptyHasWorks)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
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
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-card overflow-hidden">
              <CardContent className="p-0">
                {/* Header */}
                <div className="flex border-b bg-muted/20">
                  <div className="w-[420px] shrink-0 flex">
                    <div className="flex-1 px-3 py-2 text-xs font-medium text-muted-foreground">
                      {t.taskColumn}
                    </div>
                    <div className="w-16 px-1 py-2 text-xs font-medium text-muted-foreground text-center border-l border-border/40">
                      {language === "ru" ? "Объём" : "Qty"}
                    </div>
                    <div className="w-16 px-1 py-2 text-xs font-medium text-muted-foreground text-center border-l border-border/40">
                      {language === "ru" ? "ТЗ" : "Labor"}
                    </div>
                  </div>
                  <div className="flex-1 overflow-x-auto">
                    <div className="flex" style={{ width: timelineWidth }}>
                      {Array.from({ length: visibleDays }).map((_, i) => {
                        const d = addDays(parseISO(calendarStart), i);
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
                </div>

                {/* Body */}
                <div className="flex">
                  <div className="w-[420px] shrink-0 border-r">
                    {tasks.map((task) => {
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

                      return (
                        <div key={task.id}>
                          {/* Main task row */}
                          <div
                            className="px-3 py-2 border-b border-border/60"
                            style={{ height: rowHeight }}
                          >
                            <div className="grid h-full grid-cols-[24px_minmax(0,1fr)_4rem_4rem_auto] grid-rows-[auto_auto] gap-x-2 gap-y-1">
                              {/* Expand/collapse button (only for estimate with auxiliaries) */}
                              <div className="row-start-1 col-start-1 flex items-start justify-start">
                                {sourceType === "estimate" && hasAuxiliaries ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={() => toggleTaskExpanded(task.id)}
                                  >
                                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
                                  </Button>
                                ) : (
                                  <div className="w-6 shrink-0" />
                                )}
                              </div>

                              {/* Row 1: № позиции | Акт № | ед. изм. */}
                              <div className="row-start-1 col-start-2 min-w-0">
                                {(() => {
                                  const codeLabel =
                                    sourceType === "estimate"
                                      ? (p?.lineNo || p?.code || `ID:${task.estimatePositionId ?? task.id}`)
                                      : (w?.code || `ID:${task.workId ?? task.id}`);
                                  const actLabel =
                                    task.actNumber != null
                                      ? `${language === "ru" ? "Акт №" : "Act #"}${task.actNumber}`
                                      : null;
                                  const unit = sourceType === "estimate" ? String(p?.unit ?? "").trim() : "";

                                  const sep = (
                                    <span className="px-1 text-muted-foreground/60" aria-hidden="true">
                                      |
                                    </span>
                                  );

                                  return (
                                    <div className="flex items-center text-xs text-muted-foreground min-w-0">
                                      <span className="font-mono truncate">{String(codeLabel)}</span>
                                      {actLabel ? (
                                        <>
                                          {sep}
                                          <span className="truncate">{actLabel}</span>
                                        </>
                                      ) : null}
                                      {unit ? (
                                        <>
                                          {sep}
                                          <span className="truncate">{unit}</span>
                                        </>
                                      ) : null}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Quantity column (Row 1) */}
                              <div className="row-start-1 col-start-3 w-16 text-xs text-muted-foreground text-right px-1 border-l border-border/40">
                                {sourceType === "estimate" ? (() => {
                                  const qty = parseNumeric(p?.quantity);
                                  return qty != null ? qty.toLocaleString(language === "ru" ? "ru-RU" : "en-US") : "—";
                                })() : "—"}
                              </div>

                              {/* Labor column (Row 1) */}
                              <div className="row-start-1 col-start-4 w-16 text-xs text-muted-foreground text-right px-1 border-l border-border/40">
                                {sourceType === "estimate" ? (() => {
                                  const labor = getLaborManHours(p);
                                  return labor != null ? labor.toLocaleString(language === "ru" ? "ru-RU" : "en-US") : "—";
                                })() : "—"}
                              </div>

                              {/* Buttons (Row 1) */}
                              <div className="row-start-1 col-start-5 flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => shiftTask(task, -1)}
                                  disabled={patchTask.isPending}
                                  aria-label={t.shiftLeft}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => shiftTask(task, +1)}
                                  disabled={patchTask.isPending}
                                  aria-label={t.shiftRight}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEdit(task)}
                                  aria-label={t.edit}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </div>

                              {/* Row 2: Title spans under Qty + Labor */}
                              <div className="row-start-2 col-start-2 col-end-5 min-w-0 text-sm font-medium leading-snug whitespace-normal break-words line-clamp-2">
                                {title}
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

                                  const className =
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
                                            <Badge variant="outline" className={className}>
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

                  <div className="flex-1 overflow-x-auto">
                    <div
                      className="relative"
                      style={{
                        width: timelineWidth,
                        height: scheduleRowLayout.totalRows * rowHeight,
                        backgroundImage:
                          `repeating-linear-gradient(to right, rgba(0,0,0,0.06) 0, rgba(0,0,0,0.06) 1px, transparent 1px, transparent ${dayWidth}px),` +
                          `repeating-linear-gradient(to bottom, rgba(0,0,0,0.04) 0, rgba(0,0,0,0.04) 1px, transparent 1px, transparent ${rowHeight}px)`,
                      }}
                    >
                      {tasks.map((task) => {
                        const start = differenceInCalendarDays(parseISO(String(task.startDate)), parseISO(calendarStart));
                        const left = Math.max(0, start) * dayWidth;
                        const width = Math.max(1, Number(task.durationDays || 1)) * dayWidth;
                        const topRow = scheduleRowLayout.taskTopRowIndexByTaskId.get(task.id) ?? 0;
                        const barHeight = 24; // h-6
                        const top = topRow * rowHeight + Math.max(0, Math.floor((rowHeight - barHeight) / 2));
                        return (
                          <button
                            key={task.id}
                            type="button"
                            className="absolute h-6 rounded-md bg-primary/80 hover:bg-primary text-primary-foreground text-[10px] px-2 truncate"
                            style={{ left, top, width }}
                            onClick={() => openEdit(task)}
                            title={`${task.startDate} / ${task.durationDays}d`}
                          >
                            {sourceType === "estimate"
                              ? (task.estimatePositionId
                                  ? (estimatePositionsById.get(task.estimatePositionId)?.lineNo ||
                                      estimatePositionsById.get(task.estimatePositionId)?.code ||
                                      `#${task.estimatePositionId}`)
                                  : `#${task.id}`)
                              : (task.workId ? worksById.get(task.workId)?.code || `#${task.workId}` : `#${task.id}`)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.edit}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
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
              <Input
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
              />
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

