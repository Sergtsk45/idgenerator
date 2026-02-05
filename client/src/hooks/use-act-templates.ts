/**
 * @file: use-act-templates.ts
 * @description: React Query хук для каталога шаблонов актов (необходимые акты).
 * @dependencies: /api/act-templates, TanStack Query
 * @created: 2026-02-05
 */

import { useQuery } from "@tanstack/react-query";

export type ActTemplateDto = {
  id: number;
  templateId: string;
  code: string;
  category: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  normativeRef?: string | null;
  isActive?: boolean | null;
};

export type ActTemplatesResponse = {
  templates: ActTemplateDto[];
  categories: Array<{ id: string; title: string } | any>;
};

export function useActTemplates() {
  return useQuery({
    queryKey: ["/api/act-templates"],
    queryFn: async () => {
      const res = await fetch("/api/act-templates", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch act templates");
      return (await res.json()) as ActTemplatesResponse;
    },
  });
}

