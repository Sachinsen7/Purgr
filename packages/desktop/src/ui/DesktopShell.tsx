import { A } from '@solidjs/router'
import { For, JSX } from 'solid-js'

type NavKey = 'dashboard' | 'scan' | 'results' | 'settings'

interface DesktopShellProps {
    active: NavKey
    eyebrow: string
    topMetric?: string
    rightMeta?: string
    sidebarContent?: JSX.Element
    children: JSX.Element
}

const navItems: Array<{
    key: NavKey
    label: string
    href: string
    icon: string
}> = [
    {
        key: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: 'dashboard',
    },
    { key: 'scan', label: 'Scan', href: '/scan', icon: 'search' },
    { key: 'results', label: 'Results', href: '/results', icon: 'history' },
    { key: 'settings', label: 'Settings', href: '/settings', icon: 'settings' },
]

export function DesktopShell(props: DesktopShellProps) {
    return (
        <div class="min-h-screen bg-[#111319] text-[#e2e2eb]">
            <aside class="fixed inset-y-0 left-0 hidden w-64 border-r border-white/5 bg-[#111319] px-4 py-6 lg:flex lg:flex-col">
                <div class="px-2">
                    <h1 class="font-headline text-xl font-extrabold tracking-tight text-white">
                        DevSweep
                    </h1>
                    <p class="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#57f1db]/45">
                        v0.1.0
                    </p>
                </div>

                <nav class="mt-10 flex-1 space-y-1">
                    <For each={navItems}>
                        {(item) => (
                            <A
                                href={item.href}
                                class={`flex items-center gap-3 rounded-r-xl border-l-2 px-4 py-3 text-sm font-semibold transition ${
                                    props.active === item.key
                                        ? 'border-[#2dd4bf] bg-[#1e1f26] text-[#2dd4bf]'
                                        : 'border-transparent text-[#e2e2eb]/60 hover:bg-[#1e1f26] hover:text-[#e2e2eb]'
                                }`}
                            >
                                <span class="material-symbols-outlined text-lg">
                                    {item.icon}
                                </span>
                                <span>{item.label}</span>
                            </A>
                        )}
                    </For>
                </nav>

                <div class="mt-8 rounded-2xl border border-white/5 bg-[#1e1f26] p-4">
                    {props.sidebarContent ?? (
                        <>
                            <div class="mb-4 flex items-center gap-3">
                                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#2dd4bf]/12 text-sm font-bold text-[#57f1db]">
                                    AD
                                </div>
                                <div>
                                    <p class="text-xs font-bold text-white">
                                        Alex Dev
                                    </p>
                                    <p class="text-[10px] uppercase tracking-[0.24em] text-[#bacac5]/50">
                                        Local Mode
                                    </p>
                                </div>
                            </div>
                            <div class="rounded-xl bg-[#191b22] p-3">
                                <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-[#bacac5]/45">
                                    Plan
                                </p>
                                <p class="mt-2 text-sm font-semibold text-white">
                                    Pro Workspace
                                </p>
                                <p class="mt-1 text-xs text-[#bacac5]/65">
                                    Cloud cleanup disabled, Ollama local.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </aside>

            <div class="lg:pl-64">
                <header class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/5 bg-[#111319]/75 px-6 backdrop-blur-xl lg:px-8">
                    <div class="flex items-center gap-3">
                        <span class="font-mono text-[10px] uppercase tracking-[0.32em] text-[#57f1db]/70">
                            {props.eyebrow}
                        </span>
                    </div>

                    <div class="flex items-center gap-4">
                        <div class="hidden items-center gap-2 rounded-full border border-[#2dd4bf]/20 bg-[#2dd4bf]/10 px-3 py-1.5 md:flex">
                            <span class="h-2 w-2 rounded-full bg-[#57f1db]" />
                            <span class="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#57f1db]">
                                {props.topMetric ?? '3.2GB Cleanable'}
                            </span>
                        </div>
                        {props.rightMeta && (
                            <span class="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-[#bacac5]/45 xl:block">
                                {props.rightMeta}
                            </span>
                        )}
                        <div class="flex items-center gap-3 text-[#bacac5]/70">
                            <span class="material-symbols-outlined cursor-pointer transition hover:text-[#57f1db]">
                                notifications
                            </span>
                            <span class="material-symbols-outlined cursor-pointer transition hover:text-[#57f1db]">
                                help
                            </span>
                        </div>
                    </div>
                </header>

                <main class="min-h-[calc(100vh-4rem)] px-6 py-8 lg:px-8">
                    {props.children}
                </main>
            </div>
        </div>
    )
}
