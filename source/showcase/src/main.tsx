// SPDX-License-Identifier: AGPL-3.0-only
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StudiesApp } from "./app";

const root = document.getElementById("root");
if (!root) throw new Error("TaxSorted Studies needs its root element.");

createRoot(root).render(<StrictMode><StudiesApp /></StrictMode>);
