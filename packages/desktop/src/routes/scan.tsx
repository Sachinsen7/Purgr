import { useStore } from '@nanostores/solid'
import { createSignal, For, Show, onMount } from 'solid-js'
import { IPC, type SystemOverview } from '../lib/ipc'
import {
    $currentScan,
    $historyError,
    $isStartingScan,
    $isScanning,
    $scanError,
    beginScan,
    hydrateCurrentScan,
    loadHistory,
    stopCurrentScan,
} from '../stores/scan'
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

export default function Scan() {
    const currentScan = useStore($currentScan)
    const historyError = useStore($historyError)
    const isStartingScan = useStore($isStartingScan)
    const isScanning = useStore($isScanning)
    const scanError = useStore($scanError)

    const [overview, setOverview] = createSignal<SystemOverview>()
    const [selectedDrives, setSelectedDrives] = createSignal<string[]>([])
    const [includeHidden, setIncludeHidden] = createSignal(true)
    const [configurationLoading, setConfigurationLoading] = createSignal(true)
    const [configurationError, setConfigurationError] = createSignal<string | null>(
        null
    )

    onMount(async () => {
        await loadHistory()
        try {
            const [settingsResult, overviewResult] = await Promise.allSettled([
                IPC.getSettings(),
                IPC.getSystemOverview(),
            ])

            if (settingsResult.status === 'fulfilled') {
                setIncludeHidden(settingsResult.value.scanning.includeHidden)
            } else {
                console.error(
                    'Failed to load scan settings:',
                    settingsResult.reason
                )
            }

            if (overviewResult.status === 'fulfilled') {
                const systemOverview = overviewResult.value
                setOverview(systemOverview)
                setSelectedDrives(
                    systemOverview.drives.map((drive) => drive.path)
                )
                if (systemOverview.activeScanId) {
                    await hydrateCurrentScan(systemOverview.activeScanId)
                }
            } else {
                throw overviewResult.reason
            }
        } catch (error) {
            setConfigurationError(
                error instanceof Error
                    ? error.message
                    : 'Failed to load scan configuration.'
            )
            console.error('Failed to load scan configuration:', error)
        } finally {
            setConfigurationLoading(false)
        }
    })

    const toggleDrive = (drivePath: string) => {
        setSelectedDrives((current) =>
            current.includes(drivePath)
                ? current.filter((entry) => entry !== drivePath)
                : [...current, drivePath]
        )
    }

    const launchScan = async () => {
        try {
            await beginScan({
                selectedDrives: selectedDrives(),
                includeHidden: includeHidden(),
            })
        } catch (error) {
            console.error('Failed to start scan:', error)
        }
    }

    return (
        <DesktopShell
            active="scan"
            eyebrow="scan orchestration"
            topMetric={
                currentScan()
                    ? `${currentScan()!.processedFiles.toLocaleString()} files processed`
                    : `${selectedDrives().length.toLocaleString()} drives selected`
            }
            rightMeta={
                isStartingScan()
                    ? 'scan / starting'
                    : isScanning()
                      ? 'scan / running'
                      : 'scan / ready'
            }
        >
            <Show when={scanError() || configurationError() || historyError()}>
                <section class="mb-6 rounded-[var(--radius-lg)] border border-[var(--danger)] bg-[var(--danger-soft)] p-4">
                    <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--danger)]">
                        Scan status
                    </p>
                    <p class="mt-2 text-sm font-medium text-[var(--text)]">
                        {scanError() ?? configurationError() ?? historyError()}
                    </p>
                </section>
            </Show>
            <Show
                when={currentScan()}
                fallback={
                    <Show
                        when={!configurationLoading()}
                        fallback={
                            <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                                <section class="shell-panel p-6">
                                    <div class="animate-pulse space-y-4">
                                        <div class="h-3 w-36 rounded-full bg-[var(--bg-muted)]" />
                                        <div class="h-10 w-3/4 rounded-2xl bg-[var(--bg-muted)]" />
                                        <div class="h-4 w-full rounded-full bg-[var(--bg-muted)]" />
                                        <div class="grid gap-4 md:grid-cols-2">
                                            <For each={[1, 2, 3, 4]}>
                                                {() => (
                                                    <div class="metric-card p-4">
                                                        <div class="h-5 w-1/3 rounded-full bg-[var(--bg-muted)]" />
                                                        <div class="mt-3 h-4 w-1/2 rounded-full bg-[var(--bg-muted)]" />
                                                        <div class="mt-6 h-4 w-2/3 rounded-full bg-[var(--bg-muted)]" />
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </div>
                                </section>
                                <section class="space-y-6">
                                    <div class="shell-panel p-6">
                                        <div class="animate-pulse space-y-4">
                                            <div class="h-3 w-32 rounded-full bg-[var(--bg-muted)]" />
                                            <div class="space-y-3">
                                                <For each={[1, 2, 3]}>
                                                    {() => (
                                                        <div class="subtle-panel p-4">
                                                            <div class="h-4 w-1/2 rounded-full bg-[var(--bg-muted)]" />
                                                            <div class="mt-2 h-3 w-3/4 rounded-full bg-[var(--bg-muted)]" />
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        }
                    >
                        <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                        <section class="shell-panel p-6">
                            <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                Default target set
                            </p>
                            <h1 class="mt-2 text-4xl font-extrabold">
                                Scan every mounted drive without manual path
                                entry.
                            </h1>
                            <p class="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
                                DevSweep now starts from the machine view: every
                                mounted drive, your enabled toolchain targets,
                                hidden files if allowed, and exclusions applied
                                before traversal.
                            </p>

                            <div class="mt-6 grid gap-4 md:grid-cols-2">
                                <For each={overview()?.drives ?? []}>
                                    {(drive) => {
                                        const selected = () =>
                                            selectedDrives().includes(drive.path)
                                        return (
                                            <button
                                                class={`metric-card p-4 text-left ${
                                                    selected()
                                                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                                        : ''
                                                }`}
                                                onClick={() =>
                                                    toggleDrive(drive.path)
                                                }
                                            >
                                                <div class="flex items-start justify-between gap-4">
                                                    <div>
                                                        <p class="text-base font-bold">
                                                            {drive.label}
                                                        </p>
                                                        <p class="mt-1 text-sm text-[var(--text-muted)]">
                                                            {drive.path}
                                                        </p>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected()}
                                                        class="mt-1 h-4 w-4 accent-[var(--accent)]"
                                                    />
                                                </div>
                                                <p class="mt-4 text-sm text-[var(--text-muted)]">
                                                    {formatBytes(drive.usedBytes)}{' '}
                                                    used of{' '}
                                                    {formatBytes(drive.totalBytes)}
                                                </p>
                                            </button>
                                        )
                                    }}
                                </For>
                            </div>

                            <div class="mt-6 flex flex-wrap gap-3">
                                <label class="subtle-panel inline-flex items-center gap-3 px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={includeHidden()}
                                        class="h-4 w-4 accent-[var(--accent)]"
                                        onChange={(event) =>
                                            setIncludeHidden(
                                                event.currentTarget.checked
                                            )
                                        }
                                    />
                                    <span class="text-sm font-medium">
                                        Include hidden files
                                    </span>
                                </label>
                                <button
                                    class="action-button"
                                    disabled={
                                        isStartingScan() ||
                                        isScanning() ||
                                        selectedDrives().length === 0
                                    }
                                    onClick={() => void launchScan()}
                                >
                                    {isStartingScan()
                                        ? 'Starting scan...'
                                        : isScanning()
                                          ? 'Scan running'
                                          : 'Start full scan'}
                                </button>
                            </div>
                        </section>

                        <section class="space-y-6">
                            <div class="shell-panel p-6">
                                <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                    Managed targets
                                </p>
                                <div class="mt-4 space-y-3">
                                    <For each={overview()?.managedTargets ?? []}>
                                        {(target) => (
                                            <div class="subtle-panel p-4">
                                                <p class="text-sm font-semibold">
                                                    {target.label}
                                                </p>
                                                <p class="mt-1 text-xs text-[var(--text-muted)]">
                                                    {target.path}
                                                </p>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>

                            <div class="shell-panel p-6">
                                <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                    Scan output
                                </p>
                                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                                    <div class="subtle-panel p-4">
                                        <p class="text-sm font-semibold">
                                            Selected drives
                                        </p>
                                        <p class="mt-2 text-2xl font-extrabold">
                                            {selectedDrives().length.toLocaleString()}
                                        </p>
                                    </div>
                                    <div class="subtle-panel p-4">
                                        <p class="text-sm font-semibold">
                                            Managed targets
                                        </p>
                                        <p class="mt-2 text-2xl font-extrabold">
                                            {(overview()?.managedTargets.length ?? 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div class="mt-4 space-y-3 text-sm text-[var(--text-muted)]">
                                    <p>
                                        Live drive progress, current path, and
                                        processing counters update in place.
                                    </p>
                                    <p>
                                        Largest files, newest findings, and
                                        bucket totals appear while the scan is
                                        running.
                                    </p>
                                    <p>
                                        Windows, user, downloads, recycle bin,
                                        hidden, and toolchain buckets are all
                                        included.
                                    </p>
                                    <p>
                                        Protected or unreadable locations are
                                        reported without crashing the scan.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>
                    </Show>
                }
            >
                {(scan) => (
                    <div class="space-y-6">
                        <section class="shell-panel p-6">
                            <div class="grid gap-6 xl:grid-cols-[280px_1fr]">
                                <div class="flex flex-col items-center justify-center">
                                    <div class="relative flex h-56 w-56 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel-soft)]">
                                        <div
                                            class="absolute inset-3 rounded-full border-4 border-[var(--accent)]/20"
                                            style={{
                                                'border-top-color':
                                                    'var(--accent)',
                                                animation:
                                                    'spin 2s linear infinite',
                                            }}
                                        />
                                        <div class="text-center">
                                            <p class="text-5xl font-extrabold">
                                                {Math.round(scan().progress)}%
                                            </p>
                                            <p class="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                                {scan().phase}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div class="space-y-6">
                                    <div>
                                        <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                            Live machine scan
                                        </p>
                                        <h2 class="mt-2 text-3xl font-extrabold">
                                            {scan().currentDrive ?? 'Preparing'}{' '}
                                            {scan().currentPath
                                                ? `- ${scan().currentPath}`
                                                : ''}
                                        </h2>
                                        <p class="mt-2 text-sm text-[var(--text-muted)]">
                                            {scan().issues.length.toLocaleString()}{' '}
                                            unreadable or protected locations ·{' '}
                                            {scan().etaSeconds
                                                ? `${scan().etaSeconds}s remaining`
                                                : 'estimating time remaining'}
                                        </p>
                                    </div>

                                    <div class="grid gap-4 md:grid-cols-5">
                                        <div class="metric-card p-4">
                                            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                                Current drive
                                            </p>
                                            <p class="mt-3 text-lg font-extrabold">
                                                {scan().currentDrive ?? 'Preparing'}
                                            </p>
                                        </div>
                                        <div class="metric-card p-4">
                                            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                                Discovered
                                            </p>
                                            <p class="mt-3 text-2xl font-extrabold">
                                                {scan()
                                                    .discoveredFiles.toLocaleString()}
                                            </p>
                                        </div>
                                        <div class="metric-card p-4">
                                            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                                Processed
                                            </p>
                                            <p class="mt-3 text-2xl font-extrabold">
                                                {scan()
                                                    .processedFiles.toLocaleString()}
                                            </p>
                                        </div>
                                        <div class="metric-card p-4">
                                            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                                Bytes scanned
                                            </p>
                                            <p class="mt-3 text-2xl font-extrabold">
                                                {formatBytes(scan().bytesScanned)}
                                            </p>
                                        </div>
                                        <div class="metric-card p-4">
                                            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                                Hidden files
                                            </p>
                                            <p class="mt-3 text-2xl font-extrabold">
                                                {scan()
                                                    .summary.hiddenFiles.toLocaleString()}
                                            </p>
                                        </div>
                                        <div class="metric-card p-4">
                                            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                                Delete candidates
                                            </p>
                                            <p class="mt-3 text-2xl font-extrabold">
                                                {formatBytes(
                                                    scan().summary.deletableSize
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div class="flex flex-wrap gap-3">
                                        <button
                                            class="danger-button"
                                            disabled={
                                                isStartingScan() ||
                                                scan().id === 'pending'
                                            }
                                            onClick={() =>
                                                void stopCurrentScan()
                                            }
                                        >
                                            Stop scan
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
                            <section class="shell-panel p-6">
                                <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                    Bucket totals
                                </p>
                                <div class="mt-4 grid gap-3 md:grid-cols-2">
                                    <For each={scan().bucketSummaries}>
                                        {(bucket) => (
                                            <div class="subtle-panel p-4">
                                                <div class="flex items-center justify-between gap-4">
                                                    <div>
                                                        <p class="text-sm font-semibold">
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
                            </section>

                            <section class="shell-panel p-6">
                                <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                    Live findings
                                </p>
                                <div class="mt-4 space-y-3">
                                    <For each={scan().recentFindings}>
                                        {(result) => (
                                            <div class="subtle-panel p-4">
                                                <div class="flex items-start justify-between gap-4">
                                                    <div class="min-w-0">
                                                        <p class="truncate text-sm font-semibold">
                                                            {result.path}
                                                        </p>
                                                        <p class="mt-1 text-xs text-[var(--text-muted)]">
                                                            {result.bucket} ·{' '}
                                                            {result.recommendation}
                                                        </p>
                                                    </div>
                                                    <span class="font-mono text-[11px] text-[var(--text-soft)]">
                                                        {formatBytes(result.size)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </Show>
        </DesktopShell>
    )
}
