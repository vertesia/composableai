import { ActivityDefinition, ActivityPropertyDefinition, ActivityTypeDefinition } from "@vertesia/common";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import React, { useMemo, useState } from "react";

function Badge({ children, secondary = false }: { children: React.ReactNode, secondary?: boolean }) {
    const className = secondary ? "bg-secondary text-primary" : "text-foreground bg-muted";
    return <span className={className}>{children}</span>
}

/**
 * Resolve nested array inner type
 * @param innerType
 */
function resolveInnerType(innerType: ActivityTypeDefinition | undefined) {
    if (!innerType) {
        return undefined;
    } else if (innerType.name === "array") {
        return resolveInnerType(innerType.innerType);
    } else {
        return innerType;
    }
}

interface PropertySignatureProps {
    property: ActivityPropertyDefinition;
}
function PropertySignature({ property }: PropertySignatureProps) {
    return (
        <div className="flex items-center gap-x-2">
            <div className="font-semibold text-gray-600">{property.name}</div>
            {property.optional && <Badge>optional</Badge>}
            <Badge>{property.type.value}</Badge>
        </div>
    )
}
interface ActivitiesDocProps {
    activities: ActivityDefinition[];
}
export function ActivitiesDoc({ activities }: ActivitiesDocProps) {
    return (
        <div className='flex flex-col gap-y-4 divide-y divide-gray-200'>
            {activities.map(activity => <ActivityDoc key={activity.name} activity={activity} />)}
        </div>
    )
}

interface ActivitySectionTitleProps {
    children: React.ReactNode;
    code?: string;
}
function ActivitySectionTitle({ code, children }: ActivitySectionTitleProps) {
    return (
        <div className="flex gap-2 items-center border-b border-b-gray-200 mb-2">
            <div className='text-lg font-medium text-gray-900 py-2 '>{children}</div>
            {code && <div><Badge>{code}</Badge></div>}
        </div>
    )
}
interface ActivityDocProps {
    activity: ActivityDefinition;
    headingRef?: React.RefObject<HTMLDivElement>;
    headingClass?: string;
}
export function ActivityDoc({ activity, headingClass, headingRef }: ActivityDocProps) {
    return (
        <div className={headingClass} id={activity.name} ref={headingRef}>
            <div className="text-xl font-semibold pt-8">{activity.title}</div>
            <div className="pb-4"><Badge>{activity.name}</Badge></div>
            {
                activity.doc &&
                <div className="text-gray-700 pb-2">{activity.doc}</div>
            }

            <div className="pb-4">
                <ActivitySectionTitle code={activity.paramsType}>Parameters</ActivitySectionTitle>
                <div className="divide-y divide-gray-100">
                    {activity.params.map(prop =>
                        <PropertyDetails key={prop.name} property={prop} />
                    )}
                </div>
            </div>
            <div className="pb-4">
                <ActivitySectionTitle>Returns</ActivitySectionTitle>
                <div>{activity.returnType ? activity.returnType.value : "void"}</div>
            </div>

        </div>
    )
}

function PropertyDetails({ property, className }: { className?: string, property: ActivityPropertyDefinition }) {
    const expandable = useMemo(() => {
        const type = resolveInnerType(property.type.innerType) ?? property.type;
        if (type.name === "object" && type.members) {
            return <ObjectMembersPanel members={type.members} />
        } else if (type.name === 'enum' && type.enum) {
            return <EnumValuesPanel values={type.enum} />
        } else {
            return null;
        }
    }, [property.type.innerType]);
    return (
        <div className={clsx("py-2", className)}>
            <PropertySignature property={property} />
            {property.doc && <div className="text-gray-700 text-sm pt-2">
                {property.doc}
            </div>}
            {expandable && <div className="my-2 overflow-hidden">
                {expandable}
            </div>
            }
        </div>
    )
}

interface EnumValuesPanelProps {
    values: string[] | number[];
}
function EnumValuesPanel({ values }: EnumValuesPanelProps) {
    return <div className="flex flex-wrap items-center gap-2">{
        values.map((v, i) => <Badge secondary key={i}>{v}</Badge>)
    }</div>
}

function ObjectMembersPanel({ members }: { members: ActivityPropertyDefinition[] }) {
    return <ExpandablePanel
        className='rounded-md border border-gray-200'
        button={(isOn) => (
            <div className="px-4 py-2 flex items-center gap-x-2 text-sm font-medium hover:text-blue-600">
                <ExpandIcon isOpen={isOn} />
                {
                    isOn ?
                        <div>Hide child properties</div>
                        :
                        <div>Show child properties</div>
                }
            </div>
        )}
        body={<NestedPropertiesDetails properties={members} />} />
}

function NestedPropertiesDetails({ properties }: { properties: ActivityPropertyDefinition[] }) {
    return (
        <div className='border-l-2 border-l-blue-200 flex flex-col divide-y divide-gray-100 border-t border-t-gray-200'>
            {properties.map(prop => <PropertyDetails key={prop.name} property={prop} className="px-4 py-2" />)}
        </div>
    )
}

interface ExpandablePanelProps {
    isInitiallyOpen?: boolean;
    className?: string;
    button: (isOn: boolean) => React.ReactNode;
    body: React.ReactNode | React.ReactNode[];
}
function ExpandablePanel({ button, body, className, isInitiallyOpen }: ExpandablePanelProps) {
    const [isExpanded, setExpanded] = useState(isInitiallyOpen || false);
    return (
        <div className={clsx(isExpanded ? "block" : "inline-block", className)}>
            <button className='p-0 m-0 bg-transparent' onClick={() => setExpanded(!isExpanded)}>
                <AnimatePresence>
                    {button(isExpanded)}
                </AnimatePresence>
            </button>
            <AnimatePresence>
                {
                    isExpanded && <motion.div className='overflow-hidden'
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                    >
                        {body}
                    </motion.div>
                }
            </AnimatePresence>
        </div>
    )
}

interface ExpandIconProps {
    isOpen: boolean;
}
function ExpandIcon({ isOpen }: ExpandIconProps) {
    return (
        <AnimatePresence propagate mode="wait">
            <motion.div
                className="font-mono font-semibold text-gray-400 text-lg"
                key="closeIcon"
                initial={{ rotate: 0 }}
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
            >
                +
            </motion.div>
        </AnimatePresence>
    )
}