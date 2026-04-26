import { useNavigate } from '@solidjs/router'
import { useStore } from '@nanostores/solid'
import { createMemo, createSignal, For, Show, createEffect } from 'solid-js'
import { IPC } from '../lib/ipc'
import { $currentScan, $scanHistory } from '../stores/scan'
import { DesktopShell } from '../ui/DesktopShell'

type FilterKey = 'all' | 'keep' | 'delete' | 'review'

export default function Results() {
    const navigate = useNavigate()
    const currentScan = useStore($currentScan)
    const scanHistory = useStore($scanHistory)

    const [filter, setFilter] = createSignal<FilterKey>('all')
    const [selectedResults, setSelectedResults] = createSignal<string[]>([])
    const [confirmDelete, setConfirmDelete] = createSignal(false)
    const [deletionSummary, setDeletionSummary] = createSignal<{
        count: number
        bytes: number
    } | null>(null)
    const [visibleItems, setVisibleItems] = createSignal<Set<string>>(new Set())

    const results = createMemo(() => {
        if (currentScan() && currentScan()?.status === 'completed') {
            return currentScan()!.results
        }
        return (
            scanHistory().find((scan) => scan.status === 'completed')
                ?.results ?? []
        )
    })

    const filteredResults = createMemo(() => {
        if (filter() === 'all') {
            return results()
        }
        return results().filter((result) => result.recommendation === filter())
    })

    const selectedRows = createMemo(() =>
        results().filter((result) => selectedResults().includes(result.id))
    )

    const selectedBytes = createMemo(() =>
        selectedRows().reduce((sum, result) => sum + result.size, 0)
    )

    const handleSelect = (id: string, checked: boolean) => {
        setSelectedResults((current) =>
            checked ? [...current, id] : current.filter((entry) => entry !== id)
        )
    }

    const handleSelectAll = () => {
        const visibleIds = filteredResults().map((result) => result.id)
        const allSelected = visibleIds.every((id) =>
            selectedResults().includes(id)
        )
        setSelectedResults(allSelected ? [] : visibleIds)
    }

    const handleDeleteSelected = async () => {
        const rows = selectedRows()
        if (rows.length === 0) {
            return
        }

        try {
            await IPC.deleteFiles(rows.map((result) => result.path))
            setDeletionSummary({
                count: rows.length,
                bytes: rows.reduce((sum, result) => sum + result.size, 0),
            })
            setSelectedResults([])
            setConfirmDelete(false)
        } catch (error) {
            console.error('Failed to delete files:', error)
        }
    }

    const formatBytes = (bytes: number) => {
        if (bytes === 0) {
            return '0 B'
        }

        const units = ['B', 'KB', 'MB', 'GB', 'TB']
        const unitIndex = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            units.length - 1
        )
        const value = bytes / Math.pow(1024, unitIndex)
        return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
    }

    const sidebarFilters = (
        <div class="space-y-6">
            <div>
                <h3 class="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#bacac5]/45">
                    Filter Results
                </h3>
                <div class="space-y-2 text-xs text-[#bacac5]">
                    <For each={['VS Code', 'Android', 'Python', 'Node']}>
                        {(label, index) => (
                            <label class="flex items-center gap-2 transition-all duration-300 hover:text-white cursor-pointer group" style={{
                                opacity: 1,
                                transform: 'translateX(0)',
                                transition: `all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${index() * 50}ms`
                            }}>
                                <input
                                    checked
                                    type="checkbox"
                                    class="h-3.5 w-3.5 rounded border-none bg-[#111319] text-[#57f1db] focus:ring-0 transition-all duration-300 group-hover:shadow-[0_0_8px_rgba(45,212,191,0.4)]"
                                />
                                <span class="transition-all duration-300">{label}</span>
                            </label>
                        )}
                    </For>
                </div>
            </div>
            <div class="h-px bg-gradient-to-r from-white/5 via-white/10 to-white/5" />
            <div>
                <h3 class="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#bacac5]/45">
                    Risk Level
                </h3>
                <div class="space-y-2 text-xs text-[#bacac5]">
                    <For each={['Safe', 'Optional', 'Critical']}>
                        {(label, index) => (
                            <label class="flex items-center gap-2 transition-all duration-300 hover:text-white cursor-pointer group" style={{
                                opacity: 1,
                                transform: 'translateX(0)',
                                transition: `all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${index() * 50}ms`
                            }}>
                                <input
                                    checked
                                    type="checkbox"
                                    class="h-3.5 w-3.5 rounded border-none bg-[#111319] text-[#57f1db] focus:ring-0 transition-all duration-300 group-hover:shadow-[0_0_8px_rgba(45,212,191,0.4)]"
                                />
                                <span class="transition-all duration-300">{label}</span>
                            </label>
                        )}
                    </For>
                </div>
            </div>
        </div>
    )

    return (
        <DesktopShell
            active="results"
            eyebrow="System / Results"
            topMetric="3.2GB Cleanable"
            rightMeta="scan / results"
            sidebarContent={sidebarFilters}
        >
            <div class="space-y-8">
                <Show when={deletionSummary()}>
                    {(summary) => (
                        <section class="relative overflow-hidden rounded-[30px] border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] px-6 py-10 text-center animate-in fade-in slide-in-from-bottom duration-500 ease-out">
                            <div class="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-[#57f1db]/8 blur-[120px]" />
                            <div class="relative mx-auto max-w-3xl">
                                <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#57f1db]/20 bg-[#57f1db]/10 shadow-[0_0_40px_rgba(87,241,219,0.15)] animate-in zoom-in duration-700 delay-100">
                                    <span
                                        class="material-symbols-outlined text-4xl text-[#57f1db] animate-pulse"
                                        style={{
                                            'font-variation-settings': "'FILL' 1",
                                        }}
                                    >
                                        verified
                                    </span>
                                </div>
                                <p class="font-mono text-[10px] uppercase tracking-[0.4em] text-[#57f1db] animate-in fade-in duration-500 delay-200">
                                    Cleanup Complete
                                </p>
                                <div class="mt-3 flex items-end justify-center gap-3 animate-in fade-in slide-in-from-bottom duration-700 delay-300">
                                    <span class="font-headline text-6xl font-extrabold tracking-tight text-white">
                                        {(
                                            summary().bytes /
                                            1024 /
                                            1024 /
                                            1024
                                        ).toFixed(1)}
                                    </span>
                                    <span class="font-headline text-3xl font-bold text-white/55">
                                        GB
                                    </span>
                                </div>
                                <p class="mt-2 text-lg text-[#bacac5] animate-in fade-in duration-500 delay-400">
                                    Freed from your local environment
                                </p>
                                <div class="mt-6 flex flex-wrap justify-center gap-3 animate-in fade-in duration-500 delay-500">
                                    <button
                                        class="rounded-full bg-gradient-to-br from-[#57f1db] to-[#2dd4bf] px-7 py-3 text-sm font-bold text-[#003731] transition-all duration-300 hover:shadow-[0_0_24px_rgba(87,241,219,0.22)] hover:scale-105 active:scale-95"
                                        onClick={() => navigate('/scan')}
                                    >
                                        Scan Again
                                    </button>
                                    <button class="rounded-full bg-[#33343b] px-7 py-3 text-sm font-bold text-white transition-all duration-300 hover:bg-[#373940] hover:scale-105 active:scale-95">
                                        Share Report
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}
                </Show>

                <Show
                    when={results().length > 0}
                    fallback={
                        <section class="rounded-[30px] border border-white/5 bg-[#1e1f26] p-10 text-center animate-in fade-in slide-in-from-bottom duration-500 ease-out">
                            <h2 class="font-headline text-3xl font-extrabold text-white">
                                No scan results yet
                            </h2>
                            <p class="mt-3 text-sm text-[#bacac5]">
                                Run a scan to populate the results table and
                                deletion workflow.
                            </p>
                            <button
                                class="mt-6 rounded-full bg-gradient-to-br from-[#57f1db] to-[#2dd4bf] px-7 py-3 text-sm font-bold text-[#003731] transition-all duration-300 hover:shadow-[0_0_24px_rgba(87,241,219,0.22)] hover:scale-105 active:scale-95"
                                onClick={() => navigate('/scan')}
                            >
                                Start New Scan
                            </button>
                        </section>
                    }
                >
                    <div class="flex items-center justify-between animate-in fade-in slide-in-from-left duration-500">
                        <h1 class="font-headline text-3xl font-extrabold tracking-tight text-white">
                            Scan Results
                        </h1>
                        <div class="flex items-center gap-3">
                            <button
                                class="rounded-full border border-white/10 bg-[#1e1f26] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#bacac5] transition-all duration-300 hover:border-[#57f1db]/20 hover:scale-105 active:scale-95"
                                onClick={handleSelectAll}
                            >
                                Select Visible
                            </button>
                            <span class="font-mono text-[10px] uppercase tracking-[0.2em] text-[#bacac5]/45">
                                Sorted by size
                            </span>
                        </div>
                    </div>

                    <div class="rounded-[30px] border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-6 animate-in fade-in slide-in-from-bottom duration-700 delay-100">
                        <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
                            <div class="flex flex-wrap gap-2">
                                <For
                                    each={
                                        [
                                            'all',
                                            'keep',
                                            'delete',
                                            'review',
                                        ] as const
                                    }
                                >
                                    {(value, index) => (
                                        <button
                                             class={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-all duration-300 active:scale-95 hover:scale-105 animate-in fade-in slide-in-from-left ${
                                                 filter() === value
                                                     ? 'bg-gradient-to-r from-[#2dd4bf] to-[#57f1db] text-[#003731] shadow-[0_4px_12px_rgba(45,212,191,0.3)]'
                                                     : 'bg-[#33343b] text-white hover:bg-[#373940]'
                                             }`}
                                             style={{
                                                 'animation-delay': `${index() * 50}ms`
                                             }}
                                            onClick={() => setFilter(value)}
                                        >
                                            {value}
                                        </button>
                                    )}
                                </For>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="font-mono text-[10px] uppercase tracking-[0.2em] text-[#bacac5]/45">
                                    {selectedResults().length} selected
                                </span>
                                <button
                                    class="rounded-full border border-[#57f1db]/20 bg-gradient-to-r from-[#57f1db]/15 to-[#2dd4bf]/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#57f1db] transition-all duration-300 hover:border-[#57f1db]/40 hover:shadow-[0_4px_12px_rgba(87,241,219,0.2)] hover:scale-105 active:scale-95"
                                    onClick={() =>
                                        setSelectedResults(
                                            filteredResults()
                                                .filter(
                                                    (result) =>
                                                        result.classification ===
                                                        'safe'
                                                )
                                                .map((result) => result.id)
                                        )
                                    }
                                >
                                    Select Safe
                                </button>
                            </div>
                        </div>

                        <div class="mb-4 grid grid-cols-12 px-4 text-[10px] uppercase tracking-[0.22em] text-[#bacac5]/35">
                            <div class="col-span-5">
                                Resource &amp; Location
                            </div>
                            <div class="col-span-2 text-center">Category</div>
                            <div class="col-span-3">Disk Usage</div>
                            <div class="col-span-2 text-right">Action</div>
                        </div>

                        <div class="space-y-2">
                            <For each={filteredResults()}>
                                {(result, index) => {
                                    const categoryClass =
                                        result.classification === 'critical'
                                            ? 'bg-[#93000a]/15 text-[#ffb4ab]'
                                            : result.classification ===
                                                'optional'
                                              ? 'bg-[#ffac5a]/10 text-[#ffd1aa]'
                                              : 'bg-[#2dd4bf]/10 text-[#57f1db]'

                                    const icon =
                                        result.classification === 'critical'
                                            ? 'terminal'
                                            : result.path
                                                    .toLowerCase()
                                                    .includes('android')
                                              ? 'android'
                                              : result.path
                                                      .toLowerCase()
                                                      .includes('node')
                                                ? 'javascript'
                                                : 'code_blocks'

                                    return (
                                        <div
                                            class={`grid grid-cols-12 items-center rounded-2xl border-l-2 px-4 py-4 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg animate-in fade-in slide-in-from-left ${
                                                result.classification ===
                                                'critical'
                                                    ? 'border-[#ffb4ab] bg-[#191b22] hover:bg-[#22242c] hover:border-[#ffb4ab]/80 hover:shadow-[0_8px_24px_rgba(255,180,171,0.1)]'
                                                    : 'border-transparent bg-[#191b22] hover:border-[#57f1db] hover:bg-[#22242c] hover:shadow-[0_8px_24px_rgba(45,212,191,0.1)]'
                                            }`}
                                            style={{
                                                'animation-delay': `${Math.min(index() * 30, 300)}ms`
                                            }}
                                        >
                                            <div class="col-span-5 flex items-center gap-4">
                                                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#57f1db]/20 to-[#2dd4bf]/10 text-[#57f1db]/80 transition-all duration-300 group-hover:scale-110">
                                                    <span class="material-symbols-outlined">
                                                        {icon}
                                                    </span>
                                                </div>
                                                <div class="min-w-0">
                                                    <p class="truncate text-sm font-semibold text-white">
                                                        {result.path
                                                            .split(/[/\\]/)
                                                            .pop()}
                                                    </p>
                                                    <p class="truncate font-mono text-[10px] text-[#bacac5]/50">
                                                        {result.path}
                                                    </p>
                                                </div>
                                            </div>
                                            <div class="col-span-2 flex justify-center">
                                                <span
                                                    class={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] transition-all duration-300 ${categoryClass}`}
                                                >
                                                    {result.classification}
                                                </span>
                                            </div>
                                            <div class="col-span-3 pr-8">
                                                <div class="mb-1 flex items-end justify-between">
                                                    <span class="font-mono text-xs text-white">
                                                        {formatBytes(
                                                            result.size
                                                        )}
                                                    </span>
                                                    <span class="font-mono text-[9px] text-[#bacac5]/45">
                                                        score {result.score}
                                                    </span>
                                                </div>
                                                <div class="h-1 overflow-hidden rounded-full bg-[#33343b]">
                                                    <div
                                                        class={`h-full transition-all duration-500 ${
                                                            result.classification ===
                                                            'critical'
                                                                ? 'bg-gradient-to-r from-[#ffb4ab] to-[#ff8a80]'
                                                                : result.classification ===
                                                                    'optional'
                                                                  ? 'bg-gradient-to-r from-[#ffd1aa] to-[#ffac5a]'
                                                                  : 'bg-gradient-to-r from-[#57f1db] to-[#2dd4bf]'
                                                        }`}
                                                        style={{
                                                            width: `${Math.min(result.score, 100)}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div class="col-span-2 flex items-center justify-end gap-3">
                                                <button
                                                    class="rounded-full border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:border-[#57f1db]/30 hover:bg-[#57f1db]/10 hover:scale-105 active:scale-95"
                                                    onClick={() =>
                                                        IPC.showInFolder(
                                                            result.path
                                                        )
                                                    }
                                                >
                                                    Open
                                                </button>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedResults().includes(
                                                        result.id
                                                    )}
                                                    onChange={(event) =>
                                                        handleSelect(
                                                            result.id,
                                                            event.currentTarget
                                                                .checked
                                                        )
                                                    }
                                                    class="h-5 w-5 rounded border-none bg-[#111319] text-[#57f1db] focus:ring-0 transition-all duration-300 cursor-pointer hover:shadow-[0_0_8px_rgba(87,241,219,0.4)]"
                                                />
                                            </div>
                                        </div>
                                    )
                                }}
                            </For>
                        </div>
                    </div>
                </Show>
            </div>

            <Show when={results().length > 0}>
                <footer class="fixed bottom-0 left-0 right-0 border-t border-white/5 bg-[rgba(55,57,64,0.6)] px-6 py-4 backdrop-blur-xl lg:left-64 lg:px-8 animate-in slide-in-from-bottom duration-500">
                    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div class="flex flex-wrap items-center gap-6">
                            <div class="flex items-center gap-3 transition-all duration-300">
                                <span class="font-headline text-2xl font-bold text-[#57f1db]">
                                    {selectedResults().length}
                                </span>
                                <span class="font-mono text-[10px] uppercase tracking-[0.2em] text-[#bacac5]/45">
                                    items selected
                                </span>
                            </div>
                            <div class="hidden h-8 w-px bg-gradient-to-b from-white/10 via-white/20 to-white/10 md:block" />
                            <div class="flex items-center gap-3 transition-all duration-300">
                                <div class="flex items-baseline gap-2">
                                    <span class="font-mono text-lg text-white">
                                        {formatBytes(selectedBytes())}
                                    </span>
                                    <span class="material-symbols-outlined text-[#57f1db] animate-pulse">
                                        arrow_right_alt
                                    </span>
                                    <span class="font-mono text-lg font-bold text-[#57f1db]">
                                        0.0 GB
                                    </span>
                                </div>
                                <span class="font-mono text-[10px] uppercase tracking-[0.2em] text-[#bacac5]/45">
                                    Potential savings
                                </span>
                            </div>
                        </div>

                        <button
                            class="inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#93000a] to-[#b00010] px-8 py-3 text-xs font-bold uppercase tracking-[0.22em] text-white shadow-lg shadow-[#93000a]/20 transition-all duration-300 hover:shadow-[0_12px_32px_rgba(147,0,10,0.4)] hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                            disabled={selectedResults().length === 0}
                            onClick={() => setConfirmDelete(true)}
                        >
                            <span class="material-symbols-outlined">
                                delete_sweep
                            </span>
                            Delete Selected
                        </button>
                    </div>
                </footer>
            </Show>

            <Show when={confirmDelete()}>
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-[#111319]/80 px-4 backdrop-blur-md animate-in fade-in duration-300">
                    <div class="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/5 bg-[rgba(55,57,64,0.6)] shadow-2xl animate-in zoom-in duration-400 ease-out">
                        <div class="h-1 bg-gradient-to-r from-[#ffb4ab]/70 via-[#93000a] to-[#ffb4ab]/70 animate-pulse" />
                        <div class="p-8">
                            <div class="mb-8 flex items-start justify-between animate-in fade-in slide-in-from-top duration-400 delay-100">
                                <div>
                                    <h2 class="font-headline text-2xl font-extrabold text-white">
                                        Confirm Deletion
                                    </h2>
                                    <p class="mt-1 text-sm text-[#bacac5]">
                                        Review the high-impact items selected
                                        for removal.
                                    </p>
                                </div>
                                <div class="rounded-2xl bg-[#93000a]/15 p-3 animate-in zoom-in duration-500 delay-200">
                                    <span
                                        class="material-symbols-outlined text-3xl text-[#ffb4ab] animate-pulse"
                                        style={{
                                            'font-variation-settings': "'FILL' 1",
                                        }}
                                    >
                                        delete_forever
                                    </span>
                                </div>
                            </div>

                            <div class="mb-8 rounded-2xl border border-[#ffb4ab]/10 bg-gradient-to-br from-[#0c0e14] to-[#111319] p-6 text-center animate-in fade-in slide-in-from-bottom duration-400 delay-150">
                                <p class="font-mono text-5xl font-bold tracking-tight text-[#ffb4ab]">
                                    {formatBytes(selectedBytes())}
                                </p>
                                <p class="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#bacac5]/45">
                                    Total space reclaimed
                                </p>
                            </div>

                            <div class="mb-8 space-y-3 animate-in fade-in duration-400 delay-200">
                                <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-[#bacac5]/45">
                                    Top impact items
                                </p>
                                <For each={selectedRows().slice(0, 5)}>
                                    {(result, index) => (
                                        <div class="flex items-center justify-between rounded-2xl bg-[#282a30] px-4 py-3 transition-all duration-300 hover:bg-[#333540] animate-in fade-in slide-in-from-left" style={{
                                            'animation-delay': `${300 + index() * 50}ms`
                                        }}>
                                            <div class="min-w-0">
                                                <p class="truncate text-sm font-semibold text-white">
                                                    {result.path
                                                        .split(/[/\\]/)
                                                        .pop()}
                                                </p>
                                                <p class="truncate font-mono text-[10px] text-[#bacac5]/45">
                                                    {result.path}
                                                </p>
                                            </div>
                                            <span class="font-mono text-xs text-[#57f1db]">
                                                {formatBytes(result.size)}
                                            </span>
                                        </div>
                                    )}
                                </For>
                            </div>

                            <div class="mb-8 flex items-start gap-3 rounded-2xl border-l-2 border-[#ffb4ab] bg-[#93000a]/10 p-4 animate-in fade-in slide-in-from-bottom duration-400 delay-300">
                                <span class="material-symbols-outlined text-[#ffb4ab]">
                                    warning
                                </span>
                                <p class="text-xs leading-6 text-[#ffb4ab]">
                                    This action cannot be undone. These files
                                    will be permanently deleted from local
                                    storage and won&apos;t be restored from the
                                    recycle bin by DevSweep.
                                </p>
                            </div>

                            <div class="flex gap-4 animate-in fade-in duration-400 delay-400">
                                <button
                                    class="flex-1 rounded-full border border-white/10 px-6 py-3 text-sm font-bold text-[#bacac5] transition-all duration-300 hover:bg-[#33343b] hover:text-white hover:scale-105 active:scale-95"
                                    onClick={() => setConfirmDelete(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    class="flex-[2] rounded-full bg-gradient-to-r from-[#93000a] to-[#b00010] px-6 py-3 text-sm font-bold text-white transition-all duration-300 hover:brightness-110 hover:scale-105 active:scale-95"
                                    onClick={handleDeleteSelected}
                                >
                                    Confirm Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>
        </DesktopShell>
    )
}
