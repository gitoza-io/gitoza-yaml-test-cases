import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import VsCodeApp from "./VsCodeApp";
import { ConfirmProvider } from "./components/ConfirmProvider";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ConfirmProvider>
      <VsCodeApp />
    </ConfirmProvider>
  </StrictMode>,
);
