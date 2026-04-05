import { atom, computed } from 'nanostores'
import type { ScanSession as IPCScanSession } from '../lib/ipc'

export interface ScanResult {
    id: string
    path: string
    size: number
    score: number
    classification: 'safe' | 'optional' | 'critical'
    recommendation: 'keep' | 'delete' | 'review'
    confidence: number
}

export interface ScanSession {
    id: string
    rootPath: string
    status: 'idle' | 'scanning' | 'completed' | 'error'
    progress: number
    totalFiles: number
    scannedFiles: number
    results: ScanResult[]
    startTime?: Date
    endTime?: Date
    error?: string
}

// Scan store
export const $currentScan = atom<ScanSession | null>(null)
export const $scanHistory = atom<ScanSession[]>([])

// Computed values
export const $isScanning = computed(
    $currentScan,
    (scan) => scan?.status === 'scanning'
)
export const $scanProgress = computed(
    $currentScan,
    (scan) => scan?.progress || 0
)
export const $totalFilesFound = computed(
    $currentScan,
    (scan) => scan?.totalFiles || 0
)

// Actions
export function startScan(rootPath: string) {
    const session: ScanSession = {
        id: crypto.randomUUID(),
        rootPath,
        status: 'scanning',
        progress: 0,
        totalFiles: 0,
        scannedFiles: 0,
        results: [],
        startTime: new Date(),
    }
    $currentScan.set(session)
}

export function updateScanProgress(scannedFiles: number, totalFiles: number) {
    const currentScan = $currentScan.get()
    if (currentScan) {
        $currentScan.set({
            ...currentScan,
            scannedFiles,
            totalFiles,
            progress: totalFiles > 0 ? (scannedFiles / totalFiles) * 100 : 0,
        })
    }
}

export function addScanResult(result: ScanResult) {
    const currentScan = $currentScan.get()
    if (currentScan) {
        $currentScan.set({
            ...currentScan,
            results: [...currentScan.results, result],
        })
    }
}

export function completeScan() {
    const currentScan = $currentScan.get()
    if (currentScan) {
        const completedScan = {
            ...currentScan,
            status: 'completed' as const,
            endTime: new Date(),
        }
        $currentScan.set(completedScan)
        $scanHistory.set([...$scanHistory.get(), completedScan])
    }
}

export function cancelScan() {
    const currentScan = $currentScan.get()
    if (currentScan) {
        const cancelledScan = {
            ...currentScan,
            status: 'error' as const,
            endTime: new Date(),
            error: 'Scan cancelled by user',
        }
        $currentScan.set(cancelledScan)
        $scanHistory.set([...$scanHistory.get(), cancelledScan])
    }
}

export function clearCurrentScan() {
    $currentScan.set(null)
}

export function syncScanSession(session: IPCScanSession) {
    const nextSession: ScanSession = {
        ...session,
        startTime: session.startTime ? new Date(session.startTime) : undefined,
        endTime: session.endTime ? new Date(session.endTime) : undefined,
    }

    $currentScan.set(nextSession)

    if (
        nextSession.status === 'completed' &&
        !$scanHistory.get().some((scan) => scan.id === nextSession.id)
    ) {
        $scanHistory.set([...$scanHistory.get(), nextSession])
    }
}
