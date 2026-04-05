import { Component, For, Show } from "solid-js";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { $scanHistory, $currentScan, $isScanning } from "../stores/scan";
import { $currentView, setCurrentView } from "../stores/ui";

const Dashboard: Component = () => {
  const scanHistory = $scanHistory;
  const currentScan = $currentScan;
  const isScanning = $isScanning;

  const recentScans = () => scanHistory().slice(-5).reverse();

  const totalScannedFiles = () => {
    return scanHistory().reduce((total, scan) => total + scan.totalFiles, 0);
  };

  const totalSpaceSaved = () => {
    // This would be calculated from actual deletion data
    return "2.4 GB";
  };

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p class="text-gray-600 mt-1">Welcome to DevSweep - keep your development environment clean</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setCurrentView("scan")}
          disabled={isScanning()}
        >
          Start New Scan
        </Button>
      </div>

      {/* Stats Cards */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardBody>
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-gray-500">Total Files Scanned</p>
                <p class="text-2xl font-semibold text-gray-900">{totalScannedFiles().toLocaleString()}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-gray-500">Space Saved</p>
                <p class="text-2xl font-semibold text-gray-900">{totalSpaceSaved()}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                  <svg class="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-gray-500">Pending Review</p>
                <p class="text-2xl font-semibold text-gray-900">
                  {currentScan()?.results.filter(r => r.recommendation === "review").length || 0}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Current Scan Status */}
      <Show when={currentScan()}>
        {(scan) => (
          <Card>
            <CardHeader>
              <h3 class="text-lg font-medium text-gray-900">Current Scan</h3>
            </CardHeader>
            <CardBody>
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600">Scanning: {scan().rootPath}</span>
                  <span class={`px-2 py-1 text-xs rounded-full ${
                    scan().status === "scanning" ? "bg-blue-100 text-blue-800" :
                    scan().status === "completed" ? "bg-green-100 text-green-800" :
                    "bg-red-100 text-red-800"
                  }`}>
                    {scan().status}
                  </span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${scan().progress}%` }}
                  />
                </div>
                <div class="flex justify-between text-sm text-gray-600">
                  <span>{scan().scannedFiles} of {scan().totalFiles} files</span>
                  <span>{Math.round(scan().progress)}%</span>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </Show>

      {/* Recent Scans */}
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium text-gray-900">Recent Scans</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentView("results")}
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Show
            when={recentScans().length > 0}
            fallback={<p class="text-gray-500 text-center py-4">No scans yet. Start your first scan!</p>}
          >
            <div class="space-y-4">
              <For each={recentScans()}>
                {(scan) => (
                  <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <p class="font-medium text-gray-900">{scan.rootPath}</p>
                      <p class="text-sm text-gray-600">
                        {scan.totalFiles} files • {scan.endTime ? new Date(scan.endTime).toLocaleDateString() : "In progress"}
                      </p>
                    </div>
                    <div class="flex items-center space-x-2">
                      <span class={`px-2 py-1 text-xs rounded-full ${
                        scan.status === "completed" ? "bg-green-100 text-green-800" :
                        scan.status === "error" ? "bg-red-100 text-red-800" :
                        "bg-blue-100 text-blue-800"
                      }`}>
                        {scan.status}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentView("results")}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </CardBody>
      </Card>
    </div>
  );
};

export default Dashboard;