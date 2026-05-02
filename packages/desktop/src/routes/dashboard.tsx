import { useNavigate } from '@solidjs/router'
import { useStore } from '@nanostores/solid'
import { createMemo, createSignal, For, Show, onMount } from 'solid-js'
import { IPC, type AssistantQueryResponse, type SystemOverview } from '../lib/ipc'
import { $currentScan, $scanHistory, loadHistory } from '../stores/scan'
import { DesktopShell } from '../ui/DesktopShell'

const formatBytes = (bytes: number) => {
    if (bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const value = bytes / 1024 ** exponent
    return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString() : 'No git date'

export default function Dashboard() {
    const navigate = useNavigate()
    const currentScan = useStore($currentScan)
    const scanHistory = useStore($scanHistory)

    const [overview, setOverview] = createSignal<SystemOverview>()
    const [assistantQuery, setAssistantQuery] = createSignal('')
    const [assistantResponse, setAssistantResponse] = createSignal<AssistantQueryResponse>()
    const [assistantLoading, setAssistantLoading] = createSignal(false)

    onMount(async () => {
        await loadHistory()
        try {
            setOverview(await IPC.getSystemOverview())
        } catch (error) {
            console.error('Failed to load system overview:', error)
        }
    })

    const lastScan = createMemo(() => scanHistory()[0])
    const hasScan = createMemo(() => Boolean(lastScan()))
    const activeScan = createMemo(() => currentScan())
    const presetRows = createMemo(() => {
        const summary = lastScan()?.summary
        if (!summary) return []
        return [
            { key: 'Quick Clean', size: summary.quickCleanSize, tone: 'safe' },
            { key: 'Deep Clean', size: summary.deepCleanSize, tone: 'review' },
            { key: 'Nuclear', size: summary.nuclearCleanSize, tone: 'danger' },
        ]
    })

    const runAssistantQuery = async () => {
        const query = assistantQuery().trim()
        if (!query) return
        setAssistantLoading(true)
        try {
            setAssistantResponse(await IPC.queryAssistant(query, lastScan()?.id, 6))
        } catch (error) {
            console.error('Failed to query assistant:', error)
        } finally {
            setAssistantLoading(false)
        }
    }

    return (
        <DesktopShell
            active="dashboard"
            eyebrow="dev storage command"
            topMetric={
                activeScan()
                    ? `${formatBytes(activeScan()!.bytesScanned)} scanned live`
                    : hasScan()
                      ? `${formatBytes(lastScan()!.summary.deepCleanSize)} cleanable from last scan`
                      : 'Ready for first scan'
            }
            rightMeta="dashboard / database-backed"
        >
            <Show
                when={lastScan()}
                fallback={
                    <section class="empty-stage p-8">
                        <div class="sweep-orbit" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                        </div>
                        <div class="max-w-2xl">
                            <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                No scan session yet
                            </p>
                            <h1 class="mt-3 text-4xl font-extrabold">
                                DevSweep needs one real scan before it shows cleanup numbers.
                            </h1>
                            <p class="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                                The dashboard stays empty until SQLite has a completed scan_session.
                                Start a scan to detect dead projects, duplicated environments,
                                SDK waste, and safe preset totals.
                            </p>
                            <button class="action-button mt-6" onClick={() => navigate('/scan')}>
                                Start scan
                            </button>
                        </div>
                    </section>
                }
            >
                {(scan) => (
                    <div class="space-y-6">
                        <section class="dev-hero">
                            <div class="sweep-orbit" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                            </div>
                            <div class="relative z-10 grid gap-6 xl:grid-cols-[1fr_360px]">
                                <div>
                                    <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                        Last scan session
                                    </p>
                                    <h1 class="mt-3 text-4xl font-extrabold">
                                        {formatBytes(scan().summary.deepCleanSize)} of developer storage needs attention.
                                    </h1>
                                    <p class="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
                                        {scan().summary.deadProjects.toLocaleString()} dead project signals,
                                        {' '}
                                        {scan().summary.duplicateEnvironments.toLocaleString()} duplicated environment hits,
                                        and {scan().summary.unusedSdkItems.toLocaleString()} SDK/version candidates were read from the database.
                                    </p>
                                </div>
                                <div class="grid gap-3">
                                    <For each={presetRows()}>
                                        {(preset) => (
                                            <button
                                                class={`preset-strip preset-${preset.tone}`}
                                                onClick={() => navigate('/results')}
                                            >
                                                <span>{preset.key}</span>
                                                <strong>{formatBytes(preset.size)}</strong>
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </section>

                        <Show when={activeScan()}>
                            {(live) => (
                                <section class="shell-panel p-5">
                                    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div class="min-w-0">
                                            <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                                Live scan
                                            </p>
                                            <p class="mt-2 truncate text-lg font-bold">
                                                {live().currentPath ?? live().currentDrive ?? 'Preparing scan'}
                                            </p>
                                        </div>
                                        <div class="flex items-center gap-4">
                                            <div class="live-meter">
                                                <span style={{ width: `${Math.round(live().progress)}%` }} />
                                            </div>
                                            <strong>{Math.round(live().progress)}%</strong>
                                        </div>
                                    </div>
                                </section>
                            )}
                        </Show>

                        <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                            <section class="shell-panel p-6">
                                <div class="flex items-center justify-between gap-4">
                                    <div>
                                        <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                            Artifact intelligence
                                        </p>
                                        <h2 class="mt-2 text-2xl font-extrabold">Largest cleanup candidates</h2>
                                    </div>
                                    <button class="secondary-button" onClick={() => navigate('/results')}>
                                        Review
                                    </button>
                                </div>
                                <div class="mt-5 space-y-3">
                                    <For each={scan().topFiles.slice(0, 6)}>
                                        {(item) => (
                                            <article class="artifact-row">
                                                <div class="min-w-0">
                                                    <div class="flex items-center gap-2">
                                                        <span class={`tool-dot tool-${item.tool}`} />
                                                        <p class="truncate text-sm font-semibold">{item.path}</p>
                                                    </div>
                                                    <p class="mt-1 text-xs text-[var(--text-muted)]">
                                                        {item.tool} · {item.reason || item.recommendation} · {formatDate(item.lastGitCommitAt)}
                                                    </p>
                                                </div>
                                                <strong class="whitespace-nowrap font-mono text-xs">
                                                    {formatBytes(item.size)}
                                                </strong>
                                            </article>
                                        )}
                                    </For>
                                </div>
                            </section>

                            <section class="shell-panel p-6">
                                <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                    Local AI advisor
                                </p>
                                <h2 class="mt-2 text-2xl font-extrabold">Ask the last scan</h2>
                                <div class="mt-5 flex gap-3">
                                    <input
                                        class="field"
                                        placeholder="node_modules, old SDK, duplicate venv..."
                                        value={assistantQuery()}
                                        onInput={(event) => setAssistantQuery(event.currentTarget.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') void runAssistantQuery()
                                        }}
                                    />
                                    <button class="action-button" disabled={assistantLoading()} onClick={() => void runAssistantQuery()}>
                                        {assistantLoading() ? 'Searching' : 'Ask'}
                                    </button>
                                </div>
                                <Show when={assistantResponse()}>
                                    {(response) => (
                                        <div class="mt-5 space-y-3">
                                            <div class="subtle-panel p-4 text-sm font-semibold">{response().answer}</div>
                                            <For each={response().matches}>
                                                {(match) => (
                                                    <div class="subtle-panel p-4">
                                                        <p class="truncate text-sm font-semibold">{match.path}</p>
                                                        <p class="mt-2 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">
                                                            {match.snippet}
                                                        </p>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    )}
                                </Show>
                            </section>
                        </div>

                        <section class="grid gap-4 md:grid-cols-3">
                            <For each={overview()?.drives ?? []}>
                                {(drive) => (
                                    <article class="metric-card p-4">
                                        <div class="flex items-center justify-between">
                                            <strong>{drive.label}</strong>
                                            <span class="font-mono text-[10px] text-[var(--text-soft)]">{drive.fileSystem}</span>
                                        </div>
                                        <div class="mt-4 h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                                            <span
                                                class="block h-full bg-[var(--accent)]"
                                                style={{ width: `${Math.min((drive.usedBytes / Math.max(drive.totalBytes, 1)) * 100, 100)}%` }}
                                            />
                                        </div>
                                        <p class="mt-3 text-xs text-[var(--text-muted)]">
                                            {formatBytes(drive.usedBytes)} used of {formatBytes(drive.totalBytes)}
                                        </p>
                                    </article>
                                )}
                            </For>
                        </section>
                    </div>
                )}
            </Show>
        </DesktopShell>
    )
}
