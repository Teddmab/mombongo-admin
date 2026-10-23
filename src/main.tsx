import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { emulatorMode } from "@/lib/firebase";

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister();
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {emulatorMode.enabled && (
      <div
        role="note"
        style={{ position: "fixed", bottom: 8, left: 8, zIndex: 9999, padding: "4px 10px", borderRadius: 8, background: "#7c2d12", color: "white", font: "600 11px/1.4 system-ui", pointerEvents: "none" }}
      >
        Émulateur local · {emulatorMode.projectId} · données fictives
      </div>
    )}
    <App />
  </StrictMode>,
);
