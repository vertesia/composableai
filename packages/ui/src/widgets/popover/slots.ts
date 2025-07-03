import { Children, FunctionComponent, ReactElement, ReactNode, isValidElement } from "react";

const __SLOT_NAME = Symbol('__SLOT_NAME')

export function processOneSlot(child: ReactNode, out: ReactNode[], slots: Record<string, ReactElement>) {
    let slotName: string | undefined;
    if (isValidElement(child) && (slotName = (child as any).type[__SLOT_NAME])) {
        slots[slotName] = child;
    } else {
        out.push(child);
    }
}
export function processSlots(children: ReactNode | Iterable<ReactNode>, slots: Record<string, ReactElement>): ReactNode | ReactNode[] {
    const out: ReactNode[] = [];

    Children.forEach(children, child => {
        processOneSlot(child, out, slots);
    })
    return out.length > 1 ? out : out[0];
}

export function defineSlot(name: string, component: FunctionComponent<any>) {
    (component as any)[__SLOT_NAME] = name;
}
