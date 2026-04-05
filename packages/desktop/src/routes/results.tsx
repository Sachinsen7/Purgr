import { useNavigate } from "@solidjs/router";
import { Component, createSignal, For, Show } from "solid-js";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { $currentScan, $scanHistory } from "../stores/scan";
import { IPC } from "../lib/ipc";

const Results: Component = () => {
  const navigate = useNavigate();
  const [selectedResults, setSelectedResults] = createSignal<string[]>([]);
  const [filter, setFilter] = createSignal<"all" | "keep" | "delete" | "review">("all");

  const currentScan = $currentScan;
  const scanHistory = $scanHistory;

  // Get results from current scan or most recent completed scan
  const results = () => {
    if (currentScan() && currentScan()?.status === "completed") {
      return currentScan()!.results;
    }
    const lastScan = scanHistory().find(s => s.status === "completed");
    return lastScan?.results || [];
  };

  const filteredResults = () => {
    const allResults = results();
    if (filter() === "all") return allResults;
    return allResults.filter(r => r.recommendation === filter());
  };

  const stats = () => {
    const all = results();
    return {
      total: all.length,
      keep: all.filter(r => r.recommendation === "keep").length,
      delete: all.filter(r => r.recommendation === "delete").length,
      review: all.filter(r => r.recommendation === "review").length,
    };
  };

  const handleSelectResult = (id: string, selected: boolean) => {
    const current = selectedResults();
    if (selected) {
      setSelectedResults([...current, id]);
    } else {
      setSelectedResults(current.filter(r => r !== id));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedResults(filteredResults().map(r => r.id));
    } else {
      setSelectedResults([]);
    }
  };

  const handleDeleteSelected = async () => {
    try {
      const pathsToDelete = results()
        .filter(r => selectedResults().includes(r.id))
        .map(r => r.path);

      await IPC.deleteFiles(pathsToDelete);
      setSelectedResults([]);

      // Update scan results to mark as deleted
      // In a real implementation, this would come from the backend
      console.log("Deleted files:", pathsToDelete);
    } catch (error) {
      console.error("Failed to delete files:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case "safe": return "text-green-600 bg-green-100";
      case "optional": return "text-yellow-600 bg-yellow-100";
      case "critical": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case "keep":
        return (
          <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        );
      case "delete":
        return (
          <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        );
      case "review":
        return (
          <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Scan Results</h1>
          <p class="text-gray-600 mt-1">
            Review and manage files identified for cleanup
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard")}
        >
          Back to Dashboard
        </Button>
      </div>

      <Show
        when={results().length > 0}
        fallback={
          <Card>
            <CardBody>
              <div class="text-center py-12">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">No scan results</h3>
                <p class="mt-1 text-sm text-gray-500">Run a scan to see files that can be cleaned up.</p>
                <div class="mt-6">
                  <Button onClick={() => navigate("/scan")}>
                    Start New Scan
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        }
      >
        {/* Stats */}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardBody class="text-center">
              <p class="text-2xl font-semibold text-gray-900">{stats().total}</p>
              <p class="text-sm text-gray-600">Total Files</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody class="text-center">
              <p class="text-2xl font-semibold text-green-600">{stats().keep}</p>
              <p class="text-sm text-gray-600">Keep</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody class="text-center">
              <p class="text-2xl font-semibold text-red-600">{stats().delete}</p>
              <p class="text-sm text-gray-600">Delete</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody class="text-center">
              <p class="text-2xl font-semibold text-yellow-600">{stats().review}</p>
              <p class="text-sm text-gray-600">Review</p>
            </CardBody>
          </Card>
        </div>

        {/* Controls */}
        <Card>
          <CardBody>
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
              <div class="flex items-center space-x-4">
                <select
                  value={filter()}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    if (
                      value === "all" ||
                      value === "keep" ||
                      value === "delete" ||
                      value === "review"
                    ) {
                      setFilter(value);
                    }
                  }}
                  class="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="all">All Results</option>
                  <option value="keep">Keep</option>
                  <option value="delete">Delete</option>
                  <option value="review">Review</option>
                </select>

                <label class="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedResults().length === filteredResults().length && filteredResults().length > 0}
                    onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                    class="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                  <span class="ml-2 text-sm text-gray-700">Select All</span>
                </label>
              </div>

              <Show when={selectedResults().length > 0}>
                <Button
                  variant="danger"
                  onClick={handleDeleteSelected}
                >
                  Delete Selected ({selectedResults().length})
                </Button>
              </Show>
            </div>
          </CardBody>
        </Card>

        {/* Results List */}
        <Card>
          <CardHeader>
            <h3 class="text-lg font-medium text-gray-900">
              Files ({filteredResults().length})
            </h3>
          </CardHeader>
          <CardBody>
            <div class="space-y-4">
              <For each={filteredResults()}>
                {(result) => (
                  <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div class="flex items-center space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedResults().includes(result.id)}
                        onChange={(e) => handleSelectResult(result.id, e.currentTarget.checked)}
                        class="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      />

                      <div class="flex items-center space-x-2">
                        {getRecommendationIcon(result.recommendation)}
                        <div>
                          <p class="font-medium text-gray-900 truncate max-w-md" title={result.path}>
                            {result.path.split(/[/\\]/).pop()}
                          </p>
                          <p class="text-sm text-gray-600 truncate max-w-md" title={result.path}>
                            {result.path}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center space-x-4">
                      <div class="text-right">
                        <p class="text-sm font-medium text-gray-900">
                          {formatFileSize(result.size)}
                        </p>
                        <p class="text-sm text-gray-600">
                          Score: {result.score}
                        </p>
                      </div>

                      <span class={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getClassificationColor(result.classification)}`}>
                        {result.classification}
                      </span>

                      <div class="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => IPC.openFile(result.path)}
                        >
                          Open
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => IPC.showInFolder(result.path)}
                        >
                          Show in Folder
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </CardBody>
        </Card>
      </Show>
    </div>
  );
};

export default Results;
