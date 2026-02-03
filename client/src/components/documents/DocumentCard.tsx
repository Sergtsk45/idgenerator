/**
 * @file: DocumentCard.tsx
 * @description: Карточка документа качества (реестр) / отображение документа в привязках.
 * @dependencies: components/ui/card, components/ui/badge, components/ui/button
 * @created: 2026-02-01
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import type { ReactNode } from "react";

export type DocumentCardModel = {
  id: number;
  docType: string;
  scope: string;
  title?: string | null;
  docNumber?: string | null;
  docDate?: string | null;
  fileUrl?: string | null;
};

export function DocumentCard(props: { doc: DocumentCardModel; onOpen?: () => void; rightSlot?: ReactNode }) {
  const { doc } = props;

  const title = doc.title?.trim() || `${doc.docType}${doc.docNumber ? ` №${doc.docNumber}` : ""}`;

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="font-medium truncate">{title}</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{doc.docType}</Badge>
              <Badge variant="outline">{doc.scope}</Badge>
              {doc.docDate ? <Badge variant="secondary">{doc.docDate}</Badge> : null}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {props.rightSlot}
            <Button variant="outline" size="sm" onClick={props.onOpen} disabled={!props.onOpen}>
              Открыть
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

