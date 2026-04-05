import { useNavigate } from '@solidjs/router'
import { createSignal, For, onMount, Show } from 'solid-js'
import { IPC, type AppSettings } from '../lib/ipc'

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
        <div class="min-h-screen bg-[#111319] text-[#e2e2eb]">
            <aside class="fixed inset-y-0 left-0 hidden w-64 border-r border-white/5 bg-[#111319] px-6 py-6 lg:flex lg:flex-col">
                <div class="mb-10">
                    <p class="font-headline text-xl font-extrabold tracking-tight">
                        DevSweep
                    </p>
                    <p class="mt-1 font-mono text-[10px] uppercase tracking-[0.28em] text-[#bacac5]/45">
                        v{systemInfo().version}
                    </p>
                </div>

                <nav class="space-y-1">
                    <For each={navItems}>
                        {(item) => (
                            <button
                                class={`flex w-full items-center gap-3 rounded-r-xl border-l-2 px-4 py-3 text-left text-sm font-semibold transition ${
                                    item.href === '/settings'
                                        ? 'border-[#2dd4bf] bg-[#1e1f26] text-[#2dd4bf]'
                                        : 'border-transparent text-[#e2e2eb]/60 hover:bg-[#1e1f26] hover:text-[#e2e2eb]'
                                }`}
                                onClick={() => navigate(item.href)}
                            >
                                <span class="text-xs uppercase tracking-[0.2em]">
                                    {item.label.slice(0, 2)}
                                </span>
                                <span>{item.label}</span>
                            </button>
                        )}
                    </For>
                </nav>

                <div class="mt-auto rounded-2xl border border-white/5 bg-[#1e1f26] p-4">
                    <div class="flex items-center gap-3">
                        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#2dd4bf]/12 text-sm font-bold text-[#57f1db]">
                            AD
                        </div>
                        <div>
                            <p class="text-sm font-medium">Alex Dev</p>
                            <p class="font-mono text-[10px] uppercase tracking-[0.25em] text-[#bacac5]/50">
                                Local Mode
                            </p>
                        </div>
                    </div>
                    <button
                        class="mt-4 w-full rounded-xl bg-[#2dd4bf] px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#003731] transition hover:brightness-110"
                        onClick={() => navigate('/scan')}
                    >
                        Run Scan
                    </button>
                </div>
            </aside>

            <main class="min-h-screen lg:pl-64">
                <header class="sticky top-0 z-20 border-b border-white/5 bg-[#111319]/80 px-6 py-5 backdrop-blur-xl lg:px-10">
                    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p class="font-mono text-[11px] uppercase tracking-[0.3em] text-[#bacac5]/45">
                                Settings / System Configuration
                            </p>
                            <h1 class="mt-2 font-headline text-3xl font-extrabold tracking-tight text-white">
                                Preferences
                            </h1>
                            <p class="mt-2 max-w-2xl text-sm text-[#bacac5]">
                                Configure how DevSweep scans developer storage,
                                talks to local AI, and protects directories you
                                never want included in cleanup.
                            </p>
                        </div>

                        <div class="flex items-center gap-3">
                            <button
                                class="rounded-full border border-[#2dd4bf]/20 bg-[#2dd4bf]/8 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-[#57f1db]"
                                onClick={() => navigate('/results')}
                            >
                                3.2GB Cleanable
                            </button>
                            <button
                                class="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/5"
                                onClick={() => navigate('/dashboard')}
                            >
                                Back
                            </button>
                        </div>
                    </div>
                </header>

                <div class="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8 lg:px-10">
                    <Show when={statusMessage()}>
                        {(message) => (
                            <div class="rounded-2xl border border-[#2dd4bf]/15 bg-[#1a1d22] px-4 py-3 text-sm text-[#bacac5]">
                                {message()}
                            </div>
                        )}
                    </Show>

                    <div class="grid gap-8 xl:grid-cols-[1.35fr_1fr]">
                        <section class="space-y-8">
                            <section>
                                <div class="mb-3 flex items-center gap-2">
                                    <span class="text-xs uppercase tracking-[0.25em] text-[#57f1db]">
                                        Scan Frequency
                                    </span>
                                </div>
                                <div class="rounded-3xl border border-white/5 bg-[#1e1f26] p-2">
                                    <div class="grid gap-2 sm:grid-cols-3">
                                        <For each={frequencyOptions}>
                                            {(option) => (
                                                <button
                                                    class={`rounded-2xl px-4 py-4 text-sm font-bold capitalize transition ${
                                                        settings().scanning
                                                            .frequency ===
                                                        option
                                                            ? 'bg-[#33343b] text-[#57f1db] shadow-[0_18px_40px_rgba(0,0,0,0.24)]'
                                                            : 'text-[#bacac5] hover:bg-[#282a30] hover:text-white'
                                                    }`}
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

                            <section>
                                <div class="mb-3 flex items-center justify-between">
                                    <span class="text-xs uppercase tracking-[0.25em] text-[#57f1db]">
                                        Excluded Directories
                                    </span>
                                    <span class="font-mono text-[11px] uppercase tracking-[0.24em] text-[#bacac5]/45">
                                        {settings().exclusions.length} protected
                                    </span>
                                </div>

                                <div class="rounded-3xl border border-white/5 bg-[#1e1f26] p-5">
                                    <div class="mb-4 flex flex-col gap-3 md:flex-row">
                                        <input
                                            class="min-h-12 flex-1 rounded-2xl border border-white/10 bg-[#111319] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#bacac5]/35 focus:border-[#2dd4bf]/40"
                                            placeholder="Add a path like S:\\Projects\\Billing or ~/Work/archive"
                                            value={pendingPath()}
                                            onInput={(event) =>
                                                setPendingPath(
                                                    event.currentTarget.value
                                                )
                                            }
                                        />
                                        <button
                                            class="rounded-2xl bg-[#2dd4bf] px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-[#003731] transition hover:brightness-110"
                                            onClick={addExcludedPath}
                                        >
                                            Add Path
                                        </button>
                                    </div>

                                    <div class="grid gap-3 md:grid-cols-2">
                                        <For each={settings().exclusions}>
                                            {(path) => (
                                                <div class="flex items-center justify-between rounded-2xl border border-white/5 bg-[#111319] px-4 py-3">
                                                    <span class="truncate font-mono text-xs text-[#bacac5]">
                                                        {path}
                                                    </span>
                                                    <button
                                                        class="ml-4 text-xs font-bold uppercase tracking-[0.18em] text-[#ffb4ab] transition hover:text-white"
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

                            <section class="rounded-[28px] border border-[#ffb4ab]/10 bg-[#300d14]/25 p-6">
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
                                        class="rounded-full border border-[#ffb4ab]/30 px-5 py-3 text-xs font-bold uppercase tracking-[0.22em] text-[#ffb4ab] transition hover:bg-[#ffb4ab] hover:text-[#300d14]"
                                        onClick={handleClearHistory}
                                    >
                                        Clear Scan History
                                    </button>
                                </div>
                            </section>
                        </section>

                        <section class="space-y-8">
                            <section>
                                <div class="mb-3 flex items-center gap-2">
                                    <span class="text-xs uppercase tracking-[0.25em] text-[#57f1db]">
                                        Active Toolsets
                                    </span>
                                </div>
                                <div class="space-y-3 rounded-3xl border border-white/5 bg-[#1e1f26] p-5">
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
                                                class="flex w-full items-center justify-between rounded-2xl bg-[#191b22] px-4 py-4 text-left transition hover:bg-[#282a30]"
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
                                                    class={`relative h-6 w-11 rounded-full transition ${
                                                        settings().scanning
                                                            .toolsets[key]
                                                            ? 'bg-[#2dd4bf]'
                                                            : 'bg-[#33343b]'
                                                    }`}
                                                >
                                                    <span
                                                        class={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
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

                            <section>
                                <div class="mb-3 flex items-center gap-2">
                                    <span class="text-xs uppercase tracking-[0.25em] text-[#57f1db]">
                                        Local AI Advisor
                                    </span>
                                </div>
                                <div class="space-y-4 rounded-3xl border border-white/5 bg-[#1e1f26] p-5">
                                    <button
                                        class="flex w-full items-center justify-between rounded-2xl bg-[#191b22] px-4 py-4 text-left transition hover:bg-[#282a30]"
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
                                            class={`relative h-6 w-11 rounded-full transition ${
                                                settings().ai.enabled
                                                    ? 'bg-[#2dd4bf]'
                                                    : 'bg-[#33343b]'
                                            }`}
                                        >
                                            <span
                                                class={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
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

                            <section>
                                <div class="mb-3 flex items-center gap-2">
                                    <span class="text-xs uppercase tracking-[0.25em] text-[#57f1db]">
                                        System
                                    </span>
                                </div>
                                <div class="grid gap-3 rounded-3xl border border-white/5 bg-[#1e1f26] p-5 sm:grid-cols-3">
                                    <div class="rounded-2xl bg-[#191b22] p-4">
                                        <p class="font-mono text-[11px] uppercase tracking-[0.24em] text-[#bacac5]/45">
                                            Platform
                                        </p>
                                        <p class="mt-2 text-lg font-semibold capitalize text-white">
                                            {systemInfo().platform}
                                        </p>
                                    </div>
                                    <div class="rounded-2xl bg-[#191b22] p-4">
                                        <p class="font-mono text-[11px] uppercase tracking-[0.24em] text-[#bacac5]/45">
                                            Architecture
                                        </p>
                                        <p class="mt-2 text-lg font-semibold uppercase text-white">
                                            {systemInfo().arch}
                                        </p>
                                    </div>
                                    <div class="rounded-2xl bg-[#191b22] p-4">
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

                    <footer class="flex flex-col gap-4 border-t border-white/5 pt-6 text-[11px] uppercase tracking-[0.22em] text-[#bacac5]/40 md:flex-row md:items-center md:justify-between">
                        <p>DevSweep Local Engine</p>
                        <button
                            class="rounded-full bg-[#2dd4bf] px-5 py-3 text-xs font-bold text-[#003731] transition hover:brightness-110"
                            disabled={isSaving()}
                            onClick={handleSave}
                        >
                            {isSaving() ? 'Saving...' : 'Save Preferences'}
                        </button>
                    </footer>
                </div>
            </main>
        </div>
    )
}
