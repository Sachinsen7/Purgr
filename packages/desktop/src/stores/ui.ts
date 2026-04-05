import { atom } from "nanostores";

// UI state store
export const $sidebarOpen = atom(true);
export const $currentView = atom<"dashboard" | "scan" | "results" | "settings">("dashboard");
export const $theme = atom<"light" | "dark" | "system">("system");
export const $loading = atom(false);

// Actions
export function toggleSidebar() {
  $sidebarOpen.set(!$sidebarOpen.get());
}

export function setCurrentView(view: "dashboard" | "scan" | "results" | "settings") {
  $currentView.set(view);
}

export function setTheme(theme: "light" | "dark" | "system") {
  $theme.set(theme);
}

export function setLoading(loading: boolean) {
  $loading.set(loading);
}