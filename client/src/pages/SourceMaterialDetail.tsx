/**
 * @file: SourceMaterialDetail.tsx
 * @description: Мобильная страница-обёртка для полной карточки материала.
 * @dependencies: components/materials/MaterialFullCard
 * @created: 2026-02-01
 */

import { useLocation } from "wouter";
import { ResponsiveShell } from "@/components/ResponsiveShell";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useCurrentObject } from "@/hooks/use-source-data";
import { MaterialFullCard } from "@/components/materials/MaterialFullCard";

export default function SourceMaterialDetail(props: { params: { id: string } }) {
  const id = Number(props.params.id);
  const [, setLocation] = useLocation();
  const currentObject = useCurrentObject();
  const objectId = currentObject.data?.id;

  return (
    <ResponsiveShell className="min-h-screen h-[100dvh] bg-background bg-grain" title="Материал">
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="px-4 pt-4 shrink-0">
          <Button variant="outline" className="w-full rounded-xl" onClick={() => setLocation("/source/materials")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад к материалам
          </Button>
        </div>
        <MaterialFullCard materialId={id} objectId={objectId} />
      </div>
    </ResponsiveShell>
  );
}
