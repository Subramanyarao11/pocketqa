import { useStore } from "../store";
import type { Screen } from "../store";

const items: { screen: Screen; icon: string; label: string }[] = [
  { screen: "home", icon: "◉", label: "Tests" },
  { screen: "intent", icon: "＋", label: "New" },
  { screen: "agent-lab", icon: "◇", label: "Lab" },
  { screen: "settings", icon: "⚙︎", label: "Settings" },
];

export function BottomNav() {
  const { state, actions } = useStore();
  return (
    <div className="phone-nav">
      {items.map((it) => (
        <button
          key={it.screen}
          className={`nav-btn ${state.screen === it.screen ? "active" : ""}`}
          onClick={() => actions.navigate(it.screen)}
        >
          <span className="icon">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}
