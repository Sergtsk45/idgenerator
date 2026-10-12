/**
 * @file: ExtractFromDocumentDialog.tsx
 * @description: Диалог предпросмотра данных, извлечённых AI из загруженного документа.
 *   Показывает найденные поля, предупреждает об отсутствующих, позволяет принять или отменить.
 * @dependencies: use-source-data, @shared/routes, components/ui
 * @created: 2026-10-11
 */

import { useRef } from "react";
import type { SourceDataDto } from "@shared/routes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Loader2, Upload } from "lucide-react";
import { useExtractSourceData } from "@/hooks/use-source-data";
import { useToast } from "@/hooks/use-toast";

// ── helpers ──────────────────────────────────────────────────────────────────

function isFilledStr(v: string | undefined | null) {
  return typeof v === "string" && v.trim().length > 0;
}

interface PartyPreviewProps {
  label: string;
  party: Partial<SourceDataDto["parties"]["customer"]> | undefined;
}

function PartyPreview({ label, party }: PartyPreviewProps) {
  const rows: { key: string; label: string; value: string | undefined }[] = [
    { key: "fullName", label: "Полное наименование", value: party?.fullName },
    { key: "inn", label: "ИНН", value: party?.inn },
    { key: "ogrn", label: "ОГРН/ОГРНИП", value: party?.ogrn },
    { key: "kpp", label: "КПП", value: party?.kpp },
    { key: "addressLegal", label: "Адрес", value: party?.addressLegal },
    { key: "phone", label: "Телефон", value: party?.phone },
    { key: "email", label: "Email", value: party?.email },
  ];

  const hasSome = rows.some((r) => isFilledStr(r.value));

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
          {label}
        </span>
        {hasSome ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
        )}
      </div>
      {hasSome ? (
        <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 space-y-0.5">
          {rows
            .filter((r) => isFilledStr(r.value))
            .map((r) => (
              <div key={r.key} className="flex gap-2 text-xs">
                <span className="text-muted-foreground min-w-[120px] shrink-0">{r.label}:</span>
                <span className="font-medium break-all">{r.value}</span>
              </div>
            ))}
        </div>
      ) : (
        <p className="text-xs text-amber-600 pl-1">Не найдено в документе</p>
      )}
    </div>
  );
}

interface PersonPreviewProps {
  label: string;
  person: Partial<SourceDataDto["persons"]["rep_builder"]> | undefined;
}

function PersonPreview({ label, person }: PersonPreviewProps) {
  const filled = isFilledStr(person?.personName);
  return (
    <div className="flex items-start gap-2 text-xs">
      {filled ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
      )}
      <div>
        <span className="text-muted-foreground">{label}: </span>
        {filled ? (
          <span className="font-medium">
            {person!.personName}
            {person?.position ? `, ${person.position}` : ""}
            {person?.basisText ? ` (${person.basisText})` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface ExtractFromDocumentDialogProps {
  /** Текущий черновик формы — нужен для мёрджа */
  draft: SourceDataDto;
  /** Вызывается с результирующим черновиком после мёрджа */
  onApply: (merged: SourceDataDto) => void;
}

export function ExtractFromDocumentButton({
  draft,
  onApply,
}: ExtractFromDocumentDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const extractMutation = useExtractSourceData();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // сброс для повторной загрузки того же файла

    try {
      const extracted = await extractMutation.mutateAsync(file);
      const merged = mergeSourceData(draft, extracted);
      onApply(merged);
      toast({
        title: "Данные извлечены",
        description: "Форма заполнена на основе документа. Проверьте и сохраните.",
      });
    } catch (err) {
      toast({
        title: "Ошибка извлечения",
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl gap-1.5 text-xs h-8"
        disabled={extractMutation.isPending}
        onClick={() => inputRef.current?.click()}
        title="Заполнить из документа (PDF, DOCX, DOC)"
      >
        {extractMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {extractMutation.isPending ? "Анализирую..." : "Из документа"}
      </Button>
    </>
  );
}

// ── Preview-only dialog (used in SourceData page) ────────────────────────────

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  extracted: Partial<SourceDataDto> | null;
  draft: SourceDataDto;
  onApply: (merged: SourceDataDto) => void;
}

export function ExtractPreviewDialog({
  open,
  onOpenChange,
  extracted,
  draft,
  onApply,
}: PreviewDialogProps) {
  if (!extracted) return null;

  const { parties, persons, object } = extracted;

  const missingParties: string[] = [];
  if (!isFilledStr(parties?.customer?.fullName)) missingParties.push("Заказчик");
  if (!isFilledStr(parties?.builder?.fullName)) missingParties.push("Подрядчик");
  if (!isFilledStr(parties?.designer?.fullName)) missingParties.push("Проектировщик");

  const personLabels: Record<keyof SourceDataDto["persons"], string> = {
    developer_rep: "Представитель застройщика",
    contractor_rep: "Технический заказчик",
    supervisor_rep: "Стройконтроль",
    rep_customer_control: "Заказчик (стройконтроль)",
    rep_builder: "Представитель подрядчика",
    rep_builder_control: "Стройконтроль подрядчика",
    rep_designer: "Представитель проектировщика",
    rep_work_performer: "Производитель работ",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Данные из документа</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-4 py-1">

            {/* Объект */}
            {(isFilledStr(object?.title) || isFilledStr(object?.city)) && (
              <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 space-y-0.5">
                <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-1">Объект</p>
                {isFilledStr(object?.title) && (
                  <div className="flex gap-2 text-xs">
                    <span className="text-muted-foreground min-w-[60px]">Название:</span>
                    <span className="font-medium">{object!.title}</span>
                  </div>
                )}
                {isFilledStr(object?.city) && (
                  <div className="flex gap-2 text-xs">
                    <span className="text-muted-foreground min-w-[60px]">Город:</span>
                    <span className="font-medium">{object!.city}</span>
                  </div>
                )}
                {isFilledStr(object?.address) && (
                  <div className="flex gap-2 text-xs">
                    <span className="text-muted-foreground min-w-[60px]">Адрес:</span>
                    <span className="font-medium">{object!.address}</span>
                  </div>
                )}
              </div>
            )}

            {/* Стороны */}
            <PartyPreview label="Заказчик" party={parties?.customer} />
            <PartyPreview label="Подрядчик" party={parties?.builder} />
            <PartyPreview label="Проектировщик" party={parties?.designer} />

            {/* Ответственные лица */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                Ответственные лица
              </p>
              <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 space-y-1">
                {(Object.keys(personLabels) as (keyof SourceDataDto["persons"])[]).map((role) => (
                  <PersonPreview
                    key={role}
                    label={personLabels[role]}
                    person={persons?.[role]}
                  />
                ))}
              </div>
            </div>

            {/* Предупреждение о пропущенных */}
            {missingParties.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Не найдено: {missingParties.join(", ")}. Заполните вручную.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            className="rounded-xl flex-1"
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button
            className="rounded-xl flex-1"
            onClick={() => {
              onApply(mergeSourceData(draft, extracted));
              onOpenChange(false);
            }}
          >
            Заполнить форму
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── merge helper ─────────────────────────────────────────────────────────────

/**
 * Мёрджит извлечённые AI данные с текущим черновиком.
 * Правило: извлечённое значение перезаписывает черновик только если оно непустое.
 */
export function mergeSourceData(
  draft: SourceDataDto,
  extracted: Partial<SourceDataDto>,
): SourceDataDto {
  const pick = (extracted: string | undefined, current: string | undefined) =>
    isFilledStr(extracted) ? extracted! : (current ?? "");

  const mergeParty = (
    ext: Partial<SourceDataDto["parties"]["customer"]> | undefined,
    cur: SourceDataDto["parties"]["customer"],
  ): SourceDataDto["parties"]["customer"] => ({
    fullName:    pick(ext?.fullName, cur.fullName),
    shortName:   pick(ext?.shortName, cur.shortName),
    inn:         pick(ext?.inn, cur.inn),
    kpp:         pick(ext?.kpp, cur.kpp),
    ogrn:        pick(ext?.ogrn, cur.ogrn),
    sroFullName: pick(ext?.sroFullName, cur.sroFullName),
    sroShortName:pick(ext?.sroShortName, cur.sroShortName),
    sroOgrn:     pick(ext?.sroOgrn, cur.sroOgrn),
    sroInn:      pick(ext?.sroInn, cur.sroInn),
    addressLegal:pick(ext?.addressLegal, cur.addressLegal),
    phone:       pick(ext?.phone, cur.phone),
    email:       pick(ext?.email, cur.email),
  });

  const mergePerson = (
    ext: Partial<SourceDataDto["persons"]["rep_builder"]> | undefined,
    cur: SourceDataDto["persons"]["rep_builder"],
  ): SourceDataDto["persons"]["rep_builder"] => ({
    personName: pick(ext?.personName, cur.personName),
    position:   pick(ext?.position, cur.position),
    basisText:  pick(ext?.basisText, cur.basisText),
    lineText:   pick(ext?.lineText, cur.lineText),
    signText:   pick(ext?.signText, cur.signText),
  });

  return {
    object: {
      title:   pick(extracted.object?.title, draft.object.title),
      address: pick(extracted.object?.address, draft.object.address),
      city:    pick(extracted.object?.city, draft.object.city),
    },
    parties: {
      customer: mergeParty(extracted.parties?.customer, draft.parties.customer),
      builder:  mergeParty(extracted.parties?.builder, draft.parties.builder),
      designer: mergeParty(extracted.parties?.designer, draft.parties.designer),
    },
    persons: {
      developer_rep:       mergePerson(extracted.persons?.developer_rep, draft.persons.developer_rep),
      contractor_rep:      mergePerson(extracted.persons?.contractor_rep, draft.persons.contractor_rep),
      supervisor_rep:      mergePerson(extracted.persons?.supervisor_rep, draft.persons.supervisor_rep),
      rep_customer_control:mergePerson(extracted.persons?.rep_customer_control, draft.persons.rep_customer_control),
      rep_builder:         mergePerson(extracted.persons?.rep_builder, draft.persons.rep_builder),
      rep_builder_control: mergePerson(extracted.persons?.rep_builder_control, draft.persons.rep_builder_control),
      rep_designer:        mergePerson(extracted.persons?.rep_designer, draft.persons.rep_designer),
      rep_work_performer:  mergePerson(extracted.persons?.rep_work_performer, draft.persons.rep_work_performer),
    },
  };
}
