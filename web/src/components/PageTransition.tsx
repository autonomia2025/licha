import { ViewTransition } from "react";

/** Cada página entra con un fundido + desenfoque y sale difuminándose (View Transitions). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
