import { Component, createSignal } from "solid-js";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { $aiPreferences, updateAIPreferences } from "../stores/ai";
import { setCurrentView } from "../stores/ui";
import { IPC } from "../lib/ipc";

const Settings: Component = () => {
  const [aiEnabled, setAiEnabled] = createSignal(true);
  const [aiProvider, setAiProvider] = createSignal<"ollama" | "openai" | "anthropic">("ollama");
  const [aiModel, setAiModel] = createSignal("llama3.2");
  const [aiBaseUrl, setAiBaseUrl] = createSignal("http://localhost:11434");
  const [aiApiKey, setAiApiKey] = createSignal("");

  const aiPrefs = $aiPreferences;

  const handleSaveSettings = async () => {
    try {
      const settings = {
        ai: {
          enabled: aiEnabled(),
          provider: aiProvider(),
          model: aiModel(),
          baseUrl: aiBaseUrl(),
          apiKey: aiApiKey(),
        },
      };

      await IPC.updateSettings(settings);

      updateAIPreferences({
        enabled: aiEnabled(),
        provider: aiProvider(),
        model: aiModel(),
        baseUrl: aiBaseUrl(),
        apiKey: aiApiKey(),
      });

      // Show success message
      console.log("Settings saved successfully");
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const handleTestAIConnection = async () => {
    try {
      // This would test the AI connection
      console.log("Testing AI connection...");
      // In a real implementation, you'd call a test endpoint
    } catch (error) {
      console.error("AI connection test failed:", error);
    }
  };

  return (
    <div class="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Settings</h1>
          <p class="text-gray-600 mt-1">Configure DevSweep to match your preferences</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setCurrentView("dashboard")}
        >
          Back to Dashboard
        </Button>
      </div>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <h3 class="text-lg font-medium text-gray-900">AI Configuration</h3>
          <p class="text-sm text-gray-600 mt-1">
            Configure AI assistance for intelligent cleanup recommendations
          </p>
        </CardHeader>
        <CardBody>
          <div class="space-y-6">
            <div class="flex items-center">
              <input
                id="ai-enabled"
                type="checkbox"
                checked={aiEnabled()}
                onChange={(e) => setAiEnabled(e.currentTarget.checked)}
                class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label for="ai-enabled" class="ml-2 block text-sm text-gray-900">
                Enable AI assistance
              </label>
            </div>

            <Show when={aiEnabled()}>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    AI Provider
                  </label>
                  <select
                    value={aiProvider()}
                    onChange={(e) => setAiProvider(e.currentTarget.value as any)}
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="ollama">Ollama (Local)</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>

                <Input
                  label="Model Name"
                  placeholder="e.g., llama3.2, gpt-4, claude-3"
                  value={aiModel()}
                  onChange={setAiModel}
                />
              </div>

              <Show when={aiProvider() === "ollama"}>
                <Input
                  label="Ollama Base URL"
                  placeholder="http://localhost:11434"
                  value={aiBaseUrl()}
                  onChange={setAiBaseUrl}
                />
              </Show>

              <Show when={aiProvider() !== "ollama"}>
                <Input
                  label="API Key"
                  type="password"
                  placeholder="Enter your API key"
                  value={aiApiKey()}
                  onChange={setAiApiKey}
                />
              </Show>

              <div class="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={handleTestAIConnection}
                >
                  Test Connection
                </Button>
              </div>
            </Show>
          </div>
        </CardBody>
      </Card>

      {/* Scan Settings */}
      <Card>
        <CardHeader>
          <h3 class="text-lg font-medium text-gray-900">Scan Settings</h3>
          <p class="text-sm text-gray-600 mt-1">
            Default settings for directory scanning
          </p>
        </CardHeader>
        <CardBody>
          <div class="space-y-4">
            <div class="flex items-center">
              <input
                id="include-hidden"
                type="checkbox"
                checked={true}
                class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label for="include-hidden" class="ml-2 block text-sm text-gray-900">
                Include hidden files and directories by default
              </label>
            </div>

            <div class="flex items-center">
              <input
                id="follow-symlinks"
                type="checkbox"
                checked={false}
                class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label for="follow-symlinks" class="ml-2 block text-sm text-gray-900">
                Follow symbolic links
              </label>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <h3 class="text-lg font-medium text-gray-900">System Information</h3>
        </CardHeader>
        <CardBody>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p class="text-sm font-medium text-gray-500">Platform</p>
              <p class="text-lg font-semibold text-gray-900">Desktop</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Version</p>
              <p class="text-lg font-semibold text-gray-900">1.0.0</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Database</p>
              <p class="text-lg font-semibold text-gray-900">SQLite</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Save Button */}
      <div class="flex justify-end">
        <Button
          variant="primary"
          onClick={handleSaveSettings}
        >
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default Settings;