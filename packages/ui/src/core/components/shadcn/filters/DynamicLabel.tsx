import React, { useEffect, useState } from 'react';

interface DynamicLabelProps {
  value: string;
  labelRenderer?: (value: string) => React.ReactNode | Promise<React.ReactNode>;
  fallbackLabel?: React.ReactNode;
}
export function DynamicLabel({ value, labelRenderer, fallbackLabel }: Readonly<DynamicLabelProps>) {
  const [label, setLabel] = useState<React.ReactNode>(fallbackLabel || value);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!labelRenderer) {
      setLabel(fallbackLabel || value);
      return;
    }

    const renderLabel = async () => {
      setIsLoading(true);
      try {
        const result = labelRenderer(value);
        if (result instanceof Promise) {
          const resolvedLabel = await result;
          setLabel(resolvedLabel);
        } else {
          setLabel(result);
        }
      } catch (error) {
        console.error('Error rendering label:', error);
        setLabel(fallbackLabel || value);
      } finally {
        setIsLoading(false);
      }
    };

    renderLabel();
  }, [value, labelRenderer, fallbackLabel]);

  if (isLoading) {
    return <span className="text-muted-foreground">Loading...</span>;
  }

  return <>{label}</>;
}