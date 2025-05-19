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
}>({
  size: undefined,
  tabs: undefined,
  current: undefined,
  setTab: undefined,
  responsive: false
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
}

const VTabs = ({
  tabs,
  defaultValue,
  current,
  className,
  fullWidth,
  children,
  onTabChange,
  responsive = false
}: TabsProps) => {
  const currentValue = typeof current === 'function' ? current() : current || defaultValue;

  const [value, setValue] = React.useState(currentValue);

  React.useEffect(() => {
    if (currentValue) {
      setValue(currentValue);
    }
  }, [currentValue]);

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    if (onTabChange) {
      onTabChange(newValue);
    }
  };

  const setTab = React.useCallback((tabName: string) => {
    handleValueChange(tabName);
  }, [handleValueChange]);

  return (
    <TabsContext.Provider value={{ tabs, size: fullWidth ? tabs.length : 0, current: value, setTab, responsive: responsive }}>
      <TabsPrimitive.Root
        defaultValue={tabs[0]?.name}
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
  const { tabs, size, current, setTab, responsive } = React.useContext(TabsContext);

  const fullWidth = size !== 0;

  const handleTabChange = React.useCallback((tabName: string) => {
    if (!tabs || !setTab) return;

    const tab = tabs.find(t => t.name === tabName);

    if (tab?.href) {
      window.history.pushState(null, '', tab.href);
    }

    setTab(tabName);

  }, [tabs, setTab]);

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
      <TabsList size={size} className={cn((fullWidth ? "w-full" : ""), className, (responsive ? "hidden lg:flex" : ""))}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.name}
            value={tab.name}
            disabled={tab.disabled}
            href={tab.href}
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
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { size?: number }
>(({ className, size, ...props }, ref) => (
  <TabsContext.Provider value={{ size }}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "border-b -mb-px flex space-x-4",
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
  }
>(({ className, href, ...props }, ref) => {
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
        "border-b-2 px-2 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer",
        "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
        "data-[state=active]:border-primary data-[state=active]:text-primary",
        "disabled:pointer-events-none disabled:opacity-50",
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