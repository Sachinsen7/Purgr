import { useNavigate } from '@solidjs/router'
import { createSignal, For, onMount, Show } from 'solid-js'
import { IPC, type AppSettings } from '../lib/ipc'
import { DesktopShell } from '../ui/DesktopShell'

type ScanFrequency = 'manual' | 'weekly' | 'monthly'

type ToolKey = 'vscode' | 'android' | 'node' | 'python'

const defaultSettings: AppSettings = {
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
    exclusions: [
        '~/Projects/CriticalProject/',
        '/etc/system_secrets/',
        '~/Downloads/Archive/',
    ],
}

const navItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Scan', href: '/scan' },
    { label: 'Results', href: '/results' },
    { label: 'Settings', href: '/settings' },
] as const

const toolLabels: Record<ToolKey, string> = {
    vscode: 'VS Code Cache',
    android: 'Android SDK Tools',
    node: 'Node.js / NPM',
    python: 'Python Venvs',
}

const frequencyOptions: readonly ScanFrequency[] = [
    'manual',
    'weekly',
    'monthly',
]

export default function Settings() {
    const navigate = useNavigate()
    const [settings, setSettings] = createSignal<AppSettings>(defaultSettings)
    const [isSaving, setIsSaving] = createSignal(false)
    const [isTesting, setIsTesting] = createSignal(false)
    const [statusMessage, setStatusMessage] = createSignal<string>()
    const [pendingPath, setPendingPath] = createSignal('')
    const [systemInfo, setSystemInfo] = createSignal({
        platform: 'desktop',
        arch: 'x64',
        version: '0.1.0',
    })

    onMount(async () => {
        try {
            const [loadedSettings, info] = await Promise.all([
                IPC.getSettings(),
                IPC.getSystemInfo(),
            ])
            setSettings(loadedSettings)
            setSystemInfo(info)
        } catch (error) {
            console.error('Failed to load settings:', error)
            setStatusMessage(
                'Using local defaults until the sidecar is available.'
            )
        }
    })

    const updateFrequency = (frequency: ScanFrequency) => {
        setSettings((current) => ({
            ...current,
            scanning: {
                ...current.scanning,
                frequency,
            },
        }))
    }

    const toggleToolset = (tool: ToolKey) => {
        setSettings((current) => ({
            ...current,
            scanning: {
                ...current.scanning,
                toolsets: {
                    ...current.scanning.toolsets,
                    [tool]: !current.scanning.toolsets[tool],
                },
            },
        }))
    }

    const toggleAI = () => {
        setSettings((current) => ({
            ...current,
            ai: {
                ...current.ai,
                enabled: !current.ai.enabled,
            },
        }))
    }

    const updateAIModel = (value: string) => {
        setSettings((current) => ({
            ...current,
            ai: {
                ...current.ai,
                model: value,
            },
        }))
    }

    const updateAIBaseUrl = (value: string) => {
        setSettings((current) => ({
            ...current,
            ai: {
                ...current.ai,
                baseUrl: value,
            },
        }))
    }

    const addExcludedPath = () => {
        const trimmed = pendingPath().trim()
        if (!trimmed) {
            return
        }

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
        setStatusMessage(undefined)

        try {
            await IPC.updateSettings(settings())
            setStatusMessage('Preferences saved locally.')
        } catch (error) {
            console.error('Failed to save settings:', error)
            setStatusMessage(
                'Could not save preferences. The backend sidecar may still be offline.'
            )
        } finally {
            setIsSaving(false)
        }
    }

    const handleTestConnection = async () => {
        setIsTesting(true)
        setStatusMessage(undefined)

        try {
            await IPC.testAIConnection()
            setStatusMessage('Ollama responded successfully.')
        } catch (error) {
            console.error('Failed to test AI connection:', error)
            setStatusMessage(
                'Could not reach Ollama. Check that the local server is running.'
            )
        } finally {
            setIsTesting(false)
        }
    }

    const handleClearHistory = async () => {
        try {
            await IPC.clearScanHistory()
            setStatusMessage('Stored scan history was cleared.')
        } catch (error) {
            console.error('Failed to clear scan history:', error)
            setStatusMessage('Could not clear scan history.')
        }
    }

    return (
        <DesktopShell
            active="settings"
            eyebrow="System / Settings / Preferences"
            topMetric="3.2GB Cleanable"
            rightMeta="settings / configuration"
        >
            <div class="space-y-8">
                <Show when={statusMessage()}>
                    {(message) => (
                        <div class="rounded-2xl border border-[#2dd4bf]/15 bg-gradient-to-r from-[#1a1d22] to-[#191b22] px-4 py-3 text-sm text-[#bacac5] animate-in fade-in slide-in-from-top duration-500">
                            {message()}
                        </div>
                    )}
                </Show>

                <div class="grid gap-8 xl:grid-cols-[1.35fr_1fr]">
                    <section class="space-y-8">
                        <section class="animate-in fade-in slide-in-from-left duration-700">
                            <div class="mb-3 flex items-center gap-2">
                                <span class="text-xs uppercase tracking-[0.25em] text-[#57f1db]">
                                    Scan Frequency
                                </span>
                            </div>
                            <div class="rounded-3xl border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-2">
                                <div class="grid gap-2 sm:grid-cols-3">
                                    <For each={frequencyOptions}>
                                        {(option, index) => (
                                            <button
                                                class={`rounded-2xl px-4 py-4 text-sm font-bold capitalize transition-all duration-300 hover:scale-105 active:scale-95 animate-in fade-in ${
                                                    settings().scanning
                                                        .frequency ===
                                                    option
                                                        ? 'bg-gradient-to-r from-[#2dd4bf] to-[#57f1db] text-[#003731] shadow-[0_8px_20px_rgba(45,212,191,0.2)]'
                                                        : 'text-[#bacac5] hover:bg-[#282a30] hover:text-white'
                                                }`}
                                                style={{
                                                    'animation-delay': `${index() * 75}ms`
                                                }}
                                                onClick={() =>
                                                    updateFrequency(option)
                                                }
                                            >
                                                {option}
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </div>
                            <p class="mt-3 px-1 text-xs text-[#bacac5]/70">
                                Background scans stay low priority so local
                                builds and editors remain responsive.
                            </p>
                        </section>

                        <section class="animate-in fade-in slide-in-from-left duration-700 delay-150">
                            <div class="mb-3 flex items-center justify-between">
                                <span class="text-xs uppercase tracking-[0.25em] text-[#57f1db]">
                                    Excluded Directories
                                </span>
                                <span class="font-mono text-[11px] uppercase tracking-[0.24em] text-[#bacac5]/45">
                                    {settings().exclusions.length} protected
                                </span>
                            </div>

                            <div class="rounded-3xl border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-5">
                                <div class="mb-4 flex flex-col gap-3 md:flex-row">
                                    <input
                                        class="min-h-12 flex-1 rounded-2xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white outline-none transition-all duration-300 placeholder:text-[#bacac5]/35 focus:border-[#2dd4bf]/40 focus:shadow-[0_0_12px_rgba(45,212,191,0.1)] hover:border-white/20"
                                        placeholder="Add a path like S:\\Projects\\Billing or ~/Work/archive"
                                        value={pendingPath()}
                                        onInput={(event) =>
                                            setPendingPath(
                                                event.currentTarget.value
                                            )
                                        }
                                    />
                                    <button
                                        class="rounded-2xl bg-gradient-to-r from-[#2dd4bf] to-[#57f1db] px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[#003731] transition-all duration-300 hover:shadow-[0_4px_12px_rgba(45,212,191,0.3)] hover:scale-105 active:scale-95"
                                        onClick={addExcludedPath}
                                    >
                                        Add Path
                                    </button>
                                </div>

                                <div class="grid gap-3 md:grid-cols-2">
                                    <For each={settings().exclusions}>
                                        {(path, index) => (
                                            <div class="flex items-center justify-between rounded-2xl border border-white/5 bg-[#111319] px-4 py-3 transition-all duration-300 hover:border-[#2dd4bf]/20 hover:bg-[#0f1119] animate-in fade-in" style={{
                                                'animation-delay': `${index() * 50}ms`
                                            }}>
                                                <span class="truncate font-mono text-xs text-[#bacac5]">
                                                    {path}
                                                </span>
                                                <button
                                                    class="ml-4 text-xs font-bold uppercase tracking-[0.18em] text-[#ffb4ab] transition-all duration-300 hover:text-white hover:scale-110 active:scale-95"
                                                    onClick={() =>
                                                        removeExcludedPath(
                                                            path
                                                        )
                                                    }
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </section>

                        <section class="rounded-[28px] border border-[#ffb4ab]/10 bg-gradient-to-br from-[#300d14]/40 to-[#300d14]/20 p-6 animate-in fade-in slide-in-from-left duration-700 delay-300">
                            <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p class="font-headline text-xl font-bold text-[#ffb4ab]">
                                        Danger Zone
                                    </p>
                                    <p class="mt-2 max-w-xl text-sm text-[#bacac5]">
                                        Clearing history removes saved scan
                                        sessions and the audit trail used
                                        for previous cleanup reviews.
                                    </p>
                                </div>
                                <button
                                    class="rounded-full border border-[#ffb4ab]/30 px-5 py-3 text-xs font-bold uppercase tracking-[0.22em] text-[#ffb4ab] transition-all duration-300 hover:bg-[#ffb4ab] hover:text-[#300d14] hover:shadow-[0_4px_12px_rgba(255,180,171,0.2)] hover:scale-105 active:scale-95"
                                    onClick={handleClearHistory}
                                >
                                    Clear Scan History
                                </button>
                            </div>
                        </section>
                    </section>

                    <section class="space-y-8">
                        <section class="animate-in fade-in slide-in-from-right duration-700">
                            <div class="mb-3 flex items-center gap-2">
                                <span class="text-xs uppercase tracking-[0.25em] text-[#57f1db]">
                                    Active Toolsets
                                </span>
                            </div>
                            <div class="space-y-3 rounded-3xl border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-5">
                                <For
                                    each={
                                        Object.entries(toolLabels) as [
                                            ToolKey,
                                            string,
                                        ][]
                                    }
                                >
                                    {([key, label], index) => (
                                        <button
                                            class="flex w-full items-center justify-between rounded-2xl bg-[#191b22] px-4 py-4 text-left transition-all duration-300 hover:bg-[#282a30] hover:scale-105 active:scale-95 animate-in fade-in"
                                            style={{
                                                'animation-delay': `${index() * 75}ms`
                                            }}
                                            onClick={() =>
                                                toggleToolset(key)
                                            }
                                        >
                                            <div>
                                                <p class="text-sm font-semibold text-white">
                                                    {label}
                                                </p>
                                                <p class="mt-1 text-xs text-[#bacac5]/60">
                                                    {settings().scanning
                                                        .toolsets[key]
                                                        ? 'Included in storage analysis'
                                                        : 'Skipped during scan orchestration'}
                                                </p>
                                            </div>
                                            <div
                                                class={`relative h-6 w-11 rounded-full transition-all duration-300 ${
                                                    settings().scanning
                                                        .toolsets[key]
                                                        ? 'bg-gradient-to-r from-[#2dd4bf] to-[#57f1db]'
                                                        : 'bg-[#33343b]'
                                                }`}
                                            >
                                                <span
                                                    class={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${
                                                        settings().scanning
                                                            .toolsets[key]
                                                            ? 'left-6'
                                                            : 'left-1'
                                                    }`}
                                                />
                                            </div>
                                        </button>
                                    )}
                                </For>
                            </div>
                        </section>

                        <section class="animate-in fade-in slide-in-from-right duration-700 delay-150">
                            <div class="mb-3 flex items-center gap-2">
                                <span class="text-xs uppercase tracking-[0.25em] text-[#57f1db]">
                                    Local AI Advisor
                                </span>
                            </div>
                            <div class="space-y-4 rounded-3xl border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-5">
                                <button
                                    class="flex w-full items-center justify-between rounded-2xl bg-[#191b22] px-4 py-4 text-left transition-all duration-300 hover:bg-[#282a30] hover:scale-105 active:scale-95"
                                    onClick={toggleAI}
                                >
                                    <div>
                                        <p class="text-sm font-semibold text-white">
                                            Enable Ollama assistance
                                        </p>
                                        <p class="mt-1 text-xs text-[#bacac5]/60">
                                            Keep recommendations fully local
                                            with no cloud provider
                                            dependency.
                                        </p>
                                    </div>
                                    <div
                                        class={`relative h-6 w-11 rounded-full transition-all duration-300 ${
                                            settings().ai.enabled
                                                ? 'bg-gradient-to-r from-[#2dd4bf] to-[#57f1db]'
                                                : 'bg-[#33343b]'
                                        }`}
                                    >
                                        <span
                                            class={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${
                                                settings().ai.enabled
                                                    ? 'left-6'
                                                    : 'left-1'
                                            }`}
                                        />
                                    </div>
                                    </button>

                                    <div class="space-y-3">
                                        <label class="block text-xs uppercase tracking-[0.22em] text-[#bacac5]/45">
                                            Model Name
                                        </label>
                                        <input
                                            class="min-h-12 w-full rounded-2xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#bacac5]/35 focus:border-[#2dd4bf]/40"
                                            value={settings().ai.model}
                                            onInput={(event) =>
                                                updateAIModel(
                                                    event.currentTarget.value
                                                )
                                            }
                                        />
                                    </div>

                                    <div class="space-y-3">
                                        <label class="block text-xs uppercase tracking-[0.22em] text-[#bacac5]/45">
                                            Ollama Base URL
                                        </label>
                                        <input
                                            class="min-h-12 w-full rounded-2xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#bacac5]/35 focus:border-[#2dd4bf]/40"
                                            value={settings().ai.baseUrl ?? ''}
                                            onInput={(event) =>
                                                updateAIBaseUrl(
                                                    event.currentTarget.value
                                                )
                                            }
                                        />
                                    </div>

                                    <button
                                        class="w-full rounded-2xl border border-[#2dd4bf]/25 bg-[#2dd4bf]/8 px-4 py-3 text-sm font-semibold text-[#57f1db] transition hover:bg-[#2dd4bf]/15"
                                        disabled={isTesting()}
                                        onClick={handleTestConnection}
                                    >
                                        {isTesting()
                                            ? 'Testing Ollama...'
                                            : 'Test Local AI Connection'}
                                    </button>
                                </div>
                            </section>

                        <section class="animate-in fade-in slide-in-from-right duration-700 delay-300">
                            <div class="mb-3 flex items-center gap-2">
                                <span class="text-xs uppercase tracking-[0.25em] text-[#57f1db]">
                                    System
                                </span>
                            </div>
                            <div class="grid gap-3 rounded-3xl border border-white/5 bg-gradient-to-br from-[#1e1f26] to-[#191b22] p-5 sm:grid-cols-3">
                                <div class="rounded-2xl bg-[#191b22] p-4 transition-all duration-300 hover:border hover:border-[#2dd4bf]/20 hover:shadow-lg hover:scale-105 animate-in fade-in">
                                    <p class="font-mono text-[11px] uppercase tracking-[0.24em] text-[#bacac5]/45">
                                        Platform
                                    </p>
                                    <p class="mt-2 text-lg font-semibold capitalize text-white">
                                        {systemInfo().platform}
                                    </p>
                                </div>
                                <div class="rounded-2xl bg-[#191b22] p-4 transition-all duration-300 hover:border hover:border-[#2dd4bf]/20 hover:shadow-lg hover:scale-105 animate-in fade-in delay-100">
                                    <p class="font-mono text-[11px] uppercase tracking-[0.24em] text-[#bacac5]/45">
                                        Architecture
                                    </p>
                                    <p class="mt-2 text-lg font-semibold uppercase text-white">
                                        {systemInfo().arch}
                                    </p>
                                </div>
                                <div class="rounded-2xl bg-[#191b22] p-4 transition-all duration-300 hover:border hover:border-[#2dd4bf]/20 hover:shadow-lg hover:scale-105 animate-in fade-in delay-200">
                                    <p class="font-mono text-[11px] uppercase tracking-[0.24em] text-[#bacac5]/45">
                                        Runtime
                                    </p>
                                    <p class="mt-2 text-lg font-semibold text-white">
                                        Tauri + FastAPI
                                    </p>
                                </div>
                            </div>
                        </section>
                    </section>
                </div>

                <footer class="flex flex-col gap-4 border-t border-white/5 pt-6 text-[11px] uppercase tracking-[0.22em] text-[#bacac5]/40 md:flex-row md:items-center md:justify-between animate-in fade-in slide-in-from-bottom duration-700 delay-500">
                    <p>DevSweep Local Engine</p>
                    <button
                        class="rounded-full bg-gradient-to-r from-[#2dd4bf] to-[#57f1db] px-5 py-3 text-xs font-bold text-[#003731] transition-all duration-300 hover:shadow-[0_4px_12px_rgba(45,212,191,0.3)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        disabled={isSaving()}
                        onClick={handleSave}
                    >
                        {isSaving() ? 'Saving...' : 'Save Preferences'}
                    </button>
                </footer>
            </div>
        </DesktopShell>
    )
}
