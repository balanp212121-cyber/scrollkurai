import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "./App.tsx";
import { HardFallbackScreen } from "./components/HardFallbackScreen";
import "./index.css";

// Configure QueryClient with better defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});


// Disable service worker to avoid stale cached chunks in preview
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => {
      regs.forEach((r) => r.unregister());
      console.log('Service workers unregistered');
    })
    .catch(() => { });
}

// Get root element
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

// Create root and render app with all providers at the top level
try {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <App />
              <Sonner />
            </ThemeProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  );
} catch (error) {
  console.error("Fatal render error:", error);
  // Last resort manual render if React fails completely
  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f0f23;color:#fff;font-family:system-ui;">
      <div style="text-align:center;padding:2rem;">
        <h1 style="color:#ff6b6b;margin-bottom:1rem;">⚠️ App Failed to Load</h1>
        <p>Something went wrong while initializing the application.</p>
        <button onclick="window.location.reload()" style="margin-top:1rem;padding:0.5rem 1rem;background:#8b5cf6;border:none;border-radius:4px;color:white;cursor:pointer;">Reload Page</button>
      </div>
    </div>
  `;
}

// Log successful mount
console.log("App mounted successfully with all providers");
