import { createSignal, For, Show, onMount } from 'solid-js'
import { IPC, type AppSettings, type SystemInfo, type SystemOverview } from '../lib/ipc'
import { clearHistoryState, loadHistory } from '../stores/scan'
import { setTheme } from '../stores/ui'
import { DesktopShell } from '../ui/DesktopShell'

type ScanFrequency = 'manual' | 'weekly' | 'monthly'
type ToolKey = 'vscode' | 'android' | 'node' | 'python'

const defaultSettings: AppSettings = {
    appearance: {
        theme: 'dark',
    },
    ai: {
        enabled: true,
        provider: 'ollama',
        model: 'llama3.2',
        baseUrl: 'http://localhost:11434',
    },
    scanning: {
        frequency: 'manual',
        includeHidden: true,
        followSymlinks: false,
        toolsets: {
            vscode: true,
            android: true,
            node: true,
            python: false,
        },
    },
    exclusions: [],
}

const toolLabels: Record<ToolKey, string> = {
    vscode: 'VS Code cache and workspace data',
    android: 'Android SDK and IDE data',
    node: 'Node.js and npm caches',
    python: 'Python caches and virtualenv artifacts',
}

export default function Settings() {
    const [settings, setSettingsState] = createSignal<AppSettings>(defaultSettings)
    const [overview, setOverview] = createSignal<SystemOverview>()
    const [systemInfo, setSystemInfo] = createSignal<SystemInfo>()
    const [pendingPath, setPendingPath] = createSignal('')
    const [statusMessage, setStatusMessage] = createSignal<string>()
    const [isSaving, setIsSaving] = createSignal(false)
    const [isTesting, setIsTesting] = createSignal(false)

    onMount(async () => {
        void loadHistory()
        try {
            const [settingsResult, overviewResult, infoResult] =
                await Promise.allSettled([
                    IPC.getSettings(),
                    IPC.getSystemOverview(),
                    IPC.getSystemInfo(),
                ])

            if (settingsResult.status === 'fulfilled') {
                setSettingsState(settingsResult.value)
                setTheme(settingsResult.value.appearance.theme)
            } else {
                console.error(
                    'Failed to load settings:',
                    settingsResult.reason
                )
                setStatusMessage(
                    'Using local defaults until the sidecar responds.'
                )
            }

            if (overviewResult.status === 'fulfilled') {
                setOverview(overviewResult.value)
            } else {
                console.error(
                    'Failed to load system overview:',
                    overviewResult.reason
                )
            }

            if (infoResult.status === 'fulfilled') {
                setSystemInfo(infoResult.value)
            } else {
                console.error(
                    'Failed to load system information:',
                    infoResult.reason
                )
            }
        } catch (error) {
            console.error('Failed to initialize settings view:', error)
            setStatusMessage('Using local defaults until the sidecar responds.')
        }
    })

    const setSettings = (updater: (current: AppSettings) => AppSettings) => {
        setSettingsState((current) => {
            const next = updater(current)
            setTheme(next.appearance.theme)
            return next
        })
    }

    const visibleManagedTargets = () =>
        (overview()?.managedTargets ?? []).filter(
            (target) =>
                settings().scanning.toolsets[
                    target.tool as ToolKey
                ]
        )

    const addExcludedPath = () => {
        const trimmed = pendingPath().trim()
        if (!trimmed) return
        setSettings((current) => ({
            ...current,
            exclusions: [...current.exclusions, trimmed],
        }))
        setPendingPath('')
    }

    const removeExcludedPath = (path: string) => {
        setSettings((current) => ({
            ...current,
            exclusions: current.exclusions.filter((entry) => entry !== path),
        }))
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await IPC.updateSettings(settings())
            setStatusMessage('Preferences saved to the local sidecar.')
            setOverview(await IPC.getSystemOverview())
        } catch (error) {
            console.error('Failed to save settings:', error)
            setStatusMessage('Could not save preferences.')
        } finally {
            setIsSaving(false)
        }
    }

    const handleTestConnection = async () => {
        setIsTesting(true)
        try {
            await IPC.testAIConnection()
            setStatusMessage('Ollama responded successfully.')
        } catch (error) {
            console.error('Failed to test AI connection:', error)
            setStatusMessage('Could not reach the local AI server.')
        } finally {
            setIsTesting(false)
        }
    }

    const handleClearHistory = async () => {
        try {
            await clearHistoryState()
            setStatusMessage('Stored scan history was cleared.')
        } catch (error) {
            console.error('Failed to clear scan history:', error)
            setStatusMessage('Could not clear scan history.')
        }
    }

    return (
        <DesktopShell
            active="settings"
            eyebrow="settings and theme"
            topMetric={`${overview()?.managedTargets.length ?? 0} managed targets`}
            rightMeta="settings / live preferences"
        >
            <div class="space-y-8">
                <Show when={statusMessage()}>
                    {(message) => (
                        <div class="shell-panel px-4 py-3 text-sm text-[var(--text-muted)]">
                            {message()}
                        </div>
                    )}
                </Show>

                <div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
                    <section class="space-y-6">
                        <section class="shell-panel p-6">
                            <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                Appearance
                            </p>
                            <div class="mt-4 flex gap-3">
                                <For each={['dark', 'light'] as const}>
                                    {(themeValue) => (
                                        <button
                                            class={`rounded-full border px-4 py-2 text-sm font-semibold ${
                                                settings().appearance.theme ===
                                                themeValue
                                                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                                    : 'border-[var(--border)]'
                                            }`}
                                            onClick={() =>
                                                setSettings((current) => ({
                                                    ...current,
                                                    appearance: {
                                                        theme: themeValue,
                                                    },
                                                }))
                                            }
                                        >
                                            {themeValue}
                                        </button>
                                    )}
                                </For>
                            </div>
                        </section>

                        <section class="shell-panel p-6">
                            <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                Scan behavior
                            </p>
                            <div class="mt-4 flex flex-wrap gap-3">
                                <For
                                    each={
                                        ['manual', 'weekly', 'monthly'] as ScanFrequency[]
                                    }
                                >
                                    {(frequency) => (
                                        <button
                                            class={`rounded-full border px-4 py-2 text-sm font-semibold capitalize ${
                                                settings().scanning.frequency ===
                                                frequency
                                                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                                    : 'border-[var(--border)]'
                                            }`}
                                            onClick={() =>
                                                setSettings((current) => ({
                                                    ...current,
                                                    scanning: {
                                                        ...current.scanning,
                                                        frequency,
                                                    },
                                                }))
                                            }
                                        >
                                            {frequency}
                                        </button>
                                    )}
                                </For>
                            </div>
                            <label class="mt-4 inline-flex items-center gap-3 text-sm text-[var(--text)]">
                                <input
                                    type="checkbox"
                                    checked={settings().scanning.includeHidden}
                                    class="h-4 w-4 accent-[var(--accent)]"
                                    onChange={(event) =>
                                        setSettings((current) => ({
                                            ...current,
                                            scanning: {
                                                ...current.scanning,
                                                includeHidden:
                                                    event.currentTarget.checked,
                                            },
                                        }))
                                    }
                                />
                                Include hidden files by default
                            </label>
                        </section>

                        <section class="shell-panel p-6">
                            <div class="flex items-center justify-between">
                                <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                    Exclusions
                                </p>
                                <span class="text-sm text-[var(--text-muted)]">
                                    {settings().exclusions.length.toLocaleString()}{' '}
                                    paths protected
                                </span>
                            </div>
                            <div class="mt-4 flex gap-3">
                                <input
                                    class="field"
                                    value={pendingPath()}
                                    placeholder="Add a path like S:\Projects\Archive"
                                    onInput={(event) =>
                                        setPendingPath(event.currentTarget.value)
                                    }
                                />
                                <button
                                    class="secondary-button"
                                    onClick={addExcludedPath}
                                >
                                    Add
                                </button>
                            </div>
                            <div class="mt-4 space-y-3">
                                <For each={settings().exclusions}>
                                    {(path) => (
                                        <div class="subtle-panel flex items-center justify-between gap-4 p-4">
                                            <span class="truncate text-sm text-[var(--text)]">
                                                {path}
                                            </span>
                                            <button
                                                class="text-sm font-semibold text-[var(--danger)]"
                                                onClick={() =>
                                                    removeExcludedPath(path)
                                                }
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </section>
                    </section>

                    <section class="space-y-6">
                        <section class="shell-panel p-6">
                            <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                Tool targets
                            </p>
                            <div class="mt-4 space-y-3">
                                <For
                                    each={
                                        Object.entries(toolLabels) as [
                                            ToolKey,
                                            string,
                                        ][]
                                    }
                                >
                                    {([key, label]) => (
                                        <button
                                            class="subtle-panel flex w-full items-center justify-between p-4 text-left"
                                            onClick={() =>
                                                setSettings((current) => ({
                                                    ...current,
                                                    scanning: {
                                                        ...current.scanning,
                                                        toolsets: {
                                                            ...current.scanning
                                                                .toolsets,
                                                            [key]:
                                                                !current
                                                                    .scanning
                                                                    .toolsets[
                                                                    key
                                                                ],
                                                        },
                                                    },
                                                }))
                                            }
                                        >
                                            <div>
                                                <p class="text-sm font-semibold">
                                                    {label}
                                                </p>
                                                <p class="mt-1 text-xs text-[var(--text-muted)]">
                                                    {settings().scanning.toolsets[
                                                        key
                                                    ]
                                                        ? 'Included in machine analysis'
                                                        : 'Excluded from tool-specific buckets'}
                                                </p>
                                            </div>
                                            <span class="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                                                {settings().scanning.toolsets[key]
                                                    ? 'on'
                                                    : 'off'}
                                            </span>
                                        </button>
                                    )}
                                </For>
                            </div>
                        </section>

                        <section class="shell-panel p-6">
                            <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                Managed target preview
                            </p>
                            <div class="mt-4 space-y-3">
                                <For each={visibleManagedTargets()}>
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
                        </section>

                        <section class="shell-panel p-6">
                            <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                Local AI
                            </p>
                            <div class="mt-4 space-y-4">
                                <label class="inline-flex items-center gap-3 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={settings().ai.enabled}
                                        class="h-4 w-4 accent-[var(--accent)]"
                                        onChange={(event) =>
                                            setSettings((current) => ({
                                                ...current,
                                                ai: {
                                                    ...current.ai,
                                                    enabled:
                                                        event.currentTarget
                                                            .checked,
                                                },
                                            }))
                                        }
                                    />
                                    Enable Ollama assistance
                                </label>
                                <input
                                    class="field"
                                    value={settings().ai.model}
                                    onInput={(event) =>
                                        setSettings((current) => ({
                                            ...current,
                                            ai: {
                                                ...current.ai,
                                                model: event.currentTarget.value,
                                            },
                                        }))
                                    }
                                />
                                <input
                                    class="field"
                                    value={settings().ai.baseUrl}
                                    onInput={(event) =>
                                        setSettings((current) => ({
                                            ...current,
                                            ai: {
                                                ...current.ai,
                                                baseUrl:
                                                    event.currentTarget.value,
                                            },
                                        }))
                                    }
                                />
                                <button
                                    class="secondary-button"
                                    disabled={isTesting()}
                                    onClick={() => void handleTestConnection()}
                                >
                                    {isTesting()
                                        ? 'Testing...'
                                        : 'Test AI connection'}
                                </button>
                            </div>
                        </section>
                    </section>
                </div>

                <div class="grid gap-6 xl:grid-cols-[1fr_320px]">
                    <section class="shell-panel p-6">
                        <div class="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                                    Save
                                </p>
                                <p class="mt-2 text-sm text-[var(--text-muted)]">
                                    Persist appearance, scan behavior, and AI
                                    settings to the local sidecar.
                                </p>
                            </div>
                            <button
                                class="action-button"
                                disabled={isSaving()}
                                onClick={() => void handleSave()}
                            >
                                {isSaving() ? 'Saving...' : 'Save preferences'}
                            </button>
                        </div>
                    </section>

                    <section class="shell-panel p-6">
                        <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">
                            Runtime
                        </p>
                        <p class="mt-2 text-sm font-semibold">
                            {systemInfo()?.platform ?? 'desktop'} ·{' '}
                            {systemInfo()?.arch ?? 'x64'}
                        </p>
                        <p class="mt-1 text-sm text-[var(--text-muted)]">
                            Tauri + FastAPI sidecar
                        </p>
                        <button
                            class="danger-button mt-6"
                            onClick={() => void handleClearHistory()}
                        >
                            Clear scan history
                        </button>
                    </section>
                </div>
            </div>
        </DesktopShell>
    )
}
