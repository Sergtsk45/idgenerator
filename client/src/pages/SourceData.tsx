/**
 * @file: SourceData.tsx
 * @description: Страница анкеты “Исходные данные” (объект, стороны, ответственные лица) для плейсхолдеров АОСР/ЖР.
 * @dependencies: hooks/use-source-data, components/ui/*, lib/i18n
 * @created: 2026-01-27
 */

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useLanguageStore, translations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, FileText, Loader2, Package, Plus, Save, Users, Wrench, Building2, MapPin } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { OdooCard } from "@/components/ui/odoo-card";
import { Progress } from "@/components/ui/progress";
import { useCreateDocument, useDocuments } from "@/hooks/use-documents";
import { MaterialWizard } from "@/components/materials/MaterialWizard";
import { useProjectMaterials } from "@/hooks/use-materials";
import { useCurrentObject, useSaveSourceData, useSourceData } from "@/hooks/use-source-data";
import type { SourceDataDto } from "@shared/routes";

function emptySourceData(): SourceDataDto {
  return {
    object: { title: "", address: "", city: "" },
    parties: {
      customer: { fullName: "" },
      builder: { fullName: "" },
      designer: { fullName: "" },
    },
    persons: {
      developer_rep: { personName: "" },
      contractor_rep: { personName: "" },
      supervisor_rep: { personName: "" },
      rep_customer_control: { personName: "" },
      rep_builder: { personName: "" },
      rep_builder_control: { personName: "" },
      rep_designer: { personName: "" },
      rep_work_performer: { personName: "" },
    },
  };
}

export default function SourceData() {
  const { language } = useLanguageStore();
  const t: any = (translations as any)[language]?.sourceData ?? {};
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const currentObjectQuery = useCurrentObject();
  const objectId = (currentObjectQuery.data as any)?.id as number | undefined;

  const sourceDataQuery = useSourceData();
  const saveMutation = useSaveSourceData();

  const materialsQuery = useProjectMaterials(objectId);
  const docsQuery = useDocuments({ scope: "project" });
  const createDoc = useCreateDocument();

  const [draft, setDraft] = useState<SourceDataDto>(() => emptySourceData());
  const [initialized, setInitialized] = useState(false);
  const [objectDialogOpen, setObjectDialogOpen] = useState(false);
  const [partyDialogRole, setPartyDialogRole] = useState<"customer" | "builder" | "designer" | null>(null);
  const [personsDialogOpen, setPersonsDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);

  const [docForm, setDocForm] = useState({
    docType: "certificate",
    scope: "project",
    title: "",
    docNumber: "",
    docDate: "",
    fileUrl: "",
  });

  useEffect(() => {
    if (sourceDataQuery.data && !initialized) {
      setDraft(sourceDataQuery.data);
      setInitialized(true);
    }
  }, [initialized, sourceDataQuery.data]);

  const isSaving = saveMutation.isPending;
  const isLoading = sourceDataQuery.isLoading;

  const isDirty = useMemo(() => {
    if (!initialized) return false;
    const baseline = sourceDataQuery.data ?? emptySourceData();
    try {
      return JSON.stringify(draft) !== JSON.stringify(baseline);
    } catch {
      return true;
    }
  }, [draft, initialized, sourceDataQuery.data]);

  const personLabels = useMemo(
    () => ({
      developer_rep: t?.persons?.developer_rep ?? "Представитель заказчика (упрощ.)",
      contractor_rep: t?.persons?.contractor_rep ?? "Представитель подрядчика (упрощ.)",
      supervisor_rep: t?.persons?.supervisor_rep ?? "Стройконтроль/надзор (упрощ.)",
      rep_customer_control: t?.persons?.rep_customer_control ?? "Представитель заказчика / стройконтроль",
      rep_builder: t?.persons?.rep_builder ?? "Представитель подрядчика",
      rep_builder_control: t?.persons?.rep_builder_control ?? "Стройконтроль подрядчика",
      rep_designer: t?.persons?.rep_designer ?? "Представитель проектировщика",
      rep_work_performer: t?.persons?.rep_work_performer ?? "Производитель работ",
    }),
    [t]
  );

  const save = async () => {
    try {
      await saveMutation.mutateAsync(draft);
      toast({
        title: t?.saveSuccessTitle ?? (language === "ru" ? "Сохранено" : "Saved"),
        description: t?.saveSuccessDesc ?? (language === "ru" ? "Исходные данные обновлены" : "Source data updated"),
      });
    } catch (e) {
      toast({
        title: t?.saveErrorTitle ?? (language === "ru" ? "Ошибка" : "Error"),
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const materialsCount = (materialsQuery.data ?? []).length;
  const docsCount = (docsQuery.data ?? []).length;
  const personsFilledCount = useMemo(() => {
    const list = Object.values(draft.persons ?? {});
    return list.filter((p: any) => String(p?.personName ?? "").trim().length > 0).length;
  }, [draft.persons]);

  const submitDocument = async () => {
    try {
      await createDoc.mutateAsync({
        docType: docForm.docType as any,
        scope: docForm.scope as any,
        title: docForm.title || null,
        docNumber: docForm.docNumber || null,
        docDate: docForm.docDate || null,
        validFrom: null,
        validTo: null,
        meta: {},
        fileUrl: docForm.fileUrl || null,
      } as any);
      toast({ title: language === "ru" ? "Создано" : "Created", description: language === "ru" ? "Документ добавлен в реестр" : "Document created" });
      setDocDialogOpen(false);
      setDocForm({ docType: "certificate", scope: "project", title: "", docNumber: "", docDate: "", fileUrl: "" });
    } catch (e) {
      toast({
        title: language === "ru" ? "Ошибка" : "Error",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <ResponsiveShell
      className="min-h-screen h-[100dvh] bg-background bg-grain"
      title={t?.title ?? (language === "ru" ? "Исходные" : "Source")}
      subtitle={
        currentObjectQuery.data?.title
          ? `${language === "ru" ? "ОБЪЕКТ" : "OBJECT"}: ${currentObjectQuery.data.title}`
          : undefined
      }
      showObjectSelector
    >

      {/* Object selector (always above parties/sections) */}
      <div className="sticky top-14 z-30 border-b border-border/40 bg-background/95 backdrop-blur md:top-28">
        <div className="max-w-md lg:max-w-5xl mx-auto px-4 py-2 space-y-2">
          <div className="flex items-center gap-2">
            {/* 16.1 Object selector — Odoo style */}
            <button
              type="button"
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-[--o-radius-lg] bg-[--p50] border border-[--p300] hover:bg-[--p100] transition-colors text-left"
              onClick={() => setObjectDialogOpen(true)}
              data-testid="source-object-selector"
            >
              <Building2 className="h-4 w-4 text-[--p500] shrink-0" strokeWidth={1.5} />
              <span className="flex-1 truncate text-[13px]">
                <span className="text-[--g500]">{language === "ru" ? "Объект" : "Object"}:</span>{" "}
                <span className="font-medium text-[--g900]">
                  {draft.object.title || (language === "ru" ? "Объект по умолчанию" : "Default object")}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-[--p500] shrink-0" />
            </button>

            <Button
              type="button"
              size="icon"
              className="rounded-xl"
              onClick={save}
              disabled={isSaving || !isDirty}
              title={language === "ru" ? "Сохранить" : "Save"}
              data-testid="source-save"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground truncate" data-testid="source-object-address">
            {language === "ru" ? "Адрес" : "Address"}:{" "}
            <span className="text-foreground/80">
              {draft.object.address || (language === "ru" ? "Не указан" : "Not set")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground px-4">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            {language === "ru" ? "Загрузка..." : "Loading..."}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Parties / participants — вне ScrollArea, чтобы горизонтальный свайп работал на мобильных */}
            <div className="max-w-md lg:max-w-5xl mx-auto w-full px-4 pt-4 pb-1 shrink-0">
              <p className="o-overline text-[--g500] mb-2">{language === "ru" ? "СТОРОНЫ / УЧАСТНИКИ" : "PARTIES"}</p>
            </div>
            <div
              className="flex gap-3 overflow-x-auto pb-3 shrink-0 lg:grid lg:grid-cols-4 lg:overflow-x-visible lg:px-4"
              data-testid="parties-grid"
              style={{ paddingLeft: "1rem", paddingRight: "1rem", WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
            >
              {([
                { key: "customer", title: language === "ru" ? "Заказчик" : "Customer" },
                { key: "builder", title: language === "ru" ? "Подрядчик" : "Builder" },
                { key: "designer", title: language === "ru" ? "Проектировщик" : "Designer" },
              ] as const).map((role) => {
                const party = draft.parties[role.key];
                const name = String(party.shortName ?? party.fullName ?? "").trim() || (language === "ru" ? "Не заполнено" : "Not set");
                const inn = String(party.inn ?? "").trim();
                const filled = String(party.fullName ?? "").trim().length > 0;

                return (
                  /* 16.3 Chip участника */
                  <OdooCard
                    key={role.key}
                    hoverable
                    onClick={() => setPartyDialogRole(role.key)}
                    className="min-w-[180px] max-w-[220px] flex-shrink-0 lg:min-w-0 lg:max-w-none lg:flex-shrink-0 cursor-pointer"
                  >
                    <div className="p-3">
                      <p className="o-overline text-[--g500] mb-1">{role.title}</p>
                      <p className="text-[13px] font-medium text-[--g900] line-clamp-2 leading-snug">{name}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        {inn ? (
                          <>
                            <span className="h-4 w-4 rounded-full bg-[--success] flex items-center justify-center shrink-0">
                              <span className="text-white text-[8px] font-bold">✓</span>
                            </span>
                            <span className="text-[11px] text-[--g600] font-mono">ИНН {inn}</span>
                          </>
                        ) : (
                          <>
                            <span className="h-4 w-4 rounded-full border border-[--g300] bg-[--g100] shrink-0" />
                            <span className="text-[11px] text-[--g400]">
                              {language === "ru" ? "ИНН не указан" : "INN not set"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </OdooCard>
                );
              })}

              <OdooCard
                hoverable
                onClick={() => setPersonsDialogOpen(true)}
                className="min-w-[180px] max-w-[220px] flex-shrink-0 lg:min-w-0 lg:max-w-none lg:flex-shrink-0 cursor-pointer"
              >
                <div className="p-3">
                  <p className="o-overline text-[--g500] mb-1">{language === "ru" ? "ЛИЦА" : "PERSONS"}</p>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[--p500] shrink-0" strokeWidth={1.5} />
                    <span className="text-[13px] font-medium text-[--g900]">
                      {language === "ru" ? "Ответственные лица" : "Responsible persons"}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-[--g500] tabular-nums">
                    {language === "ru"
                      ? `Заполнено: ${personsFilledCount}/8`
                      : `Filled: ${personsFilledCount}/8`}
                  </div>
                </div>
              </OdooCard>
            </div>

            <ScrollArea className="flex-1">
              <div className="max-w-md lg:max-w-5xl mx-auto px-4 pr-2 py-4">
                {/* 16.4 Sections overline */}
                <div className="mb-6">
                  <p className="o-overline text-[--g500] mb-2">{language === "ru" ? "РАЗДЕЛЫ" : "SECTIONS"}</p>
                  <div className="grid gap-3 lg:grid-cols-2" data-testid="sections-grid">
                    {/* 16.5 Stat card Материалы с progress bar */}
                    <OdooCard hoverable onClick={() => setLocation("/source/materials")} className="cursor-pointer">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-[--o-radius-md] bg-[--p50] flex items-center justify-center text-[--p500] shrink-0">
                              <Package className="h-5 w-5" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-semibold text-[--g900]">{language === "ru" ? "Материалы" : "Materials"}</p>
                              <p className="text-[11px] text-[--g500] truncate">
                                {language === "ru" ? "Партии, поставки, документы" : "Batches, deliveries, docs"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[15px] font-bold text-[--g900] tabular-nums">{materialsCount}</span>
                            <ChevronRight className="h-4 w-4 text-[--g400]" strokeWidth={1.5} />
                          </div>
                        </div>
                        <Progress
                          value={Math.min(100, materialsCount * 10)}
                          className="h-1 mt-3 bg-[--g200] [&>div]:bg-[--p500]"
                        />
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <Button
                            type="button"
                            variant="odoo-secondary"
                            size="compact"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!Number.isFinite(objectId)) {
                                toast({ title: "Нет объекта", description: "Не удалось определить текущий объект", variant: "destructive" });
                                return;
                              }
                              setWizardOpen(true);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            {language === "ru" ? "+ Поставка" : "+ Delivery"}
                          </Button>
                          <Button
                            type="button"
                            variant="odoo-secondary"
                            size="compact"
                            onClick={(e) => {
                              e.stopPropagation();
                              toast({ title: language === "ru" ? "Скоро" : "Soon", description: language === "ru" ? "Сканирование будет добавлено позже" : "Scan flow will be added later" });
                            }}
                          >
                            📷 {language === "ru" ? "Скан" : "Scan"}
                          </Button>
                        </div>
                      </div>
                    </OdooCard>

                    <OdooCard hoverable onClick={() => setLocation("/source/documents")} className="cursor-pointer">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-[--o-radius-md] bg-[--p50] flex items-center justify-center text-[--p500] shrink-0">
                              <FileText className="h-5 w-5" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-semibold text-[--g900]">{language === "ru" ? "Документы качества" : "Quality documents"}</p>
                              <p className="text-[11px] text-[--g500] truncate">
                                {language === "ru" ? "Сертификаты, паспорта, протоколы" : "Certificates, passports, protocols"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[15px] font-bold text-[--g900] tabular-nums">{docsCount}</span>
                            <ChevronRight className="h-4 w-4 text-[--g400]" strokeWidth={1.5} />
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocDialogOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            {language === "ru" ? "Добавить" : "Add"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={(e) => {
                              e.stopPropagation();
                              toast({ title: language === "ru" ? "Скоро" : "Soon", description: language === "ru" ? "Сканирование будет добавлено позже" : "Scan flow will be added later" });
                            }}
                          >
                            {language === "ru" ? "Скан" : "Scan"}
                          </Button>
                        </div>
                      </div>
                    </OdooCard>

                    <Card
                      className="rounded-xl opacity-70 cursor-not-allowed"
                      onClick={() =>
                        toast({
                          title: language === "ru" ? "Скоро" : "Soon",
                          description: language === "ru" ? "Раздел «Исполнительные схемы» будет добавлен позже" : "As-built schemes will be added later",
                        })
                      }
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                              <Wrench className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium">{language === "ru" ? "Исполнительные схемы" : "As-built schemes"}</div>
                              <div className="text-xs text-muted-foreground truncate">{language === "ru" ? "Скоро" : "Soon"}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium tabular-nums text-muted-foreground">0</div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card
                      className="rounded-xl opacity-70 cursor-not-allowed"
                      onClick={() =>
                        toast({
                          title: language === "ru" ? "Скоро" : "Soon",
                          description: language === "ru" ? "Раздел «Протоколы/испытания» будет добавлен позже" : "Protocols/tests will be added later",
                        })
                      }
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium">{language === "ru" ? "Протоколы / испытания" : "Protocols / tests"}</div>
                              <div className="text-xs text-muted-foreground truncate">{language === "ru" ? "Скоро" : "Soon"}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium tabular-nums text-muted-foreground">0</div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* 16.7 Accordion «Реквизиты объекта» */}
                <Accordion type="single" collapsible className="mt-4">
                  <AccordionItem value="details" className="border border-[--g200] rounded-[--o-radius-lg] px-4">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-[--p500]" strokeWidth={1.5} />
                        <span className="text-[13px] font-medium text-[--g900]">
                          {language === "ru" ? "Реквизиты объекта" : "Object details"}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pb-3 space-y-2 text-[13px]">
                        {[
                          {
                            label: language === "ru" ? "Название" : "Title",
                            value: draft.object.title,
                          },
                          {
                            label: language === "ru" ? "Адрес" : "Address",
                            value: draft.object.address,
                          },
                          {
                            label: language === "ru" ? "Город" : "City",
                            value: (draft.object as any).city,
                          },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex gap-2">
                            <span className="text-[--g500] shrink-0 min-w-[80px]">{label}:</span>
                            <span className="text-[--g800]">
                              {value || <span className="text-[--g400] italic">{language === "ru" ? "Не указан" : "Not set"}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {Number.isFinite(objectId) ? (
        <MaterialWizard objectId={objectId as number} open={wizardOpen} onOpenChange={setWizardOpen} />
      ) : null}

      {/* Плавающая кнопка сохранения */}
      {isDirty && (
        <div className="fixed bottom-20 left-0 right-0 z-40 flex justify-center pointer-events-none md:bottom-6 lg:left-0">
          <Button
            className="pointer-events-auto rounded-full px-6 shadow-lg"
            onClick={save}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {language === "ru" ? "Сохранить изменения" : "Save changes"}
          </Button>
        </div>
      )}

      <Dialog open={objectDialogOpen} onOpenChange={setObjectDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Объект" : "Object"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>{t?.fields?.objectTitle ?? (language === "ru" ? "Название" : "Title")}</Label>
              <Input
                value={draft.object.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, object: { ...prev.object, title: e.target.value } }))}
                className="rounded-xl"
                placeholder={language === "ru" ? "ЖК Северный, корпус 2" : "Project name"}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t?.fields?.objectCity ?? (language === "ru" ? "Город" : "City")}</Label>
              <Input
                value={draft.object.city}
                onChange={(e) => setDraft((prev) => ({ ...prev, object: { ...prev.object, city: e.target.value } }))}
                className="rounded-xl"
                placeholder={language === "ru" ? "Москва" : "City"}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t?.fields?.objectAddress ?? (language === "ru" ? "Адрес" : "Address")}</Label>
              <Input
                value={draft.object.address}
                onChange={(e) => setDraft((prev) => ({ ...prev, object: { ...prev.object, address: e.target.value } }))}
                className="rounded-xl"
                placeholder={language === "ru" ? "Адрес объекта" : "Address"}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setObjectDialogOpen(false)}>
              {language === "ru" ? "Закрыть" : "Close"}
            </Button>
            <Button type="button" className="flex-1 rounded-xl" onClick={async () => { await save(); setObjectDialogOpen(false); }} disabled={isSaving}>
              {language === "ru" ? "Сохранить" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={partyDialogRole != null} onOpenChange={(open) => setPartyDialogRole(open ? partyDialogRole : null)}>
        <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {partyDialogRole === "customer"
                ? language === "ru"
                  ? "Заказчик"
                  : "Customer"
                : partyDialogRole === "builder"
                  ? language === "ru"
                    ? "Подрядчик"
                    : "Builder"
                  : partyDialogRole === "designer"
                    ? language === "ru"
                      ? "Проектировщик"
                      : "Designer"
                    : ""}
            </DialogTitle>
          </DialogHeader>

          {partyDialogRole ? (
            <>
              <ScrollArea className="max-h-[65vh] pr-2">
                <div className="space-y-4 py-2">
                  <div className="grid gap-2">
                    <Label>{t?.fields?.partyFullName ?? (language === "ru" ? "Полное наименование" : "Full name")}</Label>
                    <Input
                      value={draft.parties[partyDialogRole].fullName}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          parties: { ...prev.parties, [partyDialogRole]: { ...prev.parties[partyDialogRole], fullName: e.target.value } },
                        }))
                      }
                      className="rounded-xl"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>{t?.fields?.partyShortName ?? (language === "ru" ? "Краткое наименование" : "Short name")}</Label>
                    <Input
                      value={draft.parties[partyDialogRole].shortName ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          parties: { ...prev.parties, [partyDialogRole]: { ...prev.parties[partyDialogRole], shortName: e.target.value } },
                        }))
                      }
                      className="rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-2">
                      <Label>ИНН</Label>
                      <Input
                        value={draft.parties[partyDialogRole].inn ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            parties: { ...prev.parties, [partyDialogRole]: { ...prev.parties[partyDialogRole], inn: e.target.value } },
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>КПП</Label>
                      <Input
                        value={draft.parties[partyDialogRole].kpp ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            parties: { ...prev.parties, [partyDialogRole]: { ...prev.parties[partyDialogRole], kpp: e.target.value } },
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>ОГРН</Label>
                      <Input
                        value={draft.parties[partyDialogRole].ogrn ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            parties: { ...prev.parties, [partyDialogRole]: { ...prev.parties[partyDialogRole], ogrn: e.target.value } },
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>{t?.fields?.partySroFullName ?? (language === "ru" ? "СРО (полное наименование)" : "SRO full name")}</Label>
                    <Input
                      value={draft.parties[partyDialogRole].sroFullName ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          parties: { ...prev.parties, [partyDialogRole]: { ...prev.parties[partyDialogRole], sroFullName: e.target.value } },
                        }))
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t?.fields?.partySroShortName ?? (language === "ru" ? "СРО (краткое наименование)" : "SRO short name")}</Label>
                    <Input
                      value={draft.parties[partyDialogRole].sroShortName ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          parties: { ...prev.parties, [partyDialogRole]: { ...prev.parties[partyDialogRole], sroShortName: e.target.value } },
                        }))
                      }
                      className="rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>{t?.fields?.partySroOgrn ?? (language === "ru" ? "ОГРН СРО" : "SRO OGRN")}</Label>
                      <Input
                        value={draft.parties[partyDialogRole].sroOgrn ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            parties: { ...prev.parties, [partyDialogRole]: { ...prev.parties[partyDialogRole], sroOgrn: e.target.value } },
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t?.fields?.partySroInn ?? (language === "ru" ? "ИНН СРО" : "SRO INN")}</Label>
                      <Input
                        value={draft.parties[partyDialogRole].sroInn ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            parties: { ...prev.parties, [partyDialogRole]: { ...prev.parties[partyDialogRole], sroInn: e.target.value } },
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>{t?.fields?.partyAddressLegal ?? (language === "ru" ? "Юр. адрес" : "Legal address")}</Label>
                    <Input
                      value={draft.parties[partyDialogRole].addressLegal ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          parties: { ...prev.parties, [partyDialogRole]: { ...prev.parties[partyDialogRole], addressLegal: e.target.value } },
                        }))
                      }
                      className="rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>{t?.fields?.partyPhone ?? (language === "ru" ? "Телефон" : "Phone")}</Label>
                      <Input
                        value={draft.parties[partyDialogRole].phone ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            parties: { ...prev.parties, [partyDialogRole]: { ...prev.parties[partyDialogRole], phone: e.target.value } },
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Email</Label>
                      <Input
                        value={draft.parties[partyDialogRole].email ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            parties: { ...prev.parties, [partyDialogRole]: { ...prev.parties[partyDialogRole], email: e.target.value } },
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setPartyDialogRole(null)}>
                  {language === "ru" ? "Закрыть" : "Close"}
                </Button>
                <Button type="button" className="flex-1 rounded-xl" onClick={async () => { await save(); setPartyDialogRole(null); }} disabled={isSaving}>
                  {language === "ru" ? "Сохранить" : "Save"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={personsDialogOpen} onOpenChange={setPersonsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Ответственные лица" : "Responsible persons"}</DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh] pr-2">
            <div className="space-y-4 py-2">
              {(Object.keys(draft.persons) as Array<keyof SourceDataDto["persons"]>).map((role) => {
                const person = draft.persons[role];
                const setPerson = (patch: Partial<typeof person>) =>
                  setDraft((prev) => ({
                    ...prev,
                    persons: { ...prev.persons, [role]: { ...prev.persons[role], ...patch } },
                  }));

                return (
                  <div key={String(role)} className="rounded-xl border p-4">
                    <div className="font-medium mb-3">{(personLabels as any)[role]}</div>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>{t?.fields?.personName ?? (language === "ru" ? "ФИО" : "Name")}</Label>
                        <Input value={person.personName ?? ""} onChange={(e) => setPerson({ personName: e.target.value })} className="rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>{t?.fields?.personPosition ?? (language === "ru" ? "Должность" : "Position")}</Label>
                        <Input value={person.position ?? ""} onChange={(e) => setPerson({ position: e.target.value })} className="rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>{t?.fields?.personBasisText ?? (language === "ru" ? "Основание (приказ/доверенность)" : "Authority basis")}</Label>
                        <Input value={person.basisText ?? ""} onChange={(e) => setPerson({ basisText: e.target.value })} className="rounded-xl" />
                      </div>

                      <div className="grid gap-2">
                        <Label>{t?.fields?.personLineText ?? (language === "ru" ? "Строка представителя (опц.)" : "Representative line (opt.)")}</Label>
                        <Input value={person.lineText ?? ""} onChange={(e) => setPerson({ lineText: e.target.value })} className="rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>{t?.fields?.personSignText ?? (language === "ru" ? "Подпись (опц.)" : "Signature (opt.)")}</Label>
                        <Input value={person.signText ?? ""} onChange={(e) => setPerson({ signText: e.target.value })} className="rounded-xl" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setPersonsDialogOpen(false)}>
              {language === "ru" ? "Закрыть" : "Close"}
            </Button>
            <Button type="button" className="flex-1 rounded-xl" onClick={async () => { await save(); setPersonsDialogOpen(false); }} disabled={isSaving}>
              {language === "ru" ? "Сохранить" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Добавить документ" : "Add document"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>{language === "ru" ? "Тип" : "Type"}</Label>
              <Select value={docForm.docType} onValueChange={(v) => setDocForm((p) => ({ ...p, docType: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="certificate">certificate</SelectItem>
                  <SelectItem value="declaration">declaration</SelectItem>
                  <SelectItem value="passport">passport</SelectItem>
                  <SelectItem value="protocol">protocol</SelectItem>
                  <SelectItem value="scheme">scheme</SelectItem>
                  <SelectItem value="other">other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Scope</Label>
              <Select value={docForm.scope} onValueChange={(v) => setDocForm((p) => ({ ...p, scope: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">project</SelectItem>
                  <SelectItem value="global">global</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>{language === "ru" ? "Название (опц.)" : "Title (opt.)"}</Label>
              <Input value={docForm.title} onChange={(e) => setDocForm((p) => ({ ...p, title: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="grid gap-2">
              <Label>{language === "ru" ? "Номер" : "Number"}</Label>
              <Input value={docForm.docNumber} onChange={(e) => setDocForm((p) => ({ ...p, docNumber: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="grid gap-2">
              <Label>{language === "ru" ? "Дата" : "Date"}</Label>
              <Input
                type="date"
                value={docForm.docDate}
                onChange={(e) => setDocForm((p) => ({ ...p, docDate: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label>{language === "ru" ? "URL файла (опц.)" : "File URL (opt.)"}</Label>
              <Input value={docForm.fileUrl} onChange={(e) => setDocForm((p) => ({ ...p, fileUrl: e.target.value }))} className="rounded-xl" />
            </div>
          </div>

          <Button onClick={submitDocument} disabled={createDoc.isPending} className="w-full rounded-xl h-12 gap-2">
            {createDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {language === "ru" ? "Создать" : "Create"}
          </Button>
        </DialogContent>
      </Dialog>

    </ResponsiveShell>
  );
}

