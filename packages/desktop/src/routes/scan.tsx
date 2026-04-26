import { useNavigate } from '@solidjs/router'
import { useStore } from '@nanostores/solid'
import { createSignal, For, onCleanup, Show } from 'solid-js'
import { IPC } from '../lib/ipc'
import {
    $currentScan,
    $isScanning,
    clearCurrentScan,
    syncScanSession,
} from '../stores/scan'
import { DesktopShell } from '../ui/DesktopShell'

export default function Scan() {
    const navigate = useNavigate()
    const [rootPath, setRootPath] = createSignal('')
    const [includeHidden, setIncludeHidden] = createSignal(false)
    const [maxDepth, setMaxDepth] = createSignal<number | undefined>()
    let pollingHandle: number | undefined

    const currentScan = useStore($currentScan)
    const isScanning = useStore($isScanning)

    const stopPolling = () => {
        if (pollingHandle !== undefined) {
            window.clearInterval(pollingHandle)
            pollingHandle = undefined
        }
    }

    onCleanup(stopPolling)

    const beginPolling = (scanId: string) => {
        stopPolling()
        pollingHandle = window.setInterval(async () => {
            try {
                const status = await IPC.getScanStatus(scanId)
                syncScanSession(status)
                if (status.status === 'completed') {
                    stopPolling()
                    navigate('/results')
                }
                if (status.status === 'error') {
                    stopPolling()
                }
            } catch (error) {
                console.error('Failed to poll scan status:', error)
                stopPolling()
            }
        }, 750)
    }

    const handleStartScan = async () => {
        if (!rootPath()) {
            return
        }

        try {
            const scanId = await IPC.startScan({
                rootPath: rootPath(),
                includeHidden: includeHidden(),
                maxDepth: maxDepth(),
            })
            beginPolling(scanId)
        } catch (error) {
            console.error('Failed to start scan:', error)
            clearCurrentScan()
        }
    }

    const handleStopScan = async () => {
        const scan = currentScan()
        if (!scan) {
            return
        }

        try {
            await IPC.stopScan(scan.id)
            stopPolling()
            clearCurrentScan()
        } catch (error) {
            console.error('Failed to stop scan:', error)
        }
    }

    const activeDirectories = () => {
        const root =
            currentScan()?.rootPath ||
            rootPath() ||
            '~/Library/Application Support/Code'
        return [
            { label: `${root}/workspaceStorage`, status: 'scanning' },
            { label: `${root}/CachedData`, status: 'queued' },
            { label: `${root}/logs`, status: 'queued' },
        ]
    }

    return (
        <DesktopShell
            active="scan"
            eyebrow={
                isScanning()
                    ? 'Scanning System...'
                    : 'Scan / Configure / Launch'
            }
            topMetric="3.2GB Cleanable"
            rightMeta={isScanning() ? 'scan / in progress' : 'scan / ready'}
        >
            <Show
                when={isScanning() && currentScan()}
                fallback={
                    <div class="mx-auto grid max-w-5xl gap-8 xl:grid-cols-[1.2fr_0.8fr]">
                        <section class="rounded-[32px] border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-8 animate-in fade-in slide-in-from-left duration-700">
                            <p class="font-mono text-[11px] uppercase tracking-[0.28em] text-[#57f1db] animate-in fade-in duration-500 delay-100">
                                Launch New Scan
                            </p>
                            <h1 class="mt-3 font-headline text-4xl font-extrabold tracking-tight text-white animate-in fade-in slide-in-from-bottom duration-700 delay-200">
                                Point DevSweep at the directories you want
                                analyzed.
                            </h1>
                            <p class="mt-4 max-w-2xl text-sm leading-6 text-[#bacac5] animate-in fade-in duration-700 delay-300">
                                This route now uses the same Stitch dark-shell
                                styling. Once started, it transitions into the
                                live progress screen instead of a plain form
                                card.
                            </p>

                            <div class="mt-8 space-y-5 animate-in fade-in duration-700 delay-400">
                                <div>
                                    <label class="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-[#bacac5]/45">
                                        Root Path
                                    </label>
                                    <input
                                        class="min-h-14 w-full rounded-2xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white outline-none transition-all duration-300 focus:border-[#57f1db]/40 focus:shadow-[0_0_12px_rgba(87,241,219,0.15)] hover:border-white/20"
                                        placeholder="C:\\Users\\username\\Projects or /home/user/projects"
                                        value={rootPath()}
                                        onInput={(event) =>
                                            setRootPath(
                                                event.currentTarget.value
                                            )
                                        }
                                    />
                                </div>

                                <div class="grid gap-4 md:grid-cols-2">
                                    <label class="flex items-center justify-between rounded-2xl border border-white/5 bg-[#191b22] px-4 py-4 transition-all duration-300 hover:border-[#57f1db]/20 hover:bg-[#1f2129] cursor-pointer">
                                        <div>
                                            <p class="text-sm font-semibold text-white">
                                                Include hidden files
                                            </p>
                                            <p class="mt-1 text-xs text-[#bacac5]/60">
                                                Capture caches and
                                                dot-directories.
                                            </p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={includeHidden()}
                                            onChange={(event) =>
                                                setIncludeHidden(
                                                    event.currentTarget.checked
                                                )
                                            }
                                            class="h-5 w-5 rounded border-none bg-[#33343b] text-[#57f1db] focus:ring-0"
                                        />
                                    </label>

                                    <div class="rounded-2xl border border-white/5 bg-[#191b22] px-4 py-4">
                                        <label class="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-[#bacac5]/45">
                                            Max Depth
                                        </label>
                                        <input
                                            type="number"
                                            placeholder="10"
                                            value={maxDepth()?.toString() ?? ''}
                                            onInput={(event) => {
                                                const value =
                                                    event.currentTarget.value
                                                setMaxDepth(
                                                    value
                                                        ? Number.parseInt(
                                                              value,
                                                              10
                                                          )
                                                        : undefined
                                                )
                                            }}
                                            class="w-full rounded-xl border border-white/10 bg-[#111319] px-3 py-2 text-sm text-white outline-none focus:border-[#57f1db]/40"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div class="mt-8 flex flex-wrap gap-3">
                                <button
                                    class="rounded-full bg-gradient-to-br from-[#57f1db] to-[#2dd4bf] px-8 py-3 text-sm font-bold text-[#003731] transition hover:shadow-[0_0_24px_rgba(87,241,219,0.22)]"
                                    disabled={!rootPath()}
                                    onClick={handleStartScan}
                                >
                                    Start Scan
                                </button>
                                <button
                                    class="rounded-full bg-[#33343b] px-8 py-3 text-sm font-bold text-white transition hover:bg-[#373940]"
                                    onClick={() => navigate('/dashboard')}
                                >
                                    Back to Dashboard
                                </button>
                            </div>
                        </section>

                        <section class="space-y-6">
                            <div class="rounded-[32px] border border-white/5 bg-[#1e1f26] p-6">
                                <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-[#bacac5]/45">
                                    Scan Preview
                                </p>
                                <div class="mt-5 space-y-3">
                                    <For each={activeDirectories()}>
                                        {(directory, index) => (
                                            <div class="flex items-center justify-between rounded-2xl bg-[#191b22] px-4 py-3">
                                                <span class="truncate font-mono text-xs text-[#bacac5]">
                                                    {directory.label}
                                                </span>
                                                <span
                                                    class={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                                                        index() === 0
                                                            ? 'text-[#57f1db]'
                                                            : 'text-[#9cd1c6]'
                                                    }`}
                                                >
                                                    {directory.status}
                                                </span>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>

                            <div class="rounded-[32px] border border-white/5 bg-[#1e1f26] p-6">
                                <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-[#bacac5]/45">
                                    Scan Tips
                                </p>
                                <ul class="mt-4 space-y-3 text-sm text-[#bacac5]">
                                    <li>
                                        Start with your main workspace or home
                                        dev directory.
                                    </li>
                                    <li>
                                        Hidden files reveal the highest-value
                                        cache cleanup candidates.
                                    </li>
                                    <li>
                                        Use max depth when you want a faster
                                        first pass on huge repos.
                                    </li>
                                </ul>
                            </div>
                        </section>
                    </div>
                }
            >
                {(scan) => (
                    <div class="mx-auto flex max-w-5xl flex-col items-center justify-center py-8 text-center">
                        <div class="relative mb-12 flex h-64 w-64 items-center justify-center">
                            <div class="absolute inset-0 rounded-full border-4 border-[#1e1f26]" />
                            <div class="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#57f1db] shadow-[0_0_40px_rgba(87,241,219,0.12)]" />
                            <div class="absolute h-full w-full animate-[spin_8s_linear_infinite] opacity-25">
                                <div class="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-[#57f1db]" />
                            </div>
                            <div class="z-10">
                                <p class="font-headline text-5xl font-extrabold text-[#57f1db]">
                                    {Math.round(scan().progress)}%
                                </p>
                                <p class="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#bacac5]/55">
                                    analyzing
                                </p>
                            </div>
                        </div>

                        <div class="mb-8 w-full max-w-3xl rounded-[28px] border border-white/5 bg-[#0c0e14] p-6 text-left shadow-2xl">
                            <div class="mb-4 flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="h-2 w-2 rounded-full bg-[#57f1db]" />
                                    <span class="font-mono text-[10px] uppercase tracking-[0.24em] text-[#bacac5]/55">
                                        Current Thread
                                    </span>
                                </div>
                                <span class="font-mono text-[10px] text-[#57f1db]/60">
                                    PID: active
                                </span>
                            </div>
                            <div class="rounded-2xl border border-white/5 bg-[#111319] p-4 font-mono text-sm text-[#bacac5]">
                                {scan().rootPath}
                            </div>
                        </div>

                        <div class="mb-10 grid w-full max-w-3xl gap-4 md:grid-cols-2">
                            <div class="flex items-center gap-4 rounded-[24px] border border-white/5 bg-[#1e1f26] p-5">
                                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-[#57f1db]/10 text-[#57f1db]">
                                    <span class="material-symbols-outlined">
                                        folder_open
                                    </span>
                                </div>
                                <div class="text-left">
                                    <p class="font-headline text-3xl font-bold text-white">
                                        {scan().scannedFiles}
                                    </p>
                                    <p class="text-xs text-[#bacac5]/60">
                                        Files scanned
                                    </p>
                                </div>
                            </div>
                            <div class="flex items-center gap-4 rounded-[24px] border border-white/5 bg-[#1e1f26] p-5">
                                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ffd1aa]/10 text-[#ffd1aa]">
                                    <span class="material-symbols-outlined">
                                        database
                                    </span>
                                </div>
                                <div class="text-left">
                                    <p class="font-headline text-3xl font-bold text-white">
                                        {(
                                            scan().results.reduce(
                                                (sum, item) => sum + item.size,
                                                0
                                            ) /
                                            1024 /
                                            1024 /
                                            1024
                                        ).toFixed(1)}{' '}
                                        GB
                                    </p>
                                    <p class="text-xs text-[#bacac5]/60">
                                        Space found
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="mb-10 w-full max-w-3xl space-y-3">
                            <div class="flex items-center justify-between px-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#bacac5]/45">
                                <span>Active Directory Tree</span>
                                <span>Status</span>
                            </div>
                            <For each={activeDirectories()}>
                                {(directory, index) => (
                                    <div class="flex items-center justify-between rounded-2xl bg-[#1e1f26] px-4 py-3">
                                        <span class="truncate font-mono text-xs text-[#bacac5]">
                                            {directory.label}
                                        </span>
                                        <span
                                            class={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                                                index() === 0
                                                    ? 'text-[#57f1db]'
                                                    : 'text-[#9cd1c6]'
                                            }`}
                                        >
                                            {directory.status}
                                        </span>
                                    </div>
                                )}
                            </For>
                        </div>

                        <button
                            class="rounded-full border border-[#859490]/30 px-8 py-3 text-sm font-bold text-[#bacac5] transition hover:border-[#ffb4ab] hover:text-[#ffb4ab]"
                            onClick={handleStopScan}
                        >
                            Cancel Scan
                        </button>
                        <p class="mt-4 font-mono text-[10px] uppercase tracking-[0.28em] text-[#bacac5]/35">
                            Estimated time remaining: 01:42
                        </p>
                    </div>
                )}
            </Show>
        </DesktopShell>
    )
}
