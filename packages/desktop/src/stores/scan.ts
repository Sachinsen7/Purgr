import { atom, computed } from 'nanostores'
import {
    IPC,
    type ScanDetails,
    type ScanRequest,
    type ScanSummary,
    type ScanSession,
} from '../lib/ipc'

export const $currentScan = atom<ScanSession | null>(null)
export const $scanHistory = atom<ScanSession[]>([])
export const $selectedHistory = atom<ScanDetails | null>(null)
export const $isLoadingHistory = atom(false)
export const $isStartingScan = atom(false)
export const $scanError = atom<string | null>(null)
export const $historyError = atom<string | null>(null)

export const $isScanning = computed(
    $currentScan,
    (scan) => scan?.status === 'scanning'
)

let pollingHandle: number | undefined
let refreshFailures = 0

const emptySummary = (): ScanSummary => ({
    totalFiles: 0,
    totalSize: 0,
    hiddenFiles: 0,
    issueCount: 0,
    deletableFiles: 0,
    deletableSize: 0,
    reviewFiles: 0,
    quickCleanSize: 0,
    deepCleanSize: 0,
    nuclearCleanSize: 0,
    deadProjects: 0,
    duplicateEnvironments: 0,
    unusedSdkItems: 0,
})

const buildPendingSession = (request: ScanRequest): ScanSession => ({
    id: 'pending',
    rootPaths: request.selectedDrives ?? [],
    status: 'scanning',
    phase: 'preparing',
    progress: 0,
    discoveredFiles: 0,
    processedFiles: 0,
    bytesScanned: 0,
    etaSeconds: null,
    currentDrive: request.selectedDrives?.[0] ?? null,
    currentPath: null,
    startTime: new Date().toISOString(),
    endTime: null,
    error: null,
    summary: emptySummary(),
    driveSummaries: [],
    bucketSummaries: [],
    topFiles: [],
    oldestFile: null,
    newestFile: null,
    recentFindings: [],
    issues: [],
})

function stopPolling() {
    if (pollingHandle !== undefined) {
        window.clearInterval(pollingHandle)
        pollingHandle = undefined
    }
}

export async function loadHistory(options?: { hydrateLatest?: boolean }) {
    $isLoadingHistory.set(true)
    $historyError.set(null)
    try {
        const sessions = await IPC.getHistoryScans()
        $scanHistory.set(sessions)
        if (
            options?.hydrateLatest &&
            !$selectedHistory.get() &&
            sessions.length > 0
        ) {
            await loadHistoryScan(sessions[0].id)
        }
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Failed to load scan history.'
        $historyError.set(message)
        console.error('Failed to load scan history:', error)
    } finally {
        $isLoadingHistory.set(false)
    }
}

export async function loadHistoryScan(scanId: string) {
    try {
        const details = await IPC.getHistoryScan(scanId)
        $selectedHistory.set(details)
        if (details.session.status === 'completed') {
            const nextHistory = $scanHistory
                .get()
                .filter((item) => item.id !== scanId)
            $scanHistory.set([details.session, ...nextHistory])
        }
        return details
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : `Failed to load scan ${scanId}.`
        $historyError.set(message)
        console.error('Failed to load scan history detail:', error)
        throw error
    }
}

async function refreshScan(scanId: string) {
    const session = await IPC.getScanStatus(scanId)
    refreshFailures = 0
    $currentScan.set(session)
    $scanError.set(session.status === 'error' ? session.error ?? 'Scan failed.' : null)
    if (session.status === 'completed' || session.status === 'error') {
        stopPolling()
        $isStartingScan.set(false)
        await loadHistory()
        await loadHistoryScan(scanId)
    }
    return session
}

function startPolling(scanId: string) {
    stopPolling()
    pollingHandle = window.setInterval(() => {
        void refreshScan(scanId).catch((error) => {
            console.error('Failed to poll scan status:', error)
            refreshFailures += 1
            $scanError.set('Reconnecting to scan progress...')
            if (refreshFailures >= 5) {
                $scanError.set(
                    error instanceof Error
                        ? error.message
                        : 'Failed to refresh scan progress.'
                )
                stopPolling()
            }
        })
    }, 1000)
}

export async function beginScan(request: ScanRequest) {
    $isStartingScan.set(true)
    $scanError.set(null)
    $currentScan.set(buildPendingSession(request))
    try {
        const scanId = await IPC.startScan(request)
        refreshFailures = 0
        await refreshScan(scanId)
        startPolling(scanId)
        return scanId
    } catch (error) {
        $currentScan.set(null)
        $scanError.set(
            error instanceof Error ? error.message : 'Failed to start the scan.'
        )
        throw error
    } finally {
        $isStartingScan.set(false)
    }
}

export async function hydrateCurrentScan(scanId: string) {
    $scanError.set(null)
    return await refreshScan(scanId)
}

export async function stopCurrentScan() {
    const scan = $currentScan.get()
    if (!scan || scan.id === 'pending') return
    await IPC.stopScan(scan.id)
    stopPolling()
    await refreshScan(scan.id)
}

export async function clearHistoryState() {
    await IPC.clearScanHistory()
    $scanHistory.set([])
    $selectedHistory.set(null)
}

export function clearCurrentScan() {
    stopPolling()
    $currentScan.set(null)
    $scanError.set(null)
    $isStartingScan.set(false)
}
