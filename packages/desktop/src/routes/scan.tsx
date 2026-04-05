import { useNavigate } from "@solidjs/router";
import { Component, createSignal, onCleanup, Show } from "solid-js";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { $currentScan, $isScanning, clearCurrentScan, syncScanSession } from "../stores/scan";
import { IPC } from "../lib/ipc";

const Scan: Component = () => {
  const navigate = useNavigate();
  const [rootPath, setRootPath] = createSignal("");
  const [includeHidden, setIncludeHidden] = createSignal(false);
  const [maxDepth, setMaxDepth] = createSignal<number | undefined>();
  let pollingHandle: number | undefined;

  const currentScan = $currentScan;
  const isScanning = $isScanning;

  const stopPolling = () => {
    if (pollingHandle !== undefined) {
      window.clearInterval(pollingHandle);
      pollingHandle = undefined;
    }
  };

  onCleanup(stopPolling);

  const beginPolling = (scanId: string) => {
    stopPolling();
    pollingHandle = window.setInterval(async () => {
      try {
        const status = await IPC.getScanStatus(scanId);
        syncScanSession(status);
        if (status.status === "completed") {
          stopPolling();
          navigate("/results");
        }
        if (status.status === "error") {
          stopPolling();
        }
      } catch (error) {
        console.error("Failed to poll scan status:", error);
        stopPolling();
      }
    }, 750);
  };

  const handleStartScan = async () => {
    if (!rootPath()) return;

    try {
      const scanId = await IPC.startScan({
        rootPath: rootPath(),
        includeHidden: includeHidden(),
        maxDepth: maxDepth(),
      });
      beginPolling(scanId);
    } catch (error) {
      console.error("Failed to start scan:", error);
      clearCurrentScan();
    }
  };

  const handleStopScan = async () => {
    if (currentScan()) {
      try {
        await IPC.stopScan(currentScan()!.id);
        stopPolling();
        clearCurrentScan();
      } catch (error) {
        console.error("Failed to stop scan:", error);
      }
    }
  };

  return (
    <div class="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Scan Directory</h1>
          <p class="text-gray-600 mt-1">Analyze your development files for cleanup opportunities</p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard")}
        >
          Back to Dashboard
        </Button>
      </div>

      <Show
        when={!isScanning()}
        fallback={
          <Card>
            <CardHeader>
              <h3 class="text-lg font-medium text-gray-900">Scan in Progress</h3>
            </CardHeader>
            <CardBody>
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600">
                    Scanning: {currentScan()?.rootPath}
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleStopScan}
                  >
                    Stop Scan
                  </Button>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-3">
                  <div
                    class="bg-primary-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${currentScan()?.progress || 0}%` }}
                  />
                </div>
                <div class="flex justify-between text-sm text-gray-600">
                  <span>
                    {currentScan()?.scannedFiles || 0} of {currentScan()?.totalFiles || 0} files scanned
                  </span>
                  <span>{Math.round(currentScan()?.progress || 0)}%</span>
                </div>
              </div>
            </CardBody>
          </Card>
        }
      >
        <Card>
          <CardHeader>
            <h3 class="text-lg font-medium text-gray-900">Scan Configuration</h3>
          </CardHeader>
          <CardBody>
            <div class="space-y-6">
              <Input
                label="Directory to Scan"
                placeholder="e.g., C:\\Users\\username\\Documents\\Projects or /home/user/projects"
                value={rootPath()}
                onChange={setRootPath}
              />

              <div class="space-y-4">
                <div class="flex items-center">
                  <input
                    id="include-hidden"
                    type="checkbox"
                    checked={includeHidden()}
                    onChange={(e) => setIncludeHidden(e.currentTarget.checked)}
                    class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label for="include-hidden" class="ml-2 block text-sm text-gray-900">
                    Include hidden files and directories
                  </label>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Maximum Depth (optional)"
                    placeholder="e.g., 10"
                    type="number"
                    value={maxDepth()?.toString() || ""}
                    onChange={(value) => setMaxDepth(value ? parseInt(value) : undefined)}
                  />
                </div>
              </div>

              <div class="flex justify-end space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => navigate("/dashboard")}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleStartScan}
                  disabled={!rootPath()}
                >
                  Start Scan
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Scan Tips */}
        <Card>
          <CardHeader>
            <h3 class="text-lg font-medium text-gray-900">Scan Tips</h3>
          </CardHeader>
          <CardBody>
            <ul class="space-y-2 text-sm text-gray-600">
              <li>• Start with your user home directory or a specific project folder</li>
              <li>• Include hidden files to catch configuration files and caches</li>
              <li>• Limit depth for faster scans on large directory trees</li>
              <li>• Review results before deleting - AI suggestions are available</li>
            </ul>
          </CardBody>
        </Card>
      </Show>
    </div>
  );
};

export default Scan;
