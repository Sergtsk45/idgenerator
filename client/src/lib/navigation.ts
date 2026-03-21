/**
 * @file: navigation.ts
 * @description: Единый navigation contract для mobile/tablet shell adapters и правил active-state.
 * @dependencies: lucide-react
 * @created: 2026-03-10
 */

import {
  Building2,
  CalendarRange,
  ClipboardList,
  FileCheck,
  FolderOpen,
  type LucideIcon,
  MessageSquare,
  Settings,
} from "lucide-react";

export type NavigationLabelKey =
  | "home"
  | "homeChat"
  | "works"
  | "schedule"
  | "acts"
  | "worklog"
  | "sourceData"
  | "objects"
  | "settings";

export type NavigationLabels = Record<NavigationLabelKey, string>;

export type NavigationGroup = "primary" | "secondary" | "quickAction";

export type NavigationSurface =
  | "bottomNavMobile"
  | "headerSheetMobile"
  | "headerQuickActionMobile"
  | "shellPrimaryMdUp"
  | "shellSecondaryMdUp"
  | "shellQuickActionMdUp";

type NavigationMatchRule =
  | { type: "exact"; value: string }
  | { type: "prefix"; value: string };

type NavigationSurfaceVisibility = Record<NavigationSurface, boolean>;
type NavigationGroupFilter = NavigationGroup | NavigationGroup[];

export interface NavigationItem {
  id: string;
  href: string;
  labelKey: NavigationLabelKey;
  group: NavigationGroup;
  icon?: LucideIcon;
  surfaceVisibility: NavigationSurfaceVisibility;
  activeMatch: NavigationMatchRule[];
}

const primarySurfaceVisibility: NavigationSurfaceVisibility = {
  bottomNavMobile: true,
  headerSheetMobile: false,
  headerQuickActionMobile: false,
  shellPrimaryMdUp: true,
  shellSecondaryMdUp: false,
  shellQuickActionMdUp: false,
};

const secondarySurfaceVisibility: NavigationSurfaceVisibility = {
  bottomNavMobile: false,
  headerSheetMobile: true,
  headerQuickActionMobile: false,
  shellPrimaryMdUp: false,
  shellSecondaryMdUp: true,
  shellQuickActionMdUp: false,
};

const quickActionSurfaceVisibility: NavigationSurfaceVisibility = {
  bottomNavMobile: false,
  headerSheetMobile: true,
  headerQuickActionMobile: true,
  shellPrimaryMdUp: false,
  shellSecondaryMdUp: false,
  shellQuickActionMdUp: true,
};

const primaryNavigation: NavigationItem[] = [
  {
    id: "works",
    href: "/works",
    labelKey: "works",
    group: "primary",
    icon: ClipboardList,
    surfaceVisibility: primarySurfaceVisibility,
    activeMatch: [{ type: "exact", value: "/works" }],
  },
  {
    id: "schedule",
    href: "/schedule",
    labelKey: "schedule",
    group: "primary",
    icon: CalendarRange,
    surfaceVisibility: primarySurfaceVisibility,
    activeMatch: [{ type: "exact", value: "/schedule" }],
  },
  {
    id: "acts",
    href: "/acts",
    labelKey: "acts",
    group: "primary",
    icon: FileCheck,
    surfaceVisibility: primarySurfaceVisibility,
    activeMatch: [{ type: "exact", value: "/acts" }],
  },
  {
    id: "worklog",
    href: "/worklog",
    labelKey: "worklog",
    group: "primary",
    icon: MessageSquare,
    surfaceVisibility: primarySurfaceVisibility,
    activeMatch: [{ type: "exact", value: "/worklog" }],
  },
  {
    id: "source-data",
    href: "/source-data",
    labelKey: "sourceData",
    group: "primary",
    icon: FolderOpen,
    surfaceVisibility: primarySurfaceVisibility,
    activeMatch: [
      { type: "exact", value: "/source-data" },
      { type: "prefix", value: "/source/materials" },
      { type: "prefix", value: "/source/documents" },
    ],
  },
];

const secondaryNavigation: NavigationItem[] = [
  {
    id: "objects",
    href: "/objects",
    labelKey: "objects",
    group: "secondary",
    icon: Building2,
    surfaceVisibility: secondarySurfaceVisibility,
    activeMatch: [{ type: "exact", value: "/objects" }],
  },
  {
    id: "settings",
    href: "/settings",
    labelKey: "settings",
    group: "secondary",
    icon: Settings,
    surfaceVisibility: secondarySurfaceVisibility,
    activeMatch: [{ type: "exact", value: "/settings" }],
  },
];

const quickActionNavigation: NavigationItem[] = [
  {
    id: "home-chat",
    href: "/",
    labelKey: "homeChat",
    group: "quickAction",
    surfaceVisibility: quickActionSurfaceVisibility,
    activeMatch: [{ type: "exact", value: "/" }],
  },
];

export const navigationManifest = {
  primary: primaryNavigation,
  secondary: secondaryNavigation,
  quickAction: quickActionNavigation,
} as const;

const allNavigationItems = [
  ...navigationManifest.primary,
  ...navigationManifest.secondary,
  ...navigationManifest.quickAction,
];

export function getNavigationItemsForSurface(
  surface: NavigationSurface,
  options?: { groups?: NavigationGroupFilter }
): NavigationItem[] {
  return allNavigationItems.filter(
    (item) => item.surfaceVisibility[surface] && matchesNavigationGroup(item, options?.groups)
  );
}

export function getQuickActionForSurface(surface: NavigationSurface): NavigationItem | null {
  return getNavigationItemsForSurface(surface, { groups: "quickAction" })[0] ?? null;
}

export function getNavigationLabel(item: NavigationItem, labels: NavigationLabels): string {
  return labels[item.labelKey];
}

export function isNavigationItemActive(item: NavigationItem, pathname: string): boolean {
  const normalizedPathname = normalizePathname(pathname);

  return item.activeMatch.some((rule) => {
    const normalizedRuleValue = normalizePathname(rule.value);

    if (rule.type === "exact") {
      return normalizedPathname === normalizedRuleValue;
    }

    return matchesPathPrefix(normalizedPathname, normalizedRuleValue);
  });
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function matchesNavigationGroup(
  item: NavigationItem,
  groups?: NavigationGroupFilter
): boolean {
  if (!groups) {
    return true;
  }

  return Array.isArray(groups) ? groups.includes(item.group) : item.group === groups;
}
