import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { Fragment } from "react";

export interface IListItem {
    id: string, name: string, description?: string
}
interface DropdownListProps {
    value: IListItem;
    items: IListItem[];
    onChange: (item: IListItem) => void;
}
export function DropdownList({ items, value, onChange }: DropdownListProps) {
    return (
        <Listbox value={value} onChange={onChange}>
            {({ open }) => (
                <div className="relative">
                    <div className="inline-flex divide-x divide-indigo-700 rounded-md shadow-2xs">
                        <div className="inline-flex items-center gap-x-1.5 rounded-l-md bg-indigo-600 px-3 py-2 text-white shadow-2xs">
                            {value.name && <Check className="-ml-0.5 size-5" aria-hidden="true" />}
                            <p className="text-sm font-semibold">{value.name || ""}</p>
                        </div>
                        <ListboxButton className="inline-flex items-center rounded-l-none rounded-r-md bg-indigo-600 p-2 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 focus:ring-offset-gray-50">
                            <span className="sr-only">Change selection</span>
                            <ChevronDown className="size-5 text-white" aria-hidden="true" />
                        </ListboxButton>
                    </div>

                    <Transition
                        show={open}
                        as={Fragment}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <ListboxOptions className="absolute right-0 z-10 mt-2 w-72 origin-top-right divide-y divide-gray-200 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-hidden">
                            {items.map((option) => (
                                <ListboxOption
                                    key={option.id}
                                    className={({ active }) =>
                                        clsx(
                                            active ? 'bg-indigo-600 text-white' : 'text-gray-900',
                                            'cursor-default select-none p-4 text-sm'
                                        )
                                    }
                                    value={option}
                                >
                                    {({ selected, active }) => (
                                        <div className="flex flex-col">
                                            <div className="flex justify-between">
                                                <p className={selected ? 'font-semibold' : 'font-normal'}>{option.name}</p>
                                                {selected ? (
                                                    <span className={active ? 'text-white' : 'text-indigo-600'}>
                                                        <Check className="size-5" aria-hidden="true" />
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className={clsx(active ? 'text-indigo-200' : 'text-gray-500', 'mt-2')}>
                                                {option.description}
                                            </p>
                                        </div>
                                    )}
                                </ListboxOption>
                            ))}
                        </ListboxOptions>
                    </Transition>
                </div>
            )}
        </Listbox>
    )
}