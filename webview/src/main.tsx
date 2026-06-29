import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import VsCodeApp from "./VsCodeApp";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <VsCodeApp />
  </StrictMode>,
);
