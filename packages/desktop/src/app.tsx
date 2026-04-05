import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/router/file-routes";
import { Suspense } from "solid-js";
import "./app.css";

export default function App() {
  return (
    <Router>
      <FileRoutes />
    </Router>
  );
}