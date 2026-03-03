import { Computer, Moon, Sun } from "lucide-react"

import { Button } from "../button"
import { useTheme } from "./ThemeProvider"

interface ModeOptionProps {
  current: string;
  option: ("system" | "light" | "dark");
  setTheme: (theme: "system" | "light" | "dark") => void;
  icon: React.ReactNode;
}

export function ModeOption({ option, current, setTheme, icon }: ModeOptionProps) {
  return (
    <Button variant={current === option ? "secondary" : "outline"} size="sm" onClick={() => setTheme(option)} alt={option}>
      {icon}
    </Button>
  );
}

interface ModeToggleProps {
  /** Label shown to the left of the buttons. Defaults to "Theme". Pass `false` to hide. */
  label?: string | false;
  className?: string;
}

export function ModeToggle({ label = "Theme", className }: ModeToggleProps = {}) {
  const { setTheme, theme } = useTheme()

  return (
    <div className={className ?? (label ? "flex justify-between px-2 items-center" : "flex items-center gap-1")}>
      {label && <p className="text-sm font-semibold">{label}</p>}
      <div className="flex gap-2">
        <ModeOption current={theme} option="system" setTheme={setTheme} icon={<Computer />} />
        <ModeOption current={theme} option="light" setTheme={setTheme} icon={<Sun />} />
        <ModeOption current={theme} option="dark" setTheme={setTheme} icon={<Moon />} />
      </div>
    </div>
  )
}
