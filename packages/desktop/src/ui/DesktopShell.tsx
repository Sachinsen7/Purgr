import { useStore } from '@nanostores/solid'
import { JSX } from 'solid-js'
import { $theme } from '../stores/ui'
import { Sidebar } from './Sidebar'

type NavKey = 'dashboard' | 'scan' | 'results' | 'settings'

interface DesktopShellProps {
    active: NavKey
    eyebrow: string
    topMetric?: string
    rightMeta?: string
    sidebarContent?: JSX.Element
    headerActions?: JSX.Element
    children: JSX.Element
}

export function DesktopShell(props: DesktopShellProps) {
    const theme = useStore($theme)

    return (
        <div class="min-h-screen bg-[var(--bg)] text-[var(--text)]">
            <Sidebar active={props.active} sidebarContent={props.sidebarContent} />
            <div class="lg:pl-72">
                <header class="sticky top-0 z-30 border-b border-[var(--border)] bg-[color:var(--panel)]/90 backdrop-blur-xl">
                    <div class="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-4 lg:px-8">
                        <div>
                            <p class="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--text-soft)]">
                                {props.eyebrow}
                            </p>
                            {props.topMetric && (
                                <p class="mt-1 text-sm font-semibold text-[var(--text)]">
                                    {props.topMetric}
                                </p>
                            )}
                        </div>

                        <div class="flex items-center gap-3">
                            {props.rightMeta && (
                                <span class="hidden rounded-full border border-[var(--border)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] xl:inline-flex">
                                    {props.rightMeta}
                                </span>
                            )}
                            {props.headerActions}
                            <span class="rounded-full border border-[var(--border)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                {theme()}
                            </span>
                        </div>
                    </div>
                </header>

                <main class="mx-auto min-h-[calc(100vh-72px)] max-w-[1600px] px-6 py-8 lg:px-8">
                    {props.children}
                </main>
            </div>
        </div>
    )
}
