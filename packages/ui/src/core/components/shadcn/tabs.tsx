import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "../libs/utils";
import { Tab, TabsContext as _TabContext } from '../tabs/TabsContext.js';
import { VSelectBox } from "./selectBox";

const TabsContext = React.createContext<{
  size?: number;
  tabs?: Tab[];
  current?: string;
  setTab?: (name: string) => void;
  responsive?: boolean;
  variant?: "tabs" | "pills";
  updateHash?: boolean;
}>({
  size: undefined,
  tabs: undefined,
  current: undefined,
  setTab: undefined,
  responsive: false,
  variant: "tabs",
  updateHash: true
});

interface TabsProps {
  current?: string | (() => string);
  tabs: Tab[];
  defaultValue?: string;
  className?: string;
  fullWidth?: boolean;
  children?: React.ReactNode;
  onTabChange?: (tabName: string) => void;
  responsive?: boolean;
  variant?: "tabs" | "pills";
  updateHash?: boolean;
}

const VTabs = ({
  tabs,
  defaultValue,
  current,
  className,
  fullWidth,
  children,
  onTabChange,
  responsive = false,
  variant = "tabs",
  updateHash = true
}: TabsProps) => {
  // Initialize value
  const [value, setValue] = React.useState(() => {
    // First check if current is provided
    const currentValue = typeof current === 'function' ? current() : current;
    if (currentValue) {
      return currentValue;
    }

    // Then check hash
    const hash = window.location.hash;
    const currentTab = hash ? hash.substring(1) : undefined;
    
    // Check if the tab from hash exists in tabs
    if (currentTab && tabs.some(tab => tab.name === currentTab)) {
      return currentTab;
    }
    
    // Fall back to default or first tab
    return defaultValue || tabs[0]?.name;
  });

  // Update when current prop changes (but don't create a loop)
  React.useEffect(() => {
    const currentValue = typeof current === 'function' ? current() : current;
    if (currentValue && currentValue !== value) {
      setValue(currentValue);
    }
  }, [current]);

  // Listen to hash changes only when there's no current prop being controlled externally
  React.useEffect(() => {
    if (current) return; // Skip hash handling if controlled by parent

    const handleHashChange = () => {
      const hash = window.location.hash;
      const currentTab = hash ? hash.substring(1) : undefined;
      
      // Only update if the tab exists in tabs
      if (currentTab && tabs.some(tab => tab.name === currentTab)) {
        setValue(currentTab);
      } else if (!hash && defaultValue) {
        // If no hash, fall back to default
        setValue(defaultValue);
      }
    };

    // Check initial hash
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [current, tabs, defaultValue]);

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    
    // Update the URL hash when tab changes (only if updateHash is true and not controlled by parent)
    if (updateHash && !current) {
      window.location.hash = newValue;
    }
    
    if (onTabChange) {
      onTabChange(newValue);
    }
  };

  const setTab = React.useCallback((tabName: string) => {
    handleValueChange(tabName);
  }, [handleValueChange]);

  return (
    <TabsContext.Provider value={{ tabs, size: fullWidth ? tabs.length : 0, current: value, setTab, responsive: responsive, variant, updateHash }}>
      <TabsPrimitive.Root
        defaultValue={value || tabs[0]?.name}
        value={value}
        onValueChange={handleValueChange}
        className={className}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsContext.Provider>
  );
};

const VTabsBar = ({ className }: { className?: string }) => {
  const { tabs, size, current, setTab, responsive, variant, updateHash } = React.useContext(TabsContext);

  const fullWidth = size !== 0;

  const handleTabChange = React.useCallback((tabName: string) => {
    if (!tabs || !setTab) return;

    const tab = tabs.find(t => t.name === tabName);

    if (tab?.href && updateHash) {
      window.history.pushState(null, '', tab.href);
    }

    setTab(tabName);

  }, [tabs, setTab, updateHash]);

  if (!tabs || !setTab) {
    console.warn("TabsBar: No tabs provided or setTab not available");
    return null;
  }

  return (
    <>
      {responsive && (
        <div className="px-2 block lg:hidden">
          <VSelectBox
            label="Tab"
            className={(className)}
            options={tabs}
            optionLabel={(tab: Tab) => typeof tab.label === 'string' ? tab.label : String(tab.label)}
            value={tabs.find(tab => tab.name === current)}
            onChange={(tab: Tab) => {
              handleTabChange(tab.name);
            }}
          />
        </div>
      )}
      <TabsList size={size} variant={variant} className={cn((fullWidth ? "w-full" : ""), className, (responsive ? "hidden lg:flex" : ""))}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.name}
            value={tab.name}
            disabled={tab.disabled}
            href={tab.href}
            variant={variant}
            onClick={() => handleTabChange(tab.name)}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </>
  );
};

const VTabsPanel = () => {
  const { tabs } = React.useContext(TabsContext);

  if (!tabs) return null;

  return (
    <>
      {tabs.map((tab) => (
        <TabsContent key={tab.name} value={tab.name}>
          {tab.content}
        </TabsContent>
      ))}
    </>
  );
};

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { size?: number; variant?: "tabs" | "pills" }
>(({ className, size, variant = "tabs", ...props }, ref) => (
  <TabsContext.Provider value={{ size, variant }}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        variant === "tabs" 
          ? "border-b -mb-px flex space-x-4"
          : "flex space-x-2 p-1 rounded-md",
        className
      )}
      {...props}
    />
  </TabsContext.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    href?: string;
    variant?: "tabs" | "pills";
  }
>(({ className, href, variant = "tabs", ...props }, ref) => {
  const { size } = React.useContext(TabsContext);

  const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    if (href) {
      event.preventDefault();
      window.history.pushState(null, '', href);
    }
    if (props.onClick) {
      (props.onClick as React.MouseEventHandler<HTMLButtonElement>)(event);
    }
  }, [href, props.onClick]);

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        variant === "tabs" 
          ? cn(
              "border-b-2 px-2 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer",
              "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              "data-[state=active]:border-primary data-[state=active]:text-primary",
              "disabled:pointer-events-none disabled:opacity-50"
            )
          : cn(
              "px-3 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer rounded-sm transition-colors",
              "tborder border-input bg-muted shadow-xs hover:bg-muted ring-inset",
              "data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm",
              "disabled:pointer-events-none disabled:opacity-50"
            ),
        className,
        size ? `w-1/${size}` : ""
      )}
      onClick={handleClick}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "focus-visible:outline-none",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { VTabs, VTabsBar, VTabsPanel, TabsList, TabsTrigger, TabsContent };