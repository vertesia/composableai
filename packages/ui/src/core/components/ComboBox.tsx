import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import clsx from 'clsx';
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { AlignType, Popup, PopupController } from "./popup/index";

const INPUT_UNSTYLED = "block m-0 p-0 border-0 focus:outline-none focus:ring-0 bg-transparent"
const INPUT_NO_PADDING = "block sm:text-sm sm:leading-6 rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 dark:text-slate-50 dark:bg-slate-800 placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-800"
const INPUT = INPUT_NO_PADDING + " py-1.5";
const COMBOBOX_POPUP = "combobox-popup";

function genComboboxPopupId() {
    return `combobox-popup-${Math.floor(Math.random() * 1000000)}`;
}

export abstract class OptionAdapter<T> {
    abstract valueOf(item: T): string;
    abstract idOf(item: T): string;
    filter(items: T[], text: string) {
        const lcText = text.toLowerCase();
        return items.filter((item: T) => this.valueOf(item).toLowerCase().includes(lcText));
    }
    renderOption(item: T): ReactNode {
        return this.valueOf(item);
    }
    findById(items: T[], id: string) {
        return items.find(item => this.idOf(item) === id);
    }
    // override to support creating new items
    createItem(_value: string): T | null {
        return null; // default is no new item
    }
}

export class StringOptionAdapter extends OptionAdapter<string> {
    valueOf(item: string): string {
        return String(item);
    }
    idOf(item: string): string {
        return String(item);
    }
    static instance = new StringOptionAdapter();
}
export class StringOptionAdapterWithCreate extends StringOptionAdapter {
    createItem(value: string): string {
        return value;
    }
    static instance = new StringOptionAdapterWithCreate();
}

export interface ComboBoxLayoutProps<T> {
    buttonRight?: number;
    buttonWidth?: number;
    maxMenuHeight?: number;
    menuClass?: string;
    inputClass?: string;
    optionClass?: string;
    Input?: React.ComponentType<ComboInputProps<T>>;
    Menu?: React.ComponentType<ComboMenuProps<T>>;
    Toggle?: React.ComponentType<ComboToggleProps<T>> | null;
}

export type ComboBoxLayout<T> = Required<ComboBoxLayoutProps<T>>

export function getDefaultComboBoxLayout<T>(fullWidth?: boolean, unstyledInput?: boolean): ComboBoxLayout<T> {
    return {
        buttonRight: 4,
        buttonWidth: 24,
        maxMenuHeight: 240,
        menuClass: "w-72 bg-white mt-1 shadow-md border border-gray-200 overflow-auto p-0 z-10",
        inputClass: clsx(unstyledInput ? INPUT_UNSTYLED : INPUT, fullWidth ? "w-full" : "!w-auto"),
        optionClass: "py-2 px-3 shadow-sm flex flex-col [&.option-selected]:font-semibold [&.option-highlighted]:bg-blue-300",
        Input: ComboInput<T>,
        Menu: ComboMenu<T>,
        Toggle: ComboToggle<T>,
    }
}

export interface ComboBoxApi<T> {
    open: () => void;
    close: () => void;
    toggle: () => void;
    inputValue: string;
    selectedItem: T | null;
    setInputValue: (value: string) => void;
    focus: () => void;
}
interface ComboBoxProps<T> {
    items: T[];
    adapter: OptionAdapter<T>;
    // if true then the default layout will use an unstyled input
    unstyledInput?: boolean;
    // if true then the default layout will use w-full on the input
    fullWidth?: boolean;
    layout?: ComboBoxLayoutProps<T>;
    placeholder?: string;
    api?: React.MutableRefObject<ComboBoxApi<T> | null>;
    //TODO
    value?: T | null;
    //TODO onselect too?
    onSelect?: (value: T | null) => void;
    // menu zIndex
    zIndex?: number;
    focusOnMount?: boolean
    menuGap?: number;
    menuAlign?: AlignType;
}
export function ComboBox<T>({ menuAlign = "fill", menuGap, focusOnMount, onSelect, value, zIndex, unstyledInput, fullWidth, api, layout: layoutOpts, adapter, items, placeholder }: ComboBoxProps<T>) {
    const [popupId] = useState(genComboboxPopupId());
    const popupCtrl = useRef<PopupController | undefined>(undefined);
    const inputRef = useRef<HTMLInputElement>(null);
    const layout: ComboBoxLayout<T> = layoutOpts ? Object.assign(getDefaultComboBoxLayout<T>(fullWidth, unstyledInput), layoutOpts) : getDefaultComboBoxLayout<T>(fullWidth, unstyledInput);
    const inputBoxRef = React.useRef<HTMLDivElement>(null);
    const ctrl = useComboboxCtrl<T>({
        adapter,
        items,
        value,
        popupId
    });
    useEffect(() => {
        if (inputRef.current) {
            focusOnMount && inputRef.current.focus();
        }
    }, [inputRef.current]);
    // the onSelect callback may change so we need to refresh it.
    useEffect(() => {
        ctrl.onSelect = onSelect
        ctrl.popupCtrl = popupCtrl.current;
    }, [onSelect, popupCtrl.current]);
    useEffect(() => {
        if (api && ctrl && inputRef.current) {
            api.current = {
                open: () => ctrl.openMenu(),
                close: () => ctrl.closeMenu(),
                toggle: () => ctrl.toggleMenu(),
                setInputValue: (value: string) => ctrl.inputText = value,
                inputValue: ctrl.inputText || '',
                selectedItem: ctrl.selectedItem,
                focus: () => inputRef.current?.focus()
            }
            return () => {
                api.current = null;
            }
        }
    }, [api, ctrl, inputRef.current]);

    const showMenu = ctrl.isMenuOpen && ctrl.filteredItems.length > 0;

    return (
        <>
            <layout.Input boxRef={inputBoxRef} inputRef={inputRef} ctrl={ctrl} layout={layout} placeholder={placeholder} />
            <Popup
                id={popupId}
                ctrlRef={popupCtrl}
                className={COMBOBOX_POPUP}
                closeOnClick closeOnEsc
                onClose={() => ctrl.closeMenu()}
                isOpen={showMenu} anchor={inputBoxRef} zIndex={zIndex} constraints={{
                    position: "bottom",
                    align: menuAlign,
                    gap: menuGap != null ? menuGap : 4
                }}>
                <layout.Menu fillWidth={menuAlign === "fill"} items={ctrl.filteredItems} ctrl={ctrl} layout={layout} adapter={adapter} />
            </Popup>
        </>
    );
}

export interface ComboInputProps<T> {
    layout: ComboBoxLayout<T>;
    ctrl: ComboboxController<T>,
    placeholder?: string
    boxRef?: React.RefObject<HTMLDivElement | null>;
    inputRef?: React.RefObject<HTMLInputElement | null>;
}
function ComboInput<T>({ inputRef, placeholder, boxRef, ctrl, layout }: ComboInputProps<T>) {
    const buttonWidth = layout.buttonWidth;
    const style = buttonWidth > 0 ? { paddingRight: `${buttonWidth}px` } : undefined;
    const Toggle = layout.Toggle;
    return (
        <div className="relative" ref={boxRef}>
            <input ref={inputRef} placeholder={placeholder} {...ctrl.getInputProps()} style={style} className={layout.inputClass} />
            {Toggle &&
                <button style={{
                    top: 0, bottom: 0, right: `${layout.buttonRight}px`, width: `${buttonWidth}px`,
                    position: "absolute",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    backgroundColor: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }} {...ctrl.getToggleButtonProps()}>
                    <Toggle ctrl={ctrl} layout={layout} />
                </button>
            }
        </div>
    )
}

export interface ComboToggleProps<T> {
    ctrl: ComboboxController<T>;
    layout: ComboBoxLayout<T>;
}
function ComboToggle<T>({ ctrl }: ComboToggleProps<T>) {
    return ctrl.isMenuOpen ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />;
}

export interface ComboMenuProps<T> {
    items: T[];
    layout: ComboBoxLayout<T>;
    ctrl: ComboboxController<T>;
    adapter: OptionAdapter<T>;
    fillWidth: boolean;
}
function ComboMenu<T>({ fillWidth, items, layout, ctrl, adapter }: ComboMenuProps<T>) {
    const { highlightedIndex, selectedItem } = ctrl;
    return (
        <ul style={{ width: fillWidth ? "100%" : undefined, maxHeight: layout.maxMenuHeight ? `${layout.maxMenuHeight}px` : '240px' }}
            className={layout.menuClass} {...ctrl.getMenuProps()}>
            {items.map((item, index) => (
                <li
                    data-index={index}
                    key={adapter.idOf(item)}
                    className={clsx(layout.optionClass,
                        highlightedIndex === index && "option-highlighted",
                        selectedItem === item && "option-selected")}
                    {...ctrl.getItemProps(item, index)}
                >
                    {adapter.renderOption(item)}
                </li>
            ))
            }
        </ul >
    )
}



export interface ComboboxControllerProps<ItemT> {
    adapter: OptionAdapter<ItemT>,
    items: ItemT[],
    value?: ItemT | string | null,
    popupId: string;
}
export function useComboboxCtrl<ItemT>(props: ComboboxControllerProps<ItemT>): ComboboxController<ItemT> {
    const [ctrl, setCtrl] = useState<ComboboxController<ItemT>>(new ComboboxController(props));
    useEffect(() => {
        ctrl?.withState(setCtrl);
    }, []);
    return ctrl;
}


class ComboboxController<ItemT> {
    private popupId: string;
    public items: ItemT[];
    private adapter: OptionAdapter<ItemT>;
    onSelect?: (item: ItemT | null) => void;
    private setState?: (ctrl: ComboboxController<ItemT>) => void;
    private _selectedItem: ItemT | null = null;
    private _filteredItems: ItemT[];
    private _inputText: string = "";
    private _highlightedIndex: number | null = null;
    private _isMenuOpen: boolean = false;
    popupCtrl?: PopupController;

    constructor({ adapter, items, value, popupId }: ComboboxControllerProps<ItemT>) {
        this.adapter = adapter;
        this.items = items;
        this.popupId = popupId;
        if (typeof value === "string") {
            this._inputText = value;
        } else if (value) {
            this._selectedItem = adapter.findById(items, adapter.idOf(value)) || null;
            if (this._selectedItem) {
                this._inputText = adapter.valueOf(value);
            }
        }
        if (this._inputText) {
            this._filteredItems = this.adapter.filter(this.items, this._inputText);
        } else {
            this._filteredItems = this.items;
        }
    }

    withState(setState: (ctrl: ComboboxController<ItemT>) => void) {
        this.setState = setState;
        return this;
    }

    private clone() {
        const clone = new ComboboxController({ adapter: this.adapter, items: this.items, popupId: this.popupId });
        clone.setState = this.setState;
        clone.onSelect = this.onSelect;
        clone._inputText = this._inputText;
        clone._highlightedIndex = this._highlightedIndex;
        clone._selectedItem = this._selectedItem;
        clone._isMenuOpen = this._isMenuOpen;
        clone._filteredItems = this._filteredItems;
        clone.popupCtrl = this.popupCtrl;
        return clone;
    }

    private updateState() {
        this.setState?.(this.clone())
    }

    get filteredItems() {
        if (this._inputText) {
            return this.adapter.filter(this.items, this._inputText);
        } else {
            return this.items;
        }
    }
    get selectedItem() {
        return this._selectedItem;
    }

    set selectedItem(item: ItemT | null) {
        this._selectedItem = item;
        this._inputText = item ? this.adapter.valueOf(item) : "";
        this._filteredItems = this._inputText ?
            this.adapter.filter(this.items, this._inputText)
            : this.items;
        this.updateState();
        this.onSelect?.(item);
    }

    get isMenuOpen() {
        return this._isMenuOpen;
    }

    set inputText(inputText: string) {
        this._inputText = inputText;
        if (inputText) {
            this._filteredItems = this.adapter.filter(this.items, inputText);
        } else {
            this._filteredItems = this.items;
        }
        this._highlightedIndex = null;
        this._selectedItem = null;
        this.updateState();
        // TODO -- experimental - it works but it's not perfect
        // we need to update if the popup is on top and the filtered items changed
        if (this.isMenuOpen && this.popupCtrl) {
            const popupCtrl = this.popupCtrl;
            const popupPosition = popupCtrl.context?.position?.position;
            if (popupPosition && popupPosition === "top") {
                window.setTimeout(() => {
                    popupCtrl.update();
                }, 100);
            }
        }
    }

    get inputText() {
        return this._inputText;
    }

    set highlightedIndex(index: number | null) {
        this._highlightedIndex = index;
        this.updateState();
    }

    get highlightedIndex() {
        return this._highlightedIndex;
    }

    openMenu() {
        if (this._filteredItems.length > 0) {
            this._isMenuOpen = true;
            //this._highlightedIndex = 0;
            this.updateState();
        } else {
            // TODO nothing to show.
            // display a create value option?
        }
    }

    closeMenu(_item?: ItemT | null) {
        if (this._isMenuOpen) {
            this._highlightedIndex = null;
            this._isMenuOpen = false;
            this.updateState();
        }
    }

    toggleMenu() {
        if (this._isMenuOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    private highlightIndex(index: number, navigateToTop: boolean = false) {
        this.highlightedIndex = index;
        const popup = document.getElementById(this.popupId);
        if (popup) {
            popup.querySelector(`li[data-index="${index}"]`)?.scrollIntoView(navigateToTop);
        }
    }

    getMenuProps() {
        return {}
    }

    getToggleButtonProps() {
        return {
            onClick: () => {
                this._isMenuOpen = !this._isMenuOpen;
                this.updateState();
            }
        }
    }

    getItemProps(item: ItemT, index: number): React.HTMLProps<HTMLLIElement> {
        return {
            "aria-selected": this._highlightedIndex === index,
            onClick: () => {
                this.selectedItem = item;
                this.closeMenu();
            },
            onMouseEnter: () => {
                if (this.highlightedIndex !== index) {
                    this.highlightedIndex = index;
                }
            },
            onMouseLeave: () => {
                if (this.highlightedIndex === index) {
                    this.highlightedIndex = null;
                }
            }
        }
    }

    getInputProps() {
        const items = this._filteredItems;
        return {
            onClick: () => {
                this.openMenu();
            },
            onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
                const value = ev.target.value;
                this.inputText = value;
                this.openMenu();
            },
            value: this.inputText,
            onKeyDown: (ev: React.KeyboardEvent<HTMLInputElement>) => {
                const key = ev.key;
                if (key === "Enter") {
                    if (this.highlightedIndex != null) {
                        this.selectedItem = items[this.highlightedIndex || 0];
                    } else {
                        // create new value?
                        if (this.inputText) {
                            const item = this.adapter.createItem(this.inputText);
                            if (item) {
                                this.items.push(item);
                                this.selectedItem = item;
                            }
                        }
                    }
                    this.closeMenu();
                } else if (key === "ArrowDown") {
                    if (this.isMenuOpen) {
                        this.highlightIndex(this.highlightedIndex === null ? 0 : incrModulo(this.highlightedIndex, items.length), false);
                    } else {
                        this.openMenu();
                    }
                } else if (key === "ArrowUp") {
                    if (this.isMenuOpen) {
                        this.highlightIndex(this.highlightedIndex === null ? 0 : decrModulo(this.highlightedIndex, items.length), true);
                    }
                }
            }
        }
    }
}


function incrModulo(value: number, max: number) {
    return (value + 1) % max;
}
function decrModulo(value: number, max: number) {
    return (value - 1 + max) % max;
}