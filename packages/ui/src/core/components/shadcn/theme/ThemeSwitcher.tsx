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

export function ModeToggle() {
  const { setTheme } = useTheme()
  const theme = useTheme().theme

  return (
    <div className="flex justify-between px-2 items-center">
      <p className="text-sm font-semibold">Theme</p>
      <div className="flex gap-2">
        <ModeOption current={theme} option="system" setTheme={setTheme} icon={<Computer className="text-muted" />} />
        <ModeOption current={theme} option="light" setTheme={setTheme} icon={<Sun className="text-muted" />} />
        <ModeOption current={theme} option="dark" setTheme={setTheme} icon={<Moon className="text-muted" />} />
      </div>
    </div>
  )
}
