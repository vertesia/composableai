import { Computer, Moon, Sun } from "lucide-react"

import { Button } from "../button"
import { useTheme } from "./ThemeProvider"
import { useUITranslation } from "../../../../i18n/index.js"

interface ModeOptionProps {
  current: string;
  option: ("system" | "light" | "dark");
  setTheme: (theme: "system" | "light" | "dark") => void;
  icon: React.ReactNode;
  alt: string;
}

export function ModeOption({ option, current, setTheme, icon, alt }: ModeOptionProps) {
  return (
    <Button variant={current === option ? "secondary" : "outline"} size="sm" onClick={() => setTheme(option)} alt={alt}>
      {icon}
    </Button>
  );
}

interface ModeToggleProps {
  /** Label shown to the left of the buttons. Defaults to translated "Theme". Pass `false` to hide. */
  label?: string | false;
  className?: string;
}

export function ModeToggle({ label, className }: ModeToggleProps = {}) {
  const { setTheme, theme } = useTheme()
  const { t } = useUITranslation()
  const resolvedLabel = label === false ? false : (label ?? t('theme.label'))

  return (
    <div className={className ?? (resolvedLabel ? "flex justify-between px-2 items-center" : "flex items-center gap-1")}>
      {resolvedLabel && <p className="text-sm font-semibold">{resolvedLabel}</p>}
      <div className="flex gap-2">
        <ModeOption current={theme} option="system" setTheme={setTheme} icon={<Computer />} alt={t('theme.system')} />
        <ModeOption current={theme} option="light" setTheme={setTheme} icon={<Sun />} alt={t('theme.light')} />
        <ModeOption current={theme} option="dark" setTheme={setTheme} icon={<Moon />} alt={t('theme.dark')} />
      </div>
    </div>
  )
}
