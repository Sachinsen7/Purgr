import { useNavigate } from '@solidjs/router'
import { useStore } from '@nanostores/solid'
import { For, Show } from 'solid-js'
import { $currentScan, $isScanning, $scanHistory } from '../stores/scan'
import { DesktopShell } from '../ui/DesktopShell'

const toolBreakdown = [
    { label: 'VS Code', share: '35%', color: 'bg-[#57f1db]' },
    { label: 'Android', share: '25%', color: 'bg-[#9cd1c6]' },
    { label: 'Python', share: '20%', color: 'bg-[#ffd1aa]' },
    { label: 'Node.js', share: '20%', color: 'bg-[#859490]' },
]

export default function Dashboard() {
    const navigate = useNavigate()
    const currentScan = useStore($currentScan)
    const scanHistory = useStore($scanHistory)
    const isScanning = useStore($isScanning)

    const totalFiles = () =>
        scanHistory().reduce((sum, scan) => sum + scan.totalFiles, 0)
    const pendingReview = () =>
        currentScan()?.results.filter(
            (result) => result.recommendation === 'review'
        ).length ?? 0
    const recentScans = () => scanHistory().slice(-3).reverse()

    return (
        <DesktopShell
            active="dashboard"
            eyebrow="System / Root / Dev"
            topMetric="3.2GB Cleanable"
            rightMeta="dashboard / overview"
        >
            <div class="space-y-8">
                <div class="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
                    <section class="relative overflow-hidden rounded-[28px] border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-8 animate-in fade-in slide-in-from-left duration-700 ease-out">
                        <div class="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#57f1db]/10 blur-[110px] animate-pulse" />
                        <div class="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[#57f1db]/5 to-transparent" />
                        <div class="relative">
                            <p class="font-mono text-[11px] uppercase tracking-[0.28em] text-[#57f1db] animate-in fade-in duration-500 delay-100">
                                System Analysis Complete
                            </p>
                            <h2 class="mt-3 font-headline text-5xl font-extrabold tracking-tight text-white md:text-6xl animate-in fade-in slide-in-from-bottom duration-700 delay-200">
                                47.3{' '}
                                <span class="text-3xl font-medium text-[#bacac5]">
                                    GB
                                </span>
                            </h2>
                            <p class="mt-4 max-w-xl text-sm leading-6 text-[#bacac5] animate-in fade-in duration-700 delay-300">
                                Total developer artifacts detected across
                                caches, extensions, SDKs, and inactive project
                                directories. The current scan flow is ready to
                                continue from the desktop shell.
                            </p>
                            <div class="mt-8 flex flex-wrap gap-3 animate-in fade-in duration-700 delay-400">
                                <button
                                    class="rounded-full bg-gradient-to-br from-[#57f1db] to-[#2dd4bf] px-7 py-3 text-sm font-bold text-[#003731] transition-all duration-300 hover:shadow-[0_0_24px_rgba(87,241,219,0.22)] hover:scale-105 active:scale-95"
                                    disabled={isScanning()}
                                    onClick={() => navigate('/scan')}
                                >
                                    {isScanning()
                                        ? 'Scan Running'
                                        : 'Start Scan'}
                                </button>
                                <button
                                    class="rounded-full bg-[#33343b] px-7 py-3 text-sm font-bold text-white transition-all duration-300 hover:bg-[#373940] hover:scale-105 active:scale-95"
                                    onClick={() => navigate('/results')}
                                >
                                    Manual Review
                                </button>
                            </div>
                        </div>
                    </section>

                    <section class="rounded-[28px] border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-6 animate-in fade-in slide-in-from-right duration-700 ease-out">
                        <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-[#bacac5]/55 animate-in fade-in duration-500 delay-100">
                            Category Breakdown
                        </p>
                        <div class="relative mx-auto mt-8 flex h-40 w-40 items-center justify-center animate-in zoom-in duration-700 delay-200">
                            <div class="absolute inset-0 rounded-full border-[14px] border-[#33343b] animate-spin" style={{'animation-duration': '20s', 'animation-direction': 'reverse'}} />
                            <div class="absolute inset-0 rotate-45 rounded-full border-[14px] border-[#57f1db] border-b-transparent border-r-transparent animate-spin" style={{'animation-duration': '15s'}} />
                            <div class="absolute inset-0 -rotate-12 rounded-full border-[14px] border-[#9cd1c6] border-l-transparent border-t-transparent animate-spin" style={{'animation-duration': '25s', 'animation-direction': 'reverse'}} />
                            <div class="flex flex-col items-center">
                                <span class="font-mono text-xl font-bold text-white">
                                    4
                                </span>
                                <span class="font-mono text-[9px] uppercase tracking-[0.24em] text-[#bacac5]/45">
                                    Tools
                                </span>
                            </div>
                        </div>
                        <div class="mt-8 space-y-3">
                            <For each={toolBreakdown}>
                                {(tool, index) => (
                                    <div class="flex items-center justify-between text-xs text-white/90 transition-all duration-300 hover:text-white animate-in fade-in" style={{
                                        'animation-delay': `${300 + index() * 75}ms`
                                    }}>
                                        <span class="flex items-center gap-2">
                                            <span
                                                class={`h-2 w-2 rounded-full transition-all duration-300 hover:scale-150 ${tool.color}`}
                                            />
                                            {tool.label}
                                        </span>
                                        <span class="font-mono text-[#bacac5]">
                                            {tool.share}
                                        </span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </section>
                </div>

                <div class="grid gap-6 md:grid-cols-3">
                    <article class="rounded-3xl border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-5 transition-all duration-300 hover:bg-[#282a30] hover:shadow-lg hover:scale-105 hover:border-[#57f1db]/30 animate-in fade-in slide-in-from-bottom" style={{'animation-delay': '0ms'}}>
                        <div class="mb-4 flex items-start justify-between">
                            <div class="rounded-xl bg-gradient-to-br from-[#57f1db]/20 to-[#2dd4bf]/10 p-2 text-[#57f1db] transition-all duration-300 group-hover:scale-110">
                                <span class="material-symbols-outlined">
                                    check_circle
                                </span>
                            </div>
                            <span class="rounded-full bg-gradient-to-r from-[#57f1db]/20 to-[#2dd4bf]/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#57f1db]">
                                Recommended
                            </span>
                        </div>
                        <p class="text-xs text-[#bacac5]/65">Safe to delete</p>
                        <p class="mt-1 font-mono text-3xl font-bold text-white">
                            12.4{' '}
                            <span class="text-sm font-normal text-[#bacac5]">
                                GB
                            </span>
                        </p>
                        <div class="mt-4 h-1 overflow-hidden rounded-full bg-[#111319]">
                            <div class="h-full w-[40%] bg-gradient-to-r from-[#57f1db] to-[#2dd4bf] transition-all duration-500" />
                        </div>
                    </article>

                    <article class="rounded-3xl border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-5 transition-all duration-300 hover:bg-[#282a30] hover:shadow-lg hover:scale-105 hover:border-[#ffd1aa]/30 animate-in fade-in slide-in-from-bottom" style={{'animation-delay': '75ms'}}>
                        <div class="mb-4 flex items-start justify-between">
                            <div class="rounded-xl bg-[#ffac5a]/10 p-2 text-[#ffd1aa]">
                                <span class="material-symbols-outlined">
                                    warning
                                </span>
                            </div>
                            <span class="rounded-full bg-[#ffac5a]/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#ffd1aa]">
                                Optional
                            </span>
                        </div>
                        <p class="text-xs text-[#bacac5]/65">
                            Needs manual review
                        </p>
                        <p class="mt-1 font-mono text-3xl font-bold text-white">
                            {pendingReview()}{' '}
                            <span class="text-sm font-normal text-[#bacac5]">
                                items
                            </span>
                        </p>
                        <div class="mt-4 h-1 overflow-hidden rounded-full bg-[#111319]">
                            <div class="h-full w-[60%] bg-gradient-to-r from-[#ffd1aa] to-[#ffac5a] transition-all duration-500" />
                        </div>
                    </article>

                    <article class="rounded-3xl border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-5 transition-all duration-300 hover:bg-[#282a30] hover:shadow-lg hover:scale-105 hover:border-[#ffb4ab]/30 animate-in fade-in slide-in-from-bottom" style={{'animation-delay': '150ms'}}>
                        <div class="mb-4 flex items-start justify-between">
                            <div class="rounded-xl bg-[#ffb4ab]/10 p-2 text-[#ffb4ab]">
                                <span class="material-symbols-outlined">
                                    report
                                </span>
                            </div>
                            <span class="rounded-full bg-[#ffb4ab]/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#ffb4ab]">
                                Observed
                            </span>
                        </div>
                        <p class="text-xs text-[#bacac5]/65">
                            Total files scanned
                        </p>
                        <p class="mt-1 font-mono text-3xl font-bold text-white">
                            {totalFiles().toLocaleString()}
                        </p>
                        <div class="mt-4 h-1 overflow-hidden rounded-full bg-[#111319]">
                            <div class="h-full w-[55%] bg-gradient-to-r from-[#ffb4ab] to-[#ff8a80] transition-all duration-500" />
                        </div>
                    </article>
                </div>

                <div class="grid gap-6 xl:grid-cols-[1.5fr_1fr] animate-in fade-in slide-in-from-bottom duration-700 delay-300">
                    <section class="rounded-[28px] border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-6">
                        <div class="mb-6 flex items-center justify-between">
                            <h3 class="font-headline text-xl font-bold text-white">
                                Recent Activity
                            </h3>
                            <button class="font-mono text-[11px] uppercase tracking-[0.22em] text-[#57f1db]">
                                View Logs
                            </button>
                        </div>

                        <Show
                            when={recentScans().length > 0}
                            fallback={
                                <div class="rounded-2xl border border-dashed border-white/10 bg-[#191b22] p-6 text-sm text-[#bacac5]">
                                    No completed scan history yet. Start a scan
                                    to populate this activity rail.
                                </div>
                            }
                        >
                            <div class="space-y-3">
                                <For each={recentScans()}>
                                    {(scan) => (
                                        <button
                                            class="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left transition hover:bg-[#191b22]"
                                            onClick={() => navigate('/results')}
                                        >
                                            <div class="flex items-center gap-4">
                                                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111319] text-[#57f1db]/70">
                                                    <span class="material-symbols-outlined">
                                                        history
                                                    </span>
                                                </div>
                                                <div>
                                                    <p class="text-sm font-semibold text-white">
                                                        {scan.rootPath}
                                                    </p>
                                                    <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[#bacac5]/50">
                                                        {scan.endTime
                                                            ? new Date(
                                                                  scan.endTime
                                                              ).toLocaleString()
                                                            : 'In progress'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div class="text-right">
                                                <p class="font-mono text-sm font-bold text-[#57f1db]">
                                                    {scan.results.length} items
                                                </p>
                                                <p class="text-[10px] uppercase tracking-[0.18em] text-[#bacac5]/45">
                                                    {scan.status}
                                                </p>
                                            </div>
                                        </button>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </section>

                    <div class="space-y-6">
                        <section class="rounded-[28px] border border-white/5 bg-[#1e1f26] p-6">
                            <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-[#bacac5]/45">
                                Active Toolchains
                            </p>
                            <div class="mt-4 flex flex-wrap gap-2">
                                <For
                                    each={[
                                        'VS Code',
                                        'Android SDK',
                                        'Python',
                                        'Node.js',
                                    ]}
                                >
                                    {(tool, index) => (
                                        <span
                                            class={`rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
                                                index() === 0
                                                    ? 'bg-[#2dd4bf] text-[#003731]'
                                                    : 'bg-[#33343b] text-white'
                                            }`}
                                        >
                                            {tool}
                                        </span>
                                    )}
                                </For>
                            </div>
                        </section>

                        <section class="rounded-[28px] border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-6">
                            <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-[#bacac5]/45">
                                Quick Action
                            </p>
                            <div class="mt-4 rounded-2xl border border-[#57f1db]/15 bg-[#111319] p-4">
                                <div class="flex items-center gap-3">
                                    <span class="material-symbols-outlined text-[#57f1db]">
                                        terminal
                                    </span>
                                    <div class="min-w-0 flex-1">
                                        <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[#bacac5]/45">
                                            Last Path Scanned
                                        </p>
                                        <p class="truncate text-xs text-white/90">
                                            {currentScan()?.rootPath ??
                                                '~/dev/projects/web-app/node_modules'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    class="mt-4 w-full rounded-full border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:border-[#57f1db]/30 hover:bg-[#1e1f26]"
                                    onClick={() => navigate('/scan')}
                                >
                                    Resume Scan Flow
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </DesktopShell>
    )
}
