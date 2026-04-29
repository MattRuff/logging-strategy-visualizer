import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { datadogRum } from "@datadog/browser-rum";
import App from "@/App";
import { assertConfigured, runtime } from "@/config/runtime";
import "@/index.css";

datadogRum.init({
  applicationId: "afd4cb6f-1832-4b09-9c99-543a4413545d",
  clientToken: "pub89661ca453898420d8d75769f47782e1",
  site: "datadoghq.com",
  service: "logging-workflow",
  env: import.meta.env.MODE,
  version: runtime.buildVersion,
  sessionSampleRate: 100,
  sessionReplaySampleRate: 100,
  trackResources: true,
  trackUserInteractions: true,
  trackLongTasks: true,
  defaultPrivacyLevel: "mask-user-input",
  allowedTracingUrls: [
    (url: string) => url.startsWith(runtime.apiBaseUrl) || url.startsWith(window.location.origin),
  ],
  traceSampleRate: 100,
});

try {
  assertConfigured();
} catch (err) {
  // Show a clear error rather than rendering a half-broken app.
  const root = document.getElementById("root")!;
  root.innerHTML = `<pre style="padding:16px;color:crimson">${
    err instanceof Error ? err.message : String(err)
  }</pre>`;
  throw err;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
