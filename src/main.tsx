import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./features/app-shell/AppShell";
import "./styles/tokens.css";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
