import { A } from '@solidjs/router'
import { For, JSX } from 'solid-js'

type NavKey = 'dashboard' | 'scan' | 'results' | 'settings'

interface SidebarProps {
    active: NavKey
    sidebarContent?: JSX.Element
}

const navItems: Array<{
    key: NavKey
    label: string
    href: string
    icon: string
}> = [
    { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    { key: 'scan', label: 'Scan', href: '/scan', icon: 'search' },
    { key: 'results', label: 'History', href: '/results', icon: 'history' },
    { key: 'settings', label: 'Settings', href: '/settings', icon: 'settings' },
]

export function Sidebar(props: SidebarProps) {
    return (
        <aside class="fixed inset-y-0 left-0 hidden w-72 border-r border-[var(--border)] bg-[color:var(--panel)] lg:flex lg:flex-col">
            <div class="px-6 py-6">
                <h1 class="text-2xl font-extrabold tracking-tight text-[var(--text)]">
                    DevSweep
                </h1>
                <p class="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                    machine inventory
                </p>
            </div>

            <nav class="px-4">
                <For each={navItems}>
                    {(item) => (
                        <A
                            href={item.href}
                            class={`mb-2 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                                props.active === item.key
                                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]'
                                    : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--panel-soft)] hover:text-[var(--text)]'
                            }`}
                        >
                            <span class="material-symbols-outlined text-lg">
                                {item.icon}
                            </span>
                            {item.label}
                        </A>
                    )}
                </For>
            </nav>

            <div class="mt-auto p-4">
                <div class="shell-panel p-4">
                    {props.sidebarContent ?? (
                        <>
                            <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                Local mode
                            </p>
                            <p class="mt-3 text-sm font-semibold text-[var(--text)]">
                                Machine-wide scans stay local to this device.
                            </p>
                            <p class="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                                Scan history, cleanup decisions, and file index
                                data are stored in the sidecar database.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </aside>
    )
}
