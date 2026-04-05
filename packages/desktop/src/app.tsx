import type { RouteSectionProps } from "@solidjs/router";
import { Suspense } from "solid-js";
import "./app.css";

export default function App(props: RouteSectionProps) {
  return <Suspense>{props.children}</Suspense>;
}
