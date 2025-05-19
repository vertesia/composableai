import { RadioGroup } from '@headlessui/react'
import clsx from 'clsx'


interface SelectStackOption {
    id: string
    label: string
    description?: React.ReactNode
}

interface SelectStackProps {
    onSelect: (option: SelectStackOption) => void
    selected?: SelectStackOption
    options: SelectStackOption[]
}

export function SelectStack({ onSelect, selected, options }: SelectStackProps) {

    return (
        <RadioGroup value={selected} onChange={onSelect}>
            <RadioGroup.Label className="sr-only">Server size</RadioGroup.Label>
            <div className="space-y-4">
                {options.map((option) => (
                    <RadioGroup.Option
                        key={option.id}
                        value={option}
                        className={({ active }) =>
                            clsx(
                                active ? 'border-border ring-2 ring-ring' : 'border-border',
                                'relative block cursor-pointer rounded-lg border bg-accent px-6 py-4 shadow-2xs focus:outline-hidden sm:flex sm:justify-between'
                            )
                        }
                    >
                        {({ active, checked }) => (
                            <>
                                <span className="flex items-center">
                                    <span className="flex flex-col text-sm">
                                        <RadioGroup.Label as="span" className="font-medium text-text">
                                            {option.label}
                                        </RadioGroup.Label>
                                        {option.description &&
                                            <RadioGroup.Description as="span" className="text-muted-foreground">
                                                {option.description}
                                            </RadioGroup.Description>
                                        }
                                    </span>
                                </span>
                                <span
                                    className={clsx(
                                        active ? 'border' : 'border-2',
                                        checked ? 'border-accent-foreground' : 'border-transparent',
                                        'pointer-events-none absolute -inset-px rounded-lg'
                                    )}
                                    aria-hidden="true"
                                />
                            </>
                        )}
                    </RadioGroup.Option>
                ))}
            </div>
        </RadioGroup>
    )
}
