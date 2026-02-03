/**
 * @file: SourceData.tsx
 * @description: Страница анкеты “Исходные данные” (объект, стороны, ответственные лица) для плейсхолдеров АОСР/ЖР.
 * @dependencies: hooks/use-source-data, components/ui/*, lib/i18n
 * @created: 2026-01-27
 */

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useLanguageStore, translations } from "@/lib/i18n";
import { ChevronDown, ChevronRight, FileText, Loader2, Package, Plus, Save, Sparkles, Users, Wrench } from "lucide-react";
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

function demoSourceData(): SourceDataDto {
  return {
    object: {
      title: "ЖК Северный · Корпус 2",
      city: "Москва",
      address: "г. Москва, ул. Примерная, д. 10",
    },
    parties: {
      customer: {
        fullName: 'ООО "Заказчик Девелопмент"',
        shortName: 'ООО "ЗД"',
        inn: "7701234567",
        kpp: "770101001",
        ogrn: "1157746000000",
        sroFullName: 'Ассоциация "СРО СтандартСтрой"',
        sroShortName: 'АССРО "СтандартСтрой"',
        sroOgrn: "1097700000000",
        sroInn: "7700000000",
        addressLegal: "109012, г. Москва, ул. Тестовая, д. 1",
        phone: "+7 (495) 000-00-01",
        email: "customer@example.ru",
      },
      builder: {
        fullName: 'ООО "Генподряд Строй"',
        shortName: 'ООО "ГПС"',
        inn: "7712345678",
        kpp: "771201001",
        ogrn: "1147746000001",
        sroFullName: 'Ассоциация "СРО Строители Москвы"',
        sroShortName: 'АССРО "СМ"',
        sroOgrn: "1107700000001",
        sroInn: "7700000001",
        addressLegal: "115035, г. Москва, наб. Набережная, д. 5",
        phone: "+7 (495) 000-00-02",
        email: "builder@example.ru",
      },
      designer: {
        fullName: 'ООО "ПроектИнжиниринг"',
        shortName: 'ООО "ПИ"',
        inn: "7723456789",
        kpp: "772301001",
        ogrn: "1137746000002",
        sroFullName: 'Ассоциация "СРО Проектировщики РФ"',
        sroShortName: 'АССРО "ПРФ"',
        sroOgrn: "1117700000002",
        sroInn: "7700000002",
        addressLegal: "127055, г. Москва, ул. Инженерная, д. 7",
        phone: "+7 (495) 000-00-03",
        email: "designer@example.ru",
      },
    },
    persons: {
      developer_rep: {
        personName: "Иванов И.И.",
        position: "Инженер заказчика",
        basisText: "доверенность № 1 от 01.01.2026",
        lineText: "Иванов И.И., инженер заказчика",
        signText: "Иванов И.И.",
      },
      contractor_rep: {
        personName: "Петров П.П.",
        position: "Главный инженер проекта",
        basisText: "приказ № 12 от 10.01.2026",
        lineText: "Петров П.П., ГИП",
        signText: "Петров П.П.",
      },
      supervisor_rep: {
        personName: "Сидоров С.С.",
        position: "Инженер стройконтроля",
        basisText: "договор № СК-01/26",
        lineText: "Сидоров С.С., инженер СК",
        signText: "Сидоров С.С.",
      },
      rep_customer_control: {
        personName: "Кузнецов К.К.",
        position: "Руководитель службы стройконтроля заказчика",
        basisText: "приказ № 7 от 05.01.2026",
        lineText: "Кузнецов К.К., руководитель СК",
        signText: "Кузнецов К.К.",
      },
      rep_builder: {
        personName: "Смирнов С.М.",
        position: "Начальник участка",
        basisText: "приказ № 21 от 12.01.2026",
        lineText: "Смирнов С.М., НУ",
        signText: "Смирнов С.М.",
      },
      rep_builder_control: {
        personName: "Васильев В.В.",
        position: "Инженер ПТО",
        basisText: "доверенность № 5 от 15.01.2026",
        lineText: "Васильев В.В., инженер ПТО",
        signText: "Васильев В.В.",
      },
      rep_designer: {
        personName: "Николаев Н.Н.",
        position: "Главный архитектор проекта",
        basisText: "приказ № 3 от 02.01.2026",
        lineText: "Николаев Н.Н., ГАП",
        signText: "Николаев Н.Н.",
      },
      rep_work_performer: {
        personName: "Фёдоров Ф.Ф.",
        position: "Производитель работ",
        basisText: "приказ № 33 от 20.01.2026",
        lineText: "Фёдоров Ф.Ф., прораб",
        signText: "Фёдоров Ф.Ф.",
      },
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

  const fillDemo = () => {
    setDraft(demoSourceData());
    setInitialized(true);
    toast({
      title: language === "ru" ? "Заполнено" : "Filled",
      description:
        language === "ru"
          ? "Все поля заполнены тестовыми данными (не забудьте нажать «Сохранить»)."
          : "All fields were filled with demo data (press “Save” to persist).",
    });
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
    <div className="flex flex-col min-h-screen h-[100dvh] bg-background bg-grain">
      <Header title={t?.title ?? (language === "ru" ? "Исходные" : "Source")} />

      <div className="flex-1 overflow-hidden px-4 py-6 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            {language === "ru" ? "Загрузка..." : "Loading..."}
          </div>
        ) : (
          <div className="h-full flex flex-col gap-4">
            <ScrollArea className="flex-1">
              <div className="pr-2">
                {/* Sticky object selector + address (Roadmap 52-114) */}
                <div className="mb-4 sticky top-14 z-30 bg-background/95 backdrop-blur py-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 justify-between rounded-xl"
                      onClick={() => setObjectDialogOpen(true)}
                    >
                      <span className="truncate">
                        {language === "ru" ? "Объект" : "Object"}:{" "}
                        <span className="font-medium">{draft.object.title || (language === "ru" ? "Объект по умолчанию" : "Default object")}</span>
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-70" />
                    </Button>

                    <Button type="button" size="icon" className="rounded-xl" onClick={save} disabled={isSaving || !isDirty} title="Сохранить">
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>

                    <Button type="button" size="icon" variant="outline" className="rounded-xl" onClick={fillDemo} disabled={isSaving} title="Тестовые данные">
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground truncate">
                    {language === "ru" ? "Адрес" : "Address"}:{" "}
                    <span className="text-foreground/80">
                      {draft.object.address || (language === "ru" ? "Не указан" : "Not set")}
                    </span>
                  </div>
                </div>

                {/* Parties / participants (horizontal scroll) */}
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">{language === "ru" ? "Стороны/участники" : "Parties"}</div>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
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
                        <Card
                          key={role.key}
                          className="min-w-[220px] rounded-xl cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => setPartyDialogRole(role.key)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm font-medium">{role.title}</div>
                              <div className={`h-2 w-2 rounded-full mt-1 ${filled ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                            </div>
                            <div className="mt-2 text-sm leading-snug line-clamp-2">{name}</div>
                            <div className="mt-2 text-xs text-muted-foreground">{inn ? `ИНН ${inn}` : (language === "ru" ? "ИНН не указан" : "INN not set")}</div>
                          </CardContent>
                        </Card>
                      );
                    })}

                    <Card
                      className="min-w-[220px] rounded-xl cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => setPersonsDialogOpen(true)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium">{language === "ru" ? "Ответственные лица" : "Responsible persons"}</div>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="mt-2 text-sm leading-snug line-clamp-2 text-muted-foreground">
                          {language === "ru" ? "Подписанты и основания" : "Signers and authority basis"}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground tabular-nums">
                          {language === "ru"
                            ? `Заполнено: ${personsFilledCount}/8`
                            : `Filled: ${personsFilledCount}/8`}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Sections (cards, not tabs) */}
                <div className="mb-6">
                  <div className="text-sm font-medium mb-2">{language === "ru" ? "Разделы" : "Sections"}</div>
                  <div className="grid gap-3">
                    <Card className="rounded-xl cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setLocation("/source/materials")}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              <Package className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium">{language === "ru" ? "Материалы" : "Materials"}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {language === "ru"
                                  ? "Материалы объекта, партии/поставки, привязки документов"
                                  : "Object materials, batches, document bindings"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium tabular-nums text-muted-foreground">{materialsCount}</div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
                              if (!Number.isFinite(objectId)) {
                                toast({ title: "Нет объекта", description: "Не удалось определить текущий объект", variant: "destructive" });
                                return;
                              }
                              setWizardOpen(true);
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
                      </CardContent>
                    </Card>

                    <Card className="rounded-xl cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setLocation("/source/documents")}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium">{language === "ru" ? "Документы качества" : "Quality documents"}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {language === "ru" ? "Реестр сертификатов/паспортов/протоколов (scope=project)" : "Registry (project scope)"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium tabular-nums text-muted-foreground">{docsCount}</div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
                      </CardContent>
                    </Card>

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

              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {Number.isFinite(objectId) ? (
        <MaterialWizard objectId={objectId as number} open={wizardOpen} onOpenChange={setWizardOpen} />
      ) : null}

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

      <BottomNav />
    </div>
  );
}

