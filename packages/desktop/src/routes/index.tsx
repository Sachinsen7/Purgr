import { Component, Show } from "solid-js";
import { useLocation } from "@solidjs/router";
import { $currentView, $sidebarOpen, toggleSidebar } from "../stores/ui";

const navigation = [
  { name: "Dashboard", href: "dashboard", current: true },
  { name: "Scan", href: "scan", current: false },
  { name: "Results", href: "results", current: false },
  { name: "Settings", href: "settings", current: false },
];

const App: Component = (props) => {
  const location = useLocation();
  const currentView = $currentView;
  const sidebarOpen = $sidebarOpen;

  const currentPage = () => {
    const path = location.pathname.replace("/", "");
    return path || "dashboard";
  };

  return (
    <div class="h-screen flex">
      {/* Sidebar */}
      <div class={`${
        sidebarOpen() ? "translate-x-0" : "-translate-x-full"
      } fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div class="flex items-center justify-center h-16 px-4 bg-primary-600">
          <h1 class="text-xl font-bold text-white">DevSweep</h1>
        </div>
        <nav class="mt-8">
          <div class="px-4 space-y-2">
            {navigation.map((item) => (
              <a
                href={`/${item.href}`}
                class={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                  currentPage() === item.href
                    ? "bg-primary-100 text-primary-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
                onClick={() => {
                  // Close sidebar on mobile when clicking a link
                  if (window.innerWidth < 1024) {
                    toggleSidebar();
                  }
                }}
              >
                <span class="truncate">{item.name}</span>
              </a>
            ))}
          </div>
        </nav>
      </div>

      {/* Main content */}
      <div class="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header class="bg-white shadow-sm border-b border-gray-200">
          <div class="flex items-center justify-between px-4 py-4">
            <button
              onClick={toggleSidebar}
              class="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div class="flex items-center space-x-4">
              <span class="text-sm text-gray-500 capitalize">
                {currentPage().replace("-", " ")}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main class="flex-1 overflow-y-auto p-6">
          {props.children}
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      <Show when={sidebarOpen()}>
        <div
          class="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={toggleSidebar}
        />
      </Show>
    </div>
  );
};

export default App;