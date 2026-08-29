import type { ReactNode } from "react";
import type { ReadinessState } from "../store";

export function PhoneFrame({
  children,
  readiness,
}: {
  children: ReactNode;
  readiness: ReadinessState;
}) {
  return (
    <div className="phone" aria-label="PocketQA phone preview">
      <div className="phone-statusbar">
        <span>9:41</span>
        <span>
          {readiness.offlineMode ? "✈︎ Offline" : "5G"}
          &nbsp;•&nbsp;
          {readiness.accessibilityEnabled ? "◉ Capture ready" : "◎ Setup"}
        </span>
      </div>
      <div className="phone-screen">{children}</div>
    </div>
  );
}
