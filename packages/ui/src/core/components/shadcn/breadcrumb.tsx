import * as React from "react"
import { ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "../libs/utils"

interface BreadcrumbProps {
  label: string
  href?: string
}
interface BreadcrumbItemProps {
  children: BreadcrumbProps[]
  className?: string
  maxItems?: number
  separator?: React.ReactNode
}
export function Breadcrumbs({ children, maxItems = 3, className, separator }: BreadcrumbItemProps) {
  if (children.length <= maxItems) {
    return (
      <Breadcrumb className={cn("w-full", className)}>
        <BreadcrumbList>
          {children.map((item, index) => (
            <React.Fragment key={index}>
              <BreadcrumbItem>
                {item.href ? (
                  <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {index < children.length - 1 &&
                <BreadcrumbSeparator>{separator ?? <ChevronRight />}</BreadcrumbSeparator>
              }
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const firstItem = children[0];
  const lastItems = children.slice(-(maxItems - 2));

  return (
    <Breadcrumb className={cn("w-full", className)}>
      <BreadcrumbList>
        <BreadcrumbItem>
          {firstItem.href ? (
            <BreadcrumbLink href={firstItem.href}>{firstItem.label}</BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{firstItem.label}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator>{separator ?? <ChevronRight />}</BreadcrumbSeparator>

        <BreadcrumbItem>
          <BreadcrumbEllipsis />
        </BreadcrumbItem>
        <BreadcrumbSeparator>{separator ?? <ChevronRight />}</BreadcrumbSeparator>

        {lastItems.map((item, index) => (
          <React.Fragment key={index}>
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {index < lastItems.length - 1 && <BreadcrumbSeparator>{separator ?? <ChevronRight />}</BreadcrumbSeparator>
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
      "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
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
    className={cn("inline-flex items-center gap-1.5", className)}
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
      className={cn("transition-colors hover:text-foreground", className)}
      {...props}
    />
  )
})
BreadcrumbLink.displayName = "BreadcrumbLink"

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
