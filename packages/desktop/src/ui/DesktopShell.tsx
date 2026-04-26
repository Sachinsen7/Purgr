import { JSX, createSignal, onMount } from 'solid-js'
import { Sidebar } from './Sidebar'

type NavKey = 'dashboard' | 'scan' | 'results' | 'settings'

interface DesktopShellProps {
    active: NavKey
    eyebrow: string
    topMetric?: string
    rightMeta?: string
    sidebarContent?: JSX.Element
    children: JSX.Element
}

export function DesktopShell(props: DesktopShellProps) {
    const [isHeaderAnimating, setIsHeaderAnimating] = createSignal(true)

    onMount(() => {
        setIsHeaderAnimating(false)
    })

    return (
        <div class="min-h-screen bg-[#111319] text-[#e2e2eb]">
            {/* Single Unified Sidebar */}
            <Sidebar active={props.active} sidebarContent={props.sidebarContent} />

            {/* Main Content Area */}
            <div class="lg:pl-64">
                {/* Animated Header */}
                <header
                    class={`sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/5 bg-[#111319]/75 px-6 backdrop-blur-xl lg:px-8 transition-all duration-500 ${
                        isHeaderAnimating()
                            ? 'translate-y-0 opacity-0'
                            : 'translate-y-0 opacity-100'
                    }`}
                >
                    <div
                        class="flex items-center gap-3 transition-all duration-700 delay-100"
                        style={{
                            opacity: isHeaderAnimating() ? 0 : 1,
                            transform: isHeaderAnimating() ? 'translateY(-8px)' : 'translateY(0)',
                        }}
                    >
                        <span class="font-mono text-[10px] uppercase tracking-[0.32em] text-[#57f1db]/70 relative">
                            {props.eyebrow}
                            <span class="absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r from-[#2dd4bf] to-transparent transition-all duration-500 delay-300" />
                        </span>
                    </div>

                    <div
                        class="flex items-center gap-4 transition-all duration-700 delay-150"
                        style={{
                            opacity: isHeaderAnimating() ? 0 : 1,
                            transform: isHeaderAnimating() ? 'translateY(-8px)' : 'translateY(0)',
                        }}
                    >
                        <div class="hidden items-center gap-2 rounded-full border border-[#2dd4bf]/20 bg-gradient-to-r from-[#2dd4bf]/15 to-[#57f1db]/5 px-3 py-1.5 md:flex hover:border-[#2dd4bf]/40 hover:shadow-[0_4px_16px_rgba(45,212,191,0.12)] transition-all duration-300">
                            <span class="h-2 w-2 rounded-full bg-[#57f1db] animate-pulse" />
                            <span class="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#57f1db]">
                                {props.topMetric ?? '3.2GB Cleanable'}
                            </span>
                        </div>

                        {props.rightMeta && (
                            <span class="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-[#bacac5]/45 xl:block transition-all duration-300 hover:text-[#bacac5]/70">
                                {props.rightMeta}
                            </span>
                        )}

                        <div class="flex items-center gap-3 text-[#bacac5]/70">
                            <button
                                class="material-symbols-outlined cursor-pointer transition-all duration-300 hover:text-[#57f1db] hover:scale-110 active:scale-95"
                                aria-label="Notifications"
                            >
                                notifications
                            </button>
                            <button
                                class="material-symbols-outlined cursor-pointer transition-all duration-300 hover:text-[#57f1db] hover:scale-110 active:scale-95"
                                aria-label="Help"
                            >
                                help
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content with Page Transition Animation */}
                <main
                    class="min-h-[calc(100vh-4rem)] px-6 py-8 lg:px-8 transition-all duration-700 ease-out"
                    style={{
                        opacity: isHeaderAnimating() ? 0.5 : 1,
                        transform: isHeaderAnimating() ? 'translateY(20px)' : 'translateY(0)',
                    }}
                >
                    {props.children}
                </main>
            </div>
        </div>
    )
}
