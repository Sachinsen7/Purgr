import { A } from '@solidjs/router'
import { For, JSX, createSignal, onMount } from 'solid-js'

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

export function Sidebar(props: SidebarProps) {
    const [isAnimating, setIsAnimating] = createSignal(true)

    onMount(() => {
        setIsAnimating(false)
    })

    return (
        <aside
            class={`fixed inset-y-0 left-0 hidden w-64 border-r border-white/5 bg-[#111319] px-4 py-6 lg:flex lg:flex-col transition-all duration-500 ${
                isAnimating() ? 'translate-x-0 opacity-0' : 'translate-x-0 opacity-100'
            }`}
        >
            {/* Logo Section */}
            <div
                class="px-2 transform transition-all duration-700 delay-100"
                style={{ opacity: isAnimating() ? 0 : 1, transform: isAnimating() ? 'translateY(-10px)' : 'translateY(0)' }}
            >
                <h1 class="font-headline text-xl font-extrabold tracking-tight text-white">
                    DevSweep
                </h1>
                <p class="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#57f1db]/45">
                    v0.1.0
                </p>
            </div>

            {/* Navigation Section */}
            <nav class="mt-10 flex-1 space-y-1">
                <For each={navItems}>
                    {(item, index) => (
                        <A
                            href={item.href}
                            class={`flex items-center gap-3 rounded-r-xl border-l-2 px-4 py-3 text-sm font-semibold transition-all duration-300 group cursor-pointer relative overflow-hidden ${
                                props.active === item.key
                                    ? 'border-[#2dd4bf] bg-[#1e1f26] text-[#2dd4bf] shadow-[0_8px_24px_rgba(45,212,191,0.1)]'
                                    : 'border-transparent text-[#e2e2eb]/60 hover:bg-[#1e1f26] hover:text-[#e2e2eb] hover:border-[#2dd4bf]/30'
                            }`}
                            style={{
                                opacity: isAnimating() ? 0 : 1,
                                transform: isAnimating() ? `translateX(-20px)` : 'translateX(0)',
                                transition: `all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${index() * 0.1}s`,
                            }}
                        >
                            <span class="material-symbols-outlined text-lg transition-transform duration-300 group-hover:scale-110 group-hover:text-[#57f1db]">
                                {item.icon}
                            </span>
                            <span class="relative">
                                {item.label}
                                <span
                                    class={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-[#2dd4bf] to-[#57f1db] transition-all duration-300 ${
                                        props.active === item.key ? 'w-full' : 'w-0 group-hover:w-full'
                                    }`}
                                />
                            </span>
                        </A>
                    )}
                </For>
            </nav>

            {/* Footer Section - User Info & Status */}
            <div
                class="mt-8 rounded-2xl border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-4 backdrop-blur-sm transition-all duration-500 hover:border-white/10 hover:shadow-[0_8px_24px_rgba(45,212,191,0.08)]"
                style={{
                    opacity: isAnimating() ? 0 : 1,
                    transform: isAnimating() ? 'translateY(20px)' : 'translateY(0)',
                    transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s',
                }}
            >
                {props.sidebarContent ?? (
                    <>
                        <div class="mb-4 flex items-center gap-3">
                            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#2dd4bf] to-[#57f1db] text-sm font-bold text-[#003731] shadow-[0_4px_12px_rgba(45,212,191,0.25)]">
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
                        <div class="rounded-xl bg-[#111319] p-3 border border-white/5 transition-all duration-300 hover:border-[#2dd4bf]/20">
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
    )
}
