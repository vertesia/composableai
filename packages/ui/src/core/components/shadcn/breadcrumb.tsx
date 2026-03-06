import * as React from "react"
import { ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "../libs/utils"
import { Button } from "./button"

interface BreadcrumbProps {
  label: string | React.ReactNode
  href?: string
  onClick?: () => void
}
interface BreadcrumbItemProps {
  path: BreadcrumbProps[]
  className?: string
  maxItems?: number
  separator?: React.ReactNode
}
export function Breadcrumbs({ path, maxItems = 3, className, separator }: BreadcrumbItemProps) {
  const items = path || [];

  const renderBreadcrumbItem = (item: BreadcrumbProps) => {
    if (item.onClick) {
      return <BreadcrumbButton onClick={item.onClick} href={item.href}>{item.label}</BreadcrumbButton>;
    } else if (item.href) {
      return <BreadcrumbButton href={item.href}>{item.label}</BreadcrumbButton>;
    } else {
      return <BreadcrumbPage>{item.label}</BreadcrumbPage>;
    }
  };

  if (items.length <= maxItems) {
    return (
      <Breadcrumb className={cn("w-full flex items-center", className)}>
        <BreadcrumbList>
          {items.map((item, index) => (
            <React.Fragment key={index}>
              <BreadcrumbItem>
                {renderBreadcrumbItem(item)}
              </BreadcrumbItem>
              {index < items.length - 1 &&
                <BreadcrumbSeparator>{separator ?? <ChevronRight />}</BreadcrumbSeparator>
              }
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const lastThreeItems = items.slice(-(maxItems - 1));

  return (
    <Breadcrumb className={cn("w-full flex items-center", className)}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbEllipsis />
        </BreadcrumbItem>
        <BreadcrumbSeparator>{separator ?? <ChevronRight />}</BreadcrumbSeparator>

        {lastThreeItems.map((item, index) => (
          <React.Fragment key={index}>
            <BreadcrumbItem>
              {renderBreadcrumbItem(item)}
            </BreadcrumbItem>
            {index < lastThreeItems.length - 1 && <BreadcrumbSeparator>{separator ?? <ChevronRight />}</BreadcrumbSeparator>
            }
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode
  }
>(({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />)
Breadcrumb.displayName = "Breadcrumb"

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<"ol">
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted sm:gap-2.5",
      className
    )}
    {...props}
  />
))
BreadcrumbList.displayName = "BreadcrumbList"

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("inline-flex items-center gap-1.5 text-muted", className)}
    {...props}
  />
))
BreadcrumbItem.displayName = "BreadcrumbItem"

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a"> & {
    asChild?: boolean
  }
>(({ asChild, className, ...props }, ref) => {
  return (
    <a
      ref={ref}
      className={cn("transition-colors hover:text-muted", className)}
      {...props}
    />
  )
})
BreadcrumbLink.displayName = "BreadcrumbLink"

const BreadcrumbButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> & {
    href?: string
  }
>(({ className, href, onClick, ...props }, ref) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <Button
      variant="ghost"
      size={"md"}
      ref={ref}
      className={cn("p-0!", className)}
      onClick={handleClick}
      {...props}
    />
  );
})
BreadcrumbButton.displayName = "BreadcrumbButton"

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn("font-normal text-foreground", className)}
    {...props}
  />
))
BreadcrumbPage.displayName = "BreadcrumbPage"

const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) => (
  <li
    role="presentation"
    aria-hidden="true"
    className={cn("[&>svg]:w-3.5 [&>svg]:h-3.5", className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
)
BreadcrumbSeparator.displayName = "BreadcrumbSeparator"

const BreadcrumbEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
)
BreadcrumbEllipsis.displayName = "BreadcrumbEllipsis"
