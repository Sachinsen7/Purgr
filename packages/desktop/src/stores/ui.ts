import { atom } from 'nanostores'

export const $sidebarOpen = atom(true)
export const $currentView = atom<'dashboard' | 'scan' | 'results' | 'settings'>(
    'dashboard'
)
export const $theme = atom<'light' | 'dark'>('dark')
export const $loading = atom(false)

export function toggleSidebar() {
    $sidebarOpen.set(!$sidebarOpen.get())
}

export function setCurrentView(
    view: 'dashboard' | 'scan' | 'results' | 'settings'
) {
    $currentView.set(view)
}

export function setTheme(theme: 'light' | 'dark') {
    $theme.set(theme)
}

export function setLoading(loading: boolean) {
    $loading.set(loading)
}
