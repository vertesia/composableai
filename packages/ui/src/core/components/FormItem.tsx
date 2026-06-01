import clsx from 'clsx';
import { Info } from 'lucide-react';
import { Children, cloneElement, Fragment, isValidElement, type ReactNode, useId, useRef } from 'react';
import { VTooltip } from './shadcn/tooltip';

interface FormItemProps {
    label: ReactNode;
    children: ReactNode;
    /** Explicit id for the control. When omitted and FormItem can wire a single
     *  element child, an id is auto-generated via useId(). */
    childrenId?: string;
    className?: string;
    /** Tooltip text rendered on an Info icon next to the label.
     *  NOTE: this is *not* an a11y substitute for helpText — it is hover-only.
     *  For persistent helper text linked to the control via aria-describedby,
     *  use the `helpText` prop instead. */
    description?: ReactNode;
    /** Persistent helper text rendered below the control and linked via
     *  aria-describedby. Use this (not `description`) to give screen-reader
     *  users guidance on how to fill the field. */
    helpText?: ReactNode;
    /** Persistent error message rendered below the control. When set, the
     *  control gets aria-invalid="true" and the error id is appended to
     *  aria-describedby. */
    error?: ReactNode;
    required?: boolean;
    direction?: 'row' | 'column' | 'row-reverse';
    disabled?: boolean;
    /** When true, the label row stretches to full width. Useful when placing actions (e.g. buttons) inside the label. */
    fullWidthLabel?: boolean;
}

function joinIds(...ids: Array<string | undefined | false | null>): string | undefined {
    const filtered = ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
    return filtered.length > 0 ? filtered.join(' ') : undefined;
}

export function FormItem({
    description,
    helpText,
    error,
    required,
    label,
    className,
    direction = 'column',
    children,
    disabled = false,
    fullWidthLabel = false,
    childrenId,
}: FormItemProps) {
    const generatedId = useId();
    const helpTextId = useId();
    const errorId = useId();
    const inputId = childrenId ?? generatedId;
    const hasWarnedRef = useRef(false);

    // A single valid element child is the auto-wire target. Children.toArray flattens
    // nested arrays and fragments-of-elements, but a *single* element whose `type` is
    // Fragment is still counted as one element by React — cloning it would add props
    // to the Fragment (which ignores them), not to the input inside. Exclude that case.
    const validChildren = Children.toArray(children).filter(isValidElement);
    const singleChild = validChildren.length === 1 ? validChildren[0] : undefined;
    const isSingleFragment = singleChild?.type === Fragment;
    const canWireChild = !!singleChild && !isSingleFragment;
    let wired = false;

    let renderedChildren: ReactNode = children;
    if (canWireChild && singleChild) {
        const child = singleChild as React.ReactElement<Record<string, unknown>>;
        const childProps = child.props ?? {};
        const mergedDescribedBy = joinIds(
            childProps['aria-describedby'] as string | undefined,
            helpText ? helpTextId : undefined,
            error ? errorId : undefined,
        );
        const ariaInvalid = childProps['aria-invalid'] ?? (error ? true : undefined);
        renderedChildren = cloneElement(child, {
            id: (childProps.id as string | undefined) ?? inputId,
            'aria-describedby': mergedDescribedBy,
            'aria-invalid': ariaInvalid,
        });
        wired = true;
    } else if (
        process.env.NODE_ENV !== 'production' &&
        !hasWarnedRef.current &&
        (helpText || error || childrenId === undefined)
    ) {
        hasWarnedRef.current = true;
        // eslint-disable-next-line no-console
        console.warn(
            '[@vertesia/ui] FormItem received zero, multiple, or a fragment as element children. ARIA wiring skipped. ' +
                'Pass `childrenId` and set `id` / `aria-describedby` / `aria-invalid` on your input manually, ' +
                'or wrap the input in a single non-fragment element.',
        );
    }

    // Only set htmlFor when the label actually points at a real control:
    // either we wired the child (so it received `inputId`) or the consumer
    // provided `childrenId` and wired their input themselves.
    const labelHtmlFor = wired || childrenId ? inputId : undefined;

    return (
        <div
            className={clsx(
                'flex w-full space-y-1',
                className,
                direction === 'row'
                    ? 'flex-row justify-between items-center gap-2'
                    : direction === 'row-reverse'
                      ? 'flex-row-reverse justify-between items-center gap-2'
                      : 'flex-col',
            )}
        >
            <div className={clsx('flex items-center gap-1 mb-0', fullWidthLabel && 'w-full')}>
                <label
                    htmlFor={labelHtmlFor}
                    className={`text-sm font-medium mb-1 ${disabled ? 'text-muted' : ''} ${fullWidthLabel && 'flex-1'}`}
                >
                    {label}
                    {required ? <span className="text-destructive -mt-4 ms-1">*</span> : ''}
                </label>
                {description && (
                    <div className="mx-2 flex w-4 items-center">
                        <VTooltip description={description}>
                            <Info className="size-3 text-muted" />
                        </VTooltip>
                    </div>
                )}
            </div>
            {renderedChildren}
            {helpText && (
                <p id={helpTextId} className="text-xs text-muted">
                    {helpText}
                </p>
            )}
            {error && (
                <p id={errorId} className="text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
