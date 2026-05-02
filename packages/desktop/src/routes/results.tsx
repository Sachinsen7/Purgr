import { useStore } from '@nanostores/solid'
import { createMemo, createSignal, For, Show, onMount } from 'solid-js'
import { IPC } from '../lib/ipc'
import {
    $scanHistory,
    $selectedHistory,
    loadHistory,
    loadHistoryScan,
} from '../stores/scan'
import { DesktopShell } from '../ui/DesktopShell'

type FilterKey = 'all' | 'delete' | 'review' | 'keep'
type PresetKey = 'quick' | 'deep' | 'nuclear'

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

export default function Results() {
    const scanHistory = useStore($scanHistory)
    const selectedHistory = useStore($selectedHistory)

    const [filter, setFilter] = createSignal<FilterKey>('all')
    const [preset, setPreset] = createSignal<PresetKey>('deep')
    const [selectedIds, setSelectedIds] = createSignal<string[]>([])
    const [deleting, setDeleting] = createSignal<'recycle' | 'permanent' | null>(
        null
    )

    onMount(async () => {
        await loadHistory({ hydrateLatest: true })
    })

    const results = createMemo(() => selectedHistory()?.results ?? [])
    const filteredResults = createMemo(() => {
        const presetFiltered = results().filter((item) => {
            if (preset() === 'quick') return item.cleanupPreset === 'quick'
            if (preset() === 'deep') return item.cleanupPreset !== 'nuclear'
            return true
        })
        if (filter() === 'all') return presetFiltered
        return presetFiltered.filter((item) => item.recommendation === filter())
    })
    const selectedResults = createMemo(() =>
        filteredResults().filter((item) => selectedIds().includes(item.id))
    )
    const selectedBytes = createMemo(() =>
        selectedResults().reduce((sum, item) => sum + item.size, 0)
    )

    const toggleSelected = (id: string) => {
        setSelectedIds((current) =>
            current.includes(id)
                ? current.filter((entry) => entry !== id)
                : [...current, id]
        )
    }

    const deleteSelected = async (mode: 'recycle' | 'permanent') => {
        if (selectedResults().length === 0) return
        setDeleting(mode)
        try {
            await IPC.deleteFiles(
                selectedResults().map((item) => item.path),
                mode
            )
            if (selectedHistory()) {
                await loadHistoryScan(selectedHistory()!.session.id)
            }
        } catch (error) {
            console.error('Failed to delete files:', error)
        } finally {
            setDeleting(null)
            setSelectedIds([])
        }
    }

    return (
        <DesktopShell
            active="results"
            eyebrow="history and cleanup"
            topMetric={
                selectedHistory()
                    ? `${formatBytes(
                          selectedHistory()!.session.summary.deletableSize
                      )} ready for cleanup`
                    : 'No scan selected'
            }
            rightMeta="results / persisted detail"
        >
            <div class="grid gap-6 xl:grid-cols-[320px_1fr]">
                <aside class="shell-panel p-4">
                    <p class="px-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                        Sessions
                    </p>
                    <div class="mt-4 space-y-2">
                        <For each={scanHistory()}>
                            {(session) => (
                                <button
                                    class={`w-full rounded-2xl border p-4 text-left transition ${
                                        selectedHistory()?.session.id ===
                                        session.id
                                            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                            : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--panel-soft)]'
                                    }`}
                                    onClick={() => void loadHistoryScan(session.id)}
                                >
                                    <p class="truncate text-sm font-semibold">
                                        {session.rootPaths.join(', ')}
                                    </p>
                                    <p class="mt-1 text-xs text-[var(--text-muted)]">
                                        {session.summary.totalFiles.toLocaleString()}{' '}
                                        files ·{' '}
                                        {formatBytes(session.summary.totalSize)}
                                    </p>
                                </button>
                            )}
                        </For>
                    </div>
                </aside>

                <section class="space-y-6">
                    <Show
                        when={selectedHistory()}
                        fallback={
                            <section class="shell-panel p-6 text-sm text-[var(--text-muted)]">
                                Select a completed session to inspect drive
                                totals, oldest/newest files, and cleanup
                                candidates.
                            </section>
                        }
                    >
                        {(details) => (
                            <>
                                <section class="shell-panel p-6">
                                    <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                        <div>
                                            <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                                Session summary
                                            </p>
                                            <h1 class="mt-2 text-3xl font-extrabold">
                                                {details().session.rootPaths.join(', ')}
                                            </h1>
                                            <p class="mt-2 text-sm text-[var(--text-muted)]">
                                                {details()
                                                    .session.summary.totalFiles.toLocaleString()}{' '}
                                                files ·{' '}
                                                {formatBytes(
                                                    details()
                                                        .session.summary.totalSize
                                                )}
                                            </p>
                                        </div>
                                        <div class="grid gap-3 sm:grid-cols-3">
                                            <div class="metric-card p-4">
                                                <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                                    Largest file
                                                </p>
                                                <p class="mt-2 text-sm font-semibold">
                                                    {details().session.topFiles[0]
                                                        ? formatBytes(
                                                              details().session
                                                                  .topFiles[0]
                                                                  .size
                                                          )
                                                        : 'None'}
                                                </p>
                                            </div>
                                            <div class="metric-card p-4">
                                                <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                                    Oldest file
                                                </p>
                                                <p class="mt-2 text-sm font-semibold">
                                                    {details().session.oldestFile
                                                        ? new Date(
                                                              details()
                                                                  .session
                                                                  .oldestFile!
                                                                  .modifiedAt
                                                          ).toLocaleDateString()
                                                        : 'None'}
                                                </p>
                                            </div>
                                            <div class="metric-card p-4">
                                                <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                                    Issues
                                                </p>
                                                <p class="mt-2 text-sm font-semibold">
                                                    {details()
                                                        .session.summary.issueCount.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
                                        <div class="subtle-panel p-4 xl:col-span-2">
                                            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                                One-click presets
                                            </p>
                                            <div class="mt-3 grid gap-3 md:grid-cols-3">
                                                <For each={['quick', 'deep', 'nuclear'] as const}>
                                                    {(value) => (
                                                        <button
                                                            class={`preset-strip text-left ${preset() === value ? 'border-[var(--accent)]' : ''}`}
                                                            onClick={() => setPreset(value)}
                                                        >
                                                            <span class="capitalize">{value}</span>
                                                            <strong>
                                                                {formatBytes(
                                                                    value === 'quick'
                                                                        ? details().session.summary.quickCleanSize
                                                                        : value === 'deep'
                                                                          ? details().session.summary.deepCleanSize
                                                                          : details().session.summary.nuclearCleanSize
                                                                )}
                                                            </strong>
                                                        </button>
                                                    )}
                                                </For>
                                            </div>
                                        </div>
                                        <div class="subtle-panel p-4">
                                            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                                Drive totals
                                            </p>
                                            <div class="mt-3 space-y-3">
                                                <For
                                                    each={
                                                        details()
                                                            .session
                                                            .driveSummaries
                                                    }
                                                >
                                                    {(drive) => (
                                                        <div class="flex items-center justify-between gap-4">
                                                            <div>
                                                                <p class="text-sm font-semibold">
                                                                    {drive.label}
                                                                </p>
                                                                <p class="text-xs text-[var(--text-muted)]">
                                                                    {drive.fileCount.toLocaleString()}{' '}
                                                                    files ·{' '}
                                                                    {drive.issueCount.toLocaleString()}{' '}
                                                                    issues
                                                                </p>
                                                            </div>
                                                            <span class="font-mono text-[11px] text-[var(--text-soft)]">
                                                                {formatBytes(
                                                                    drive.totalSize
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </div>
                                        <div class="subtle-panel p-4">
                                            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                                Bucket totals
                                            </p>
                                            <div class="mt-3 space-y-3">
                                                <For
                                                    each={
                                                        details()
                                                            .session
                                                            .bucketSummaries
                                                    }
                                                >
                                                    {(bucket) => (
                                                        <div class="flex items-center justify-between gap-4">
                                                            <div>
                                                                <p class="text-sm font-semibold">
                                                                    {bucket.label}
                                                                </p>
                                                                <p class="text-xs text-[var(--text-muted)]">
                                                                    {bucket.fileCount.toLocaleString()}{' '}
                                                                    files
                                                                </p>
                                                            </div>
                                                            <span class="font-mono text-[11px] text-[var(--text-soft)]">
                                                                {formatBytes(
                                                                    bucket.totalSize
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section class="shell-panel p-6">
                                    <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                        <div class="flex flex-wrap gap-2">
                                            <For
                                                each={
                                                    [
                                                        'all',
                                                        'delete',
                                                        'review',
                                                        'keep',
                                                    ] as const
                                                }
                                            >
                                                {(value) => (
                                                    <button
                                                        class={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                                                            filter() === value
                                                                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]'
                                                                : 'border-[var(--border)] text-[var(--text-muted)]'
                                                        }`}
                                                        onClick={() =>
                                                            setFilter(value)
                                                        }
                                                    >
                                                        {value}
                                                    </button>
                                                )}
                                            </For>
                                        </div>
                                        <div class="flex flex-wrap gap-2">
                                            <button
                                                class="secondary-button"
                                                onClick={() =>
                                                    setSelectedIds(
                                                        filteredResults().map(
                                                            (item) => item.id
                                                        )
                                                    )
                                                }
                                            >
                                                Select visible
                                            </button>
                                            <button
                                                class="action-button"
                                                disabled={
                                                    deleting() !== null ||
                                                    selectedResults().length ===
                                                        0
                                                }
                                                onClick={() =>
                                                    void deleteSelected(
                                                        'recycle'
                                                    )
                                                }
                                            >
                                                {deleting() === 'recycle'
                                                    ? 'Recycling...'
                                                    : `Move ${selectedResults().length} to Recycle Bin`}
                                            </button>
                                            <button
                                                class="danger-button"
                                                disabled={
                                                    deleting() !== null ||
                                                    selectedResults().length ===
                                                        0
                                                }
                                                onClick={() =>
                                                    void deleteSelected(
                                                        'permanent'
                                                    )
                                                }
                                            >
                                                {deleting() === 'permanent'
                                                    ? 'Deleting...'
                                                    : 'Permanent delete'}
                                            </button>
                                        </div>
                                    </div>

                                    <div class="mt-4 flex items-center justify-between text-sm text-[var(--text-muted)]">
                                        <span>
                                            {selectedResults().length.toLocaleString()}{' '}
                                            selected
                                        </span>
                                        <span>
                                            {formatBytes(selectedBytes())} total
                                        </span>
                                    </div>

                                    <div class="mt-6 space-y-3">
                                        <For each={filteredResults()}>
                                            {(result) => (
                                                <div class="subtle-panel p-4">
                                                    <div class="flex items-start justify-between gap-4">
                                                        <label class="flex min-w-0 flex-1 items-start gap-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds().includes(
                                                                    result.id
                                                                )}
                                                                class="mt-1 h-4 w-4 accent-[var(--accent)]"
                                                                onChange={() =>
                                                                    toggleSelected(
                                                                        result.id
                                                                    )
                                                                }
                                                            />
                                                            <div class="min-w-0">
                                                                <p class="truncate text-sm font-semibold">
                                                                    {result.path}
                                                                </p>
                                                                <p class="mt-1 text-xs text-[var(--text-muted)]">
                                                                    {result.tool} ·{' '}
                                                                    {result.bucket} ·{' '}
                                                                    {result.recommendation}{' '}
                                                                    · score{' '}
                                                                    {result.score}
                                                                </p>
                                                                <p class="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">
                                                                    {result.aiExplanation || result.reason}
                                                                </p>
                                                            </div>
                                                        </label>
                                                        <div class="flex items-center gap-3">
                                                            <span class="font-mono text-[11px] text-[var(--text-soft)]">
                                                                {formatBytes(
                                                                    result.size
                                                                )}
                                                            </span>
                                                            <button
                                                                class="secondary-button"
                                                                onClick={() =>
                                                                    IPC.showInFolder(
                                                                        result.path
                                                                    )
                                                                }
                                                            >
                                                                Open
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </section>
                            </>
                        )}
                    </Show>
                </section>
            </div>
        </DesktopShell>
    )
}
