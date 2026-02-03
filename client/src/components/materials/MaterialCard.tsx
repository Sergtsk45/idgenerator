/**
 * @file: MaterialCard.tsx
 * @description: Карточка материала в списке материалов объекта (с агрегатами партий/документов и индикатором готовности к актам).
 * @dependencies: components/ui/card, components/ui/badge, components/ui/button
 * @created: 2026-02-01
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileText, Layers, Package } from "lucide-react";

export type ProjectMaterialListItem = {
  id: number;
  nameOverride?: string | null;
  baseUnitOverride?: string | null;
  batchesCount: number;
  docsCount: number;
  qualityDocsCount: number;
  hasUseInActsQualityDoc: boolean;
  catalogMaterialId?: number | null;
};

export function MaterialCard(props: {
  material: ProjectMaterialListItem;
  title?: string;
  onOpen?: () => void;
}) {
  const { material } = props;

  const title = props.title ?? (material.nameOverride?.trim() || `Материал #${material.id}`);
  const badges = [
    { icon: <Layers className="h-3.5 w-3.5" />, text: `${material.batchesCount} партии` },
    { icon: <FileText className="h-3.5 w-3.5" />, text: `${material.docsCount} док-та` },
  ];

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div className="font-medium truncate">{title}</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {badges.map((b, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {b.icon}
                  {b.text}
                </Badge>
              ))}

              {!material.hasUseInActsQualityDoc && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Не готово для актов
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={props.onOpen} disabled={!props.onOpen}>
              Открыть
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

