import { useNavigate } from '@solidjs/router'
import { useStore } from '@nanostores/solid'
import { createSignal, For, Show, onMount } from 'solid-js'
import { IPC, type AssistantQueryResponse, type SystemOverview } from '../lib/ipc'
import { $currentScan, $scanHistory, loadHistory } from '../stores/scan'
import { DesktopShell } from '../ui/DesktopShell'

const formatBytes = (bytes: number) => {
    if (bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const exponent = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1
    )
    const value = bytes / 1024 ** exponent
    return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export default function Dashboard() {
    const navigate = useNavigate()
    const currentScan = useStore($currentScan)
    const scanHistory = useStore($scanHistory)

    const [overview, setOverview] = createSignal<SystemOverview>()
    const [assistantQuery, setAssistantQuery] = createSignal('')
    const [assistantResponse, setAssistantResponse] =
        createSignal<AssistantQueryResponse>()
    const [assistantLoading, setAssistantLoading] = createSignal(false)

    onMount(async () => {
        await loadHistory()
        try {
            setOverview(await IPC.getSystemOverview())
        } catch (error) {
            console.error('Failed to load system overview:', error)
        }
    })

    const lastScan = () => scanHistory()[0]

    const runAssistantQuery = async () => {
        const query = assistantQuery().trim()
        if (!query) return
        setAssistantLoading(true)
        try {
            const response = await IPC.queryAssistant(
                query,
                lastScan()?.id,
                6
            )
            setAssistantResponse(response)
        } catch (error) {
            console.error('Failed to query assistant:', error)
        } finally {
            setAssistantLoading(false)
        }
    }

    return (
        <DesktopShell
            active="dashboard"
            eyebrow="machine overview"
            topMetric={
                currentScan()
                    ? `${formatBytes(currentScan()!.bytesScanned)} scanned live`
                    : lastScan()
                      ? `${formatBytes(lastScan()!.summary.totalSize)} in last scan`
                      : 'No scans completed yet'
            }
            rightMeta="dashboard / live state"
        >
            <div class="space-y-8">
                <Show when={currentScan()}>
                    {(scan) => (
                        <section class="shell-panel p-6">
                            <div class="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                                <div>
                                    <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                        Current scan
                                    </p>
                                    <h2 class="mt-2 text-3xl font-extrabold text-[var(--text)]">
                                        {scan().phase === 'completed'
                                            ? 'Latest machine scan finished'
                                            : 'Machine scan is running'}
                                    </h2>
                                    <p class="mt-2 text-sm text-[var(--text-muted)]">
                                        {scan().currentDrive ?? 'Preparing drive set'}{' '}
                                        {scan().currentPath
                                            ? `- ${scan().currentPath}`
                                            : ''}
                                    </p>
                                </div>
                                <div class="flex items-center gap-4">
                                    <div class="subtle-panel min-w-40 px-4 py-3 text-center">
                                        <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                            Progress
                                        </p>
                                        <p class="mt-2 text-3xl font-extrabold">
                                            {Math.round(scan().progress)}%
                                        </p>
                                    </div>
                                    <button
                                        class="secondary-button"
                                        onClick={() => navigate('/scan')}
                                    >
                                        Open scan view
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}
                </Show>

                <div class="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
                    <section class="shell-panel p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                    Drives
                                </p>
                                <h2 class="mt-2 text-2xl font-extrabold">
                                    Mounted storage
                                </h2>
                            </div>
                            <button
                                class="secondary-button"
                                onClick={() => navigate('/scan')}
                            >
                                Start scan
                            </button>
                        </div>
                        <div class="mt-6 grid gap-4 md:grid-cols-2">
                            <For each={overview()?.drives ?? []}>
                                {(drive) => (
                                    <article class="metric-card p-4">
                                        <div class="flex items-start justify-between">
                                            <div>
                                                <p class="text-lg font-bold text-[var(--text)]">
                                                    {drive.label}
                                                </p>
                                                <p class="mt-1 text-sm text-[var(--text-muted)]">
                                                    {drive.path}
                                                </p>
                                            </div>
                                            <span class="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                                                {drive.fileSystem}
                                            </span>
                                        </div>
                                        <div class="mt-5">
                                            <div class="mb-2 flex items-center justify-between text-sm">
                                                <span class="text-[var(--text-muted)]">
                                                    Used
                                                </span>
                                                <span class="font-semibold">
                                                    {formatBytes(drive.usedBytes)} /{' '}
                                                    {formatBytes(drive.totalBytes)}
                                                </span>
                                            </div>
                                            <div class="h-2 rounded-full bg-[var(--bg-muted)]">
                                                <div
                                                    class="h-2 rounded-full bg-[var(--accent)]"
                                                    style={{
                                                        width: `${Math.min(
                                                            (drive.usedBytes /
                                                                Math.max(
                                                                    drive.totalBytes,
                                                                    1
                                                                )) *
                                                                100,
                                                            100
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </article>
                                )}
                            </For>
                        </div>
                    </section>

                    <section class="shell-panel p-6">
                        <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                            Local file assistant
                        </p>
                        <h2 class="mt-2 text-2xl font-extrabold">
                            Search indexed files
                        </h2>
                        <p class="mt-2 text-sm text-[var(--text-muted)]">
                            Ask about filenames, code, logs, configs, and text
                            content from the latest completed scan.
                        </p>
                        <div class="mt-5 flex gap-3">
                            <input
                                class="field"
                                placeholder="Find files mentioning sdkmanager, cache, node_modules..."
                                value={assistantQuery()}
                                onInput={(event) =>
                                    setAssistantQuery(event.currentTarget.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        void runAssistantQuery()
                                    }
                                }}
                            />
                            <button
                                class="action-button"
                                disabled={assistantLoading()}
                                onClick={() => void runAssistantQuery()}
                            >
                                {assistantLoading() ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                        <Show when={assistantResponse()}>
                            {(response) => (
                                <div class="mt-5 space-y-3">
                                    <div class="subtle-panel p-4">
                                        <p class="text-sm font-semibold text-[var(--text)]">
                                            {response().answer}
                                        </p>
                                    </div>
                                    <For each={response().matches}>
                                        {(match) => (
                                            <div class="subtle-panel p-4">
                                                <div class="flex items-start justify-between gap-4">
                                                    <div class="min-w-0">
                                                        <p class="truncate text-sm font-semibold text-[var(--text)]">
                                                            {match.path}
                                                        </p>
                                                        <p class="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                                                            {match.snippet}
                                                        </p>
                                                    </div>
                                                    <span class="whitespace-nowrap font-mono text-[11px] text-[var(--text-soft)]">
                                                        {formatBytes(match.size)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            )}
                        </Show>
                    </section>
                </div>

                <div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
                    <section class="shell-panel p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                    Latest scan summary
                                </p>
                                <h2 class="mt-2 text-2xl font-extrabold">
                                    {lastScan()
                                        ? 'Recent machine inventory'
                                        : 'Waiting for first full scan'}
                                </h2>
                            </div>
                            <Show when={lastScan()}>
                                <button
                                    class="secondary-button"
                                    onClick={() => navigate('/results')}
                                >
                                    Open history
                                </button>
                            </Show>
                        </div>
                        <Show
                            when={lastScan()}
                            fallback={
                                <div class="mt-6 subtle-panel p-6 text-sm text-[var(--text-muted)]">
                                    Run a scan to populate bucket totals,
                                    largest files, and cleanup candidates.
                                </div>
                            }
                        >
                            {(scan) => (
                                <div class="mt-6 grid gap-4 md:grid-cols-2">
                                    <article class="metric-card p-4">
                                        <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                            Total scanned
                                        </p>
                                        <p class="mt-3 text-3xl font-extrabold">
                                            {formatBytes(scan().summary.totalSize)}
                                        </p>
                                        <p class="mt-2 text-sm text-[var(--text-muted)]">
                                            {scan().summary.totalFiles.toLocaleString()}{' '}
                                            files across{' '}
                                            {scan().rootPaths.length.toLocaleString()}{' '}
                                            drives
                                        </p>
                                    </article>
                                    <article class="metric-card p-4">
                                        <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                            Review candidates
                                        </p>
                                        <p class="mt-3 text-3xl font-extrabold">
                                            {scan().summary.reviewFiles.toLocaleString()}
                                        </p>
                                        <p class="mt-2 text-sm text-[var(--text-muted)]">
                                            {formatBytes(scan().summary.deletableSize)}{' '}
                                            flagged for deletion
                                        </p>
                                    </article>
                                    <For each={scan().bucketSummaries.slice(0, 6)}>
                                        {(bucket) => (
                                            <div class="subtle-panel p-4">
                                                <div class="flex items-center justify-between gap-4">
                                                    <div>
                                                        <p class="text-sm font-semibold text-[var(--text)]">
                                                            {bucket.label}
                                                        </p>
                                                        <p class="mt-1 text-xs text-[var(--text-muted)]">
                                                            {bucket.fileCount.toLocaleString()}{' '}
                                                            files
                                                        </p>
                                                    </div>
                                                    <span class="font-mono text-[11px] text-[var(--text-soft)]">
                                                        {formatBytes(bucket.totalSize)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            )}
                        </Show>
                    </section>

                    <section class="shell-panel p-6">
                        <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                            Recent sessions
                        </p>
                        <h2 class="mt-2 text-2xl font-extrabold">Scan history</h2>
                        <div class="mt-6 space-y-3">
                            <For each={scanHistory().slice(0, 5)}>
                                {(session) => (
                                    <button
                                        class="subtle-panel w-full p-4 text-left transition hover:border-[var(--accent)]"
                                        onClick={() => navigate('/results')}
                                    >
                                        <div class="flex items-center justify-between gap-4">
                                            <div class="min-w-0">
                                                <p class="truncate text-sm font-semibold text-[var(--text)]">
                                                    {session.rootPaths.join(', ')}
                                                </p>
                                                <p class="mt-1 text-xs text-[var(--text-muted)]">
                                                    {session.summary.totalFiles.toLocaleString()}{' '}
                                                    files ·{' '}
                                                    {formatBytes(
                                                        session.summary.totalSize
                                                    )}
                                                </p>
                                            </div>
                                            <span class="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                                                {session.status}
                                            </span>
                                        </div>
                                    </button>
                                )}
                            </For>
                        </div>
                    </section>
                </div>
            </div>
        </DesktopShell>
    )
}
