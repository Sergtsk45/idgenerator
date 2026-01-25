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
import { useToast } from "@/hooks/use-toast";
import { useLanguageStore, translations } from "@/lib/i18n";
import { useWorks } from "@/hooks/use-works";
import { useBootstrapScheduleFromWorks, useDefaultSchedule, usePatchScheduleTask, useSchedule } from "@/hooks/use-schedules";
import type { ScheduleTask, Work } from "@shared/schema";
import { GanttChartSquare, Loader2, RefreshCw, ChevronLeft, ChevronRight, Pencil, RotateCcw } from "lucide-react";
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

  const bootstrap = useBootstrapScheduleFromWorks(scheduleId);
  const patchTask = usePatchScheduleTask();

  const tasks: ScheduleTask[] = schedule?.tasks ?? [];

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
  const rowHeight = 44;

  const openEdit = (task: ScheduleTask) => {
    setSelectedTask(task);
    setEditStartDate(String(task.startDate));
    setEditDurationDays(Number(task.durationDays || 1));
    setEditActNumber(task.actNumber == null ? "" : String(task.actNumber));
    setEditOpen(true);
  };

  const handleBootstrap = async () => {
    try {
      const result = await bootstrap.mutateAsync({});
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

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleBootstrap}
                  disabled={!scheduleId || bootstrap.isPending}
                  data-testid="button-schedule-bootstrap"
                >
                  {bootstrap.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {tasks.length === 0 ? t.bootstrap : t.refreshFromWorks}
                </Button>
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
                  {works.length === 0 ? t.emptyNoWorks : t.emptyHasWorks}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <Button onClick={handleBootstrap} disabled={bootstrap.isPending || works.length === 0}>
                  {bootstrap.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  {t.bootstrap}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-card overflow-hidden">
              <CardContent className="p-0">
                {/* Header */}
                <div className="flex border-b bg-muted/20">
                  <div className="w-72 shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground">
                    {t.taskColumn}
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
                  <div className="w-72 shrink-0 border-r">
                    {tasks.map((task) => {
                      const w = worksById.get(task.workId);
                      const title = task.titleOverride || w?.description || `${t.task} #${task.workId}`;
                      return (
                        <div
                          key={task.id}
                          className="px-3 py-2 border-b last:border-b-0 flex items-center gap-2"
                          style={{ height: rowHeight }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-muted-foreground font-mono truncate">
                              {w?.code || `ID:${task.workId}`}
                            </div>
                        {task.actNumber != null ? (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {language === "ru" ? "Акт №" : "Act #"}
                            {task.actNumber}
                          </div>
                        ) : null}
                            <div className="text-sm font-medium truncate">{title}</div>
                          </div>
                          <div className="flex items-center gap-1">
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
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex-1 overflow-x-auto">
                    <div
                      className="relative"
                      style={{
                        width: timelineWidth,
                        height: tasks.length * rowHeight,
                        backgroundImage:
                          `repeating-linear-gradient(to right, rgba(0,0,0,0.06) 0, rgba(0,0,0,0.06) 1px, transparent 1px, transparent ${dayWidth}px),` +
                          `repeating-linear-gradient(to bottom, rgba(0,0,0,0.04) 0, rgba(0,0,0,0.04) 1px, transparent 1px, transparent ${rowHeight}px)`,
                      }}
                    >
                      {tasks.map((task, idx) => {
                        const start = differenceInCalendarDays(parseISO(String(task.startDate)), parseISO(calendarStart));
                        const left = Math.max(0, start) * dayWidth;
                        const width = Math.max(1, Number(task.durationDays || 1)) * dayWidth;
                        const top = idx * rowHeight + 10;
                        return (
                          <button
                            key={task.id}
                            type="button"
                            className="absolute h-6 rounded-md bg-primary/80 hover:bg-primary text-primary-foreground text-[10px] px-2 truncate"
                            style={{ left, top, width }}
                            onClick={() => openEdit(task)}
                            title={`${task.startDate} / ${task.durationDays}d`}
                          >
                            {worksById.get(task.workId)?.code || `#${task.workId}`}
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
    </div>
  );
}

