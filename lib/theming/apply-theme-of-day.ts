export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

const THEME_BY_TIME: Record<TimeOfDay, "light" | "dark"> = {
  morning: "light",
  afternoon: "light",
  evening: "dark",
  night: "dark",
};

export function applyThemeForTimeOfDay(timeOfDay: TimeOfDay): void {
  if (typeof document === "undefined") return;
  const theme = THEME_BY_TIME[timeOfDay];
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem("theme", theme);
  } catch {
    // localStorage may be unavailable (privacy mode); ignore
  }
}
