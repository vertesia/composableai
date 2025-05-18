import clsx from "clsx";
import { ReactNode, useState } from "react";

export abstract class RadioOptionAdapter<T> {
    abstract labelOf(item: T): string;
    abstract idOf(item: T): string;
    renderOption(item: T): ReactNode {
        return this.labelOf(item);
    }
    findById(items: T[], id: string) {
        return items.find(item => this.idOf(item) === id);
    }
}

interface RadioGroupProps<OptionT> {
    checkIcon?: React.ComponentType<CheckIconProps>;
    options: OptionT[];
    cols?: `grid-cols-${number}`;
    gap?: `gap-${number}`;
    value?: OptionT;
    onChange: (value: OptionT) => void;
    adapter: RadioOptionAdapter<OptionT>;
    checkColor?: string;
}
export function RadioGroup<OptionT>({ checkColor, cols = "grid-cols-1", gap = "gap-2", value, onChange, options, checkIcon: CheckIcon = DefaultCheckIcon, adapter }: RadioGroupProps<OptionT>) {
    const [selected, setSelected] = useState(value);
    const onSelect = (option: OptionT) => {
        setSelected(option);
        onChange(option);
    }
    const selectedId = selected ? adapter.idOf(selected) : undefined;
    return (
        <div className={clsx("grid", cols, gap)}>
            {
                options.map(option => {
                    const key = adapter.idOf(option);
                    return (
                        <RadioOption
                            checkColor={checkColor}
                            isSelected={key === selectedId}
                            option={option} adapter={adapter}
                            onSelect={onSelect}
                            CheckIcon={CheckIcon} key={key}
                        />
                    );
                })
            }
        </div>
    )
}

interface RadioOptionProps<OptionT> {
    CheckIcon: React.ComponentType<CheckIconProps>;
    isSelected: boolean;
    option: OptionT;
    adapter: RadioOptionAdapter<OptionT>;
    onSelect: (option: OptionT) => void;
    checkColor?: string;
}
function RadioOption<OptionT>({ checkColor, CheckIcon, adapter, isSelected, option, onSelect }: RadioOptionProps<OptionT>) {
    const [isHighlighted, setIsHighlighted] = useState(false);
    return (
        <div className="flex gap-1 cursor-pointer items-center" onClick={() => onSelect(option)}
            onMouseEnter={() => setIsHighlighted(true)} onMouseLeave={() => setIsHighlighted(false)} >
            <div className="">
                <CheckIcon size={24} isChecked={isSelected} isHighlighted={isHighlighted} color={checkColor} />
            </div>
            <div>{adapter.renderOption(option)}</div>
        </div>
    )
}

export interface CheckIconProps {
    size: number;
    isChecked: boolean;
    isHighlighted?: boolean;
    color?: string;
}
function DefaultCheckIcon({ size, isChecked, isHighlighted, color = "currentColor" }: CheckIconProps) {
    //https://www.svgrepo.com/svg/309414/checkbox-checked
    //https://www.svgrepo.com/svg/309415/checkbox-unchecked
    const opacity = isHighlighted ? 1 : 0.6;
    return isChecked ? (
        <svg width={`${size}px`} height={`${size}px`} viewBox="0 0 24 24" version="1.1">
            <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                <g id="ic_fluent_checkbox_checked_24_regular" fill={color} fillRule="nonzero" opacity={opacity}>
                    <path d="M18.25,3 C19.7687831,3 21,4.23121694 21,5.75 L21,18.25 C21,19.7687831 19.7687831,21 18.25,21 L5.75,21 C4.23121694,21 3,19.7687831 3,18.25 L3,5.75 C3,4.23121694 4.23121694,3 5.75,3 L18.25,3 Z M18.25,4.5 L5.75,4.5 C5.05964406,4.5 4.5,5.05964406 4.5,5.75 L4.5,18.25 C4.5,18.9403559 5.05964406,19.5 5.75,19.5 L18.25,19.5 C18.9403559,19.5 19.5,18.9403559 19.5,18.25 L19.5,5.75 C19.5,5.05964406 18.9403559,4.5 18.25,4.5 Z M10,14.4393398 L16.4696699,7.96966991 C16.7625631,7.6767767 17.2374369,7.6767767 17.5303301,7.96966991 C17.7965966,8.23593648 17.8208027,8.65260016 17.6029482,8.94621165 L17.5303301,9.03033009 L10.5303301,16.0303301 C10.2640635,16.2965966 9.84739984,16.3208027 9.55378835,16.1029482 L9.46966991,16.0303301 L6.46966991,13.0303301 C6.1767767,12.7374369 6.1767767,12.2625631 6.46966991,11.9696699 C6.73593648,11.7034034 7.15260016,11.6791973 7.44621165,11.8970518 L7.53033009,11.9696699 L10,14.4393398 L16.4696699,7.96966991 L10,14.4393398 Z" />
                </g>
            </g>
        </svg>
    ) : (
        <svg width={`${size}px`} height={`${size}px`} viewBox="0 0 24 24" version="1.1">
            <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                <g id="ic_fluent_checkbox_unchecked_24_regular" fill={color} fillRule="nonzero" opacity={opacity}>
                    <path d="M5.75,3 L18.25,3 C19.7687831,3 21,4.23121694 21,5.75 L21,18.25 C21,19.7687831 19.7687831,21 18.25,21 L5.75,21 C4.23121694,21 3,19.7687831 3,18.25 L3,5.75 C3,4.23121694 4.23121694,3 5.75,3 Z M5.75,4.5 C5.05964406,4.5 4.5,5.05964406 4.5,5.75 L4.5,18.25 C4.5,18.9403559 5.05964406,19.5 5.75,19.5 L18.25,19.5 C18.9403559,19.5 19.5,18.9403559 19.5,18.25 L19.5,5.75 C19.5,5.05964406 18.9403559,4.5 18.25,4.5 L5.75,4.5 Z" />
                </g>
            </g>
        </svg>
    )
}
