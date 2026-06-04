import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { FormItem } from '../core/components/FormItem.js';
import { Button, CopyButton } from '../core/components/shadcn/button.js';
import { Checkbox } from '../core/components/shadcn/checkbox.js';
import { Input } from '../core/components/shadcn/input.js';
import { Label } from '../core/components/shadcn/label.js';
import { Modal, ModalBody, ModalTitle } from '../core/components/shadcn/modal/dialog.js';
import { RadioGroup } from '../core/components/shadcn/radioGroup.js';
import { SelectBox } from '../core/components/shadcn/selectBox.js';
import { Switch } from '../core/components/shadcn/switch.js';
import { SortableTableHeaderCell, Table, TableHeaderCell, TBody, THead } from '../core/components/table/index.js';
import { axe } from './axe-helper.js';
import { renderWithProviders } from './test-utils.js';

describe('@vertesia/ui accessibility (axe)', () => {
    it('Button (text + icon-only with aria-label) has no violations', async () => {
        const { container } = renderWithProviders(
            <div>
                <Button onClick={() => undefined}>Save</Button>
                <Button onClick={() => undefined} variant="ghost" aria-label="Close dialog">
                    <span aria-hidden="true">×</span>
                </Button>
            </div>,
        );
        expect(await axe(container)).toHaveNoViolations();
    });

    it('Button defaults to type="button" but does not inject type when asChild', async () => {
        const { container } = renderWithProviders(
            <div>
                <Button onClick={() => undefined}>Default</Button>
                <Button asChild>
                    <a href="#somewhere">Slotted link</a>
                </Button>
            </div>,
        );
        const buttons = container.querySelectorAll('button');
        expect(buttons.length).toBe(1);
        expect(buttons[0].getAttribute('type')).toBe('button');
        const anchor = container.querySelector('a');
        expect(anchor?.hasAttribute('type')).toBe(false);
    });

    it('Button.alt is forwarded to aria-label during deprecation window', async () => {
        const { container } = renderWithProviders(
            <Button onClick={() => undefined} alt="Save changes">
                <span aria-hidden="true">✓</span>
            </Button>,
        );
        const button = container.querySelector('button');
        expect(button?.getAttribute('aria-label')).toBe('Save changes');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('CopyButton has an accessible name via internal aria-label', async () => {
        const { container } = renderWithProviders(<CopyButton content="example value" />);
        const button = container.querySelector('button');
        expect(button?.getAttribute('aria-label')).toBeTruthy();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('Input wrapped in FormItem has a labelled control', async () => {
        const { container } = renderWithProviders(
            <FormItem label="Email" childrenId="a11y-test-email">
                <Input id="a11y-test-email" value="" onChange={() => undefined} clearable={false} />
            </FormItem>,
        );
        expect(await axe(container)).toHaveNoViolations();
    });

    it('Input with invalid prop sets aria-invalid', async () => {
        const { container } = renderWithProviders(
            <div>
                <Label htmlFor="a11y-test-invalid-input">Username</Label>
                <Input id="a11y-test-invalid-input" value="x" onChange={() => undefined} clearable={false} invalid />
            </div>,
        );
        const input = container.querySelector('input');
        expect(input?.getAttribute('aria-invalid')).toBe('true');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('FormItem wires helpText to its child via aria-describedby', async () => {
        const { container } = renderWithProviders(
            <FormItem label="Email" helpText="We will never share your email.">
                <Input value="" onChange={() => undefined} clearable={false} />
            </FormItem>,
        );
        const input = container.querySelector('input');
        const describedBy = input?.getAttribute('aria-describedby');
        expect(describedBy).toBeTruthy();
        const helpEl = describedBy ? document.getElementById(describedBy) : null;
        expect(helpEl?.textContent).toBe('We will never share your email.');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('FormItem wires error to its child via aria-describedby + aria-invalid', async () => {
        const { container } = renderWithProviders(
            <FormItem label="Email" error="Must be a valid email address.">
                <Input value="not-an-email" onChange={() => undefined} clearable={false} />
            </FormItem>,
        );
        const input = container.querySelector('input');
        expect(input?.getAttribute('aria-invalid')).toBe('true');
        const describedBy = input?.getAttribute('aria-describedby');
        expect(describedBy).toBeTruthy();
        const errEl = describedBy ? document.getElementById(describedBy) : null;
        expect(errEl?.textContent).toBe('Must be a valid email address.');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('FormItem concatenates helpText + error ids into aria-describedby', async () => {
        const { container } = renderWithProviders(
            <FormItem label="Password" helpText="At least 12 characters." error="Too short.">
                <Input value="x" onChange={() => undefined} clearable={false} />
            </FormItem>,
        );
        const input = container.querySelector('input');
        const describedBy = input?.getAttribute('aria-describedby');
        expect(describedBy?.split(' ').length).toBe(2);
    });

    it('FormItem composes with SelectBox (auto-wires id + aria-describedby + aria-invalid on the trigger)', async () => {
        function Harness() {
            const [val, setVal] = useState<string | undefined>(undefined);
            return (
                <FormItem label="Country" helpText="Pick where you live." error="Required.">
                    <SelectBox options={['France', 'Germany', 'Spain']} value={val} onChange={setVal} />
                </FormItem>
            );
        }
        const { container } = renderWithProviders(<Harness />);
        const trigger = container.querySelector('button[aria-haspopup="dialog"]');
        expect(trigger).toBeTruthy();
        // FormItem clones SelectBox and passes id; SelectBox forwards it to the trigger.
        expect(trigger?.getAttribute('id')).toBeTruthy();
        // The visible <label htmlFor=…> in FormItem points at the trigger's id.
        const labelHtmlFor = container.querySelector('label')?.getAttribute('for');
        expect(labelHtmlFor).toBe(trigger?.getAttribute('id'));
        // aria-describedby on the trigger contains the helpText + error ids.
        const describedBy = trigger?.getAttribute('aria-describedby');
        expect(describedBy).toBeTruthy();
        expect(describedBy?.split(' ').length).toBe(2);
        // Error sets aria-invalid="true" on the trigger.
        expect(trigger?.getAttribute('aria-invalid')).toBe('true');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('FormItem does NOT set htmlFor when the child cannot be wired and no childrenId is given', async () => {
        // Two children: auto-wiring is skipped (warned in dev). The label must not
        // claim to control anything — htmlFor would point at an id no element owns.
        const { container } = renderWithProviders(
            <FormItem label="Custom">
                <Input value="" onChange={() => undefined} clearable={false} />
                <span>extra</span>
            </FormItem>,
        );
        const label = container.querySelector('label');
        expect(label?.hasAttribute('for')).toBe(false);
    });

    it('FormItem does NOT auto-wire a Fragment child (Fragment ignores cloned props)', async () => {
        const { container } = renderWithProviders(
            <FormItem label="Fragment example">
                {/* biome-ignore lint/complexity/noUselessFragments: this is the SUT — the test verifies FormItem short-circuits when the child is a Fragment. */}
                <>
                    <Input value="" onChange={() => undefined} clearable={false} />
                </>
            </FormItem>,
        );
        const label = container.querySelector('label');
        // The fragment short-circuits wiring; htmlFor must not be set.
        expect(label?.hasAttribute('for')).toBe(false);
        // The input inside the fragment must not have received an injected id.
        const input = container.querySelector('input');
        expect(input?.id ?? '').toBe('');
    });

    it('Label paired with Input (htmlFor) has no violations', async () => {
        const { container } = renderWithProviders(
            <div>
                <Label htmlFor="a11y-test-name">Full name</Label>
                <Input id="a11y-test-name" value="" onChange={() => undefined} clearable={false} />
            </div>,
        );
        expect(await axe(container)).toHaveNoViolations();
    });

    it('Checkbox with Label (aria-labelledby) has no violations', async () => {
        const { container } = renderWithProviders(
            <div className="flex items-center gap-2">
                <Checkbox id="a11y-test-tos" aria-labelledby="a11y-test-tos-label" />
                <Label htmlFor="a11y-test-tos" id="a11y-test-tos-label">
                    I accept the terms
                </Label>
            </div>,
        );
        expect(await axe(container)).toHaveNoViolations();
    });

    it('Switch with aria-labelledby pointing to a Label has no violations', async () => {
        function Harness() {
            const [value, setValue] = useState(false);
            return (
                <div className="flex items-center gap-2">
                    <Switch
                        id="a11y-test-notifications"
                        aria-labelledby="a11y-test-notifications-label"
                        value={value}
                        onChange={setValue}
                    />
                    <Label htmlFor="a11y-test-notifications" id="a11y-test-notifications-label">
                        Enable notifications
                    </Label>
                </div>
            );
        }
        const { container } = renderWithProviders(<Harness />);
        expect(await axe(container)).toHaveNoViolations();
    });

    it('RadioGroup with options has no violations', async () => {
        function Harness() {
            const options = [
                { id: 'small', label: 'Small' },
                { id: 'medium', label: 'Medium' },
                { id: 'large', label: 'Large' },
            ];
            const [selected, setSelected] = useState(options[0]);
            return <RadioGroup options={options} selected={selected} onSelect={setSelected} />;
        }
        const { container } = renderWithProviders(<Harness />);
        expect(await axe(container)).toHaveNoViolations();
    });

    it('Modal (open, no close button) has no violations on document.body', async () => {
        function Harness() {
            const [open] = useState(true);
            return (
                <Modal isOpen={open} onClose={() => undefined} noCloseButton>
                    <ModalTitle>Confirm delete</ModalTitle>
                    <ModalBody>Are you sure you want to delete this item? This action cannot be undone.</ModalBody>
                </Modal>
            );
        }
        const { baseElement } = renderWithProviders(<Harness />);
        // Radix portals the dialog into document.body, not the render container.
        // noCloseButton avoids the Button.alt -> aria-label gap (deferred to Section 3).
        expect(await axe(baseElement)).toHaveNoViolations();
    });

    it('Table with column headers and sortable button has no violations', async () => {
        const { container } = renderWithProviders(
            <table>
                <thead>
                    <tr>
                        <th scope="col" aria-sort="ascending">
                            <button type="button">Name</button>
                        </th>
                        <th scope="col">Email</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Ada Lovelace</td>
                        <td>ada@example.com</td>
                    </tr>
                </tbody>
            </table>,
        );
        expect(await axe(container)).toHaveNoViolations();
    });

    it('TableHeaderCell defaults to scope="col"', async () => {
        const { container } = renderWithProviders(
            <Table>
                <THead>
                    <tr>
                        <TableHeaderCell>Name</TableHeaderCell>
                        <TableHeaderCell scope="col">Email</TableHeaderCell>
                    </tr>
                </THead>
                <TBody columns={2}>
                    <tr>
                        <td>Ada</td>
                        <td>ada@example.com</td>
                    </tr>
                </TBody>
            </Table>,
        );
        const headers = container.querySelectorAll('th');
        expect(headers.length).toBe(2);
        expect(headers[0].getAttribute('scope')).toBe('col');
        expect(headers[1].getAttribute('scope')).toBe('col');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('SelectBox trigger is a button with aria-haspopup="dialog" and aria-expanded', async () => {
        function Harness() {
            const [val, setVal] = useState<string | undefined>(undefined);
            return (
                <SelectBox
                    label="Country"
                    options={['France', 'Germany', 'Spain']}
                    value={val}
                    onChange={setVal}
                    placeholder="Select a country"
                />
            );
        }
        const { container } = renderWithProviders(<Harness />);
        const trigger = container.querySelector('button');
        expect(trigger?.getAttribute('type')).toBe('button');
        expect(trigger?.getAttribute('aria-haspopup')).toBe('dialog');
        expect(trigger?.getAttribute('aria-expanded')).toBe('false');
        expect(trigger?.getAttribute('aria-controls')).toBeTruthy();
        // When `label` is set, the trigger gets aria-labelledby pointing at the visual label.
        expect(trigger?.getAttribute('aria-labelledby')).toBeTruthy();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('SelectBox with explicit aria-label (no visual label) has no violations', async () => {
        function Harness() {
            const [val, setVal] = useState<string | undefined>(undefined);
            return (
                <SelectBox
                    aria-label="Country picker"
                    options={['France', 'Germany']}
                    value={val}
                    onChange={setVal}
                    placeholder="Pick one"
                />
            );
        }
        const { container } = renderWithProviders(<Harness />);
        const trigger = container.querySelector('button');
        expect(trigger?.getAttribute('aria-label')).toBe('Country picker');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('SelectBox clear button is a sibling of the trigger (no nested buttons)', async () => {
        function Harness() {
            const [val, setVal] = useState<string | undefined>('France');
            return (
                <SelectBox
                    aria-label="Country"
                    options={['France', 'Germany']}
                    value={val}
                    onChange={setVal}
                    isClearable
                />
            );
        }
        const { container } = renderWithProviders(<Harness />);
        // Two buttons in the trigger area: the trigger itself and the clear control.
        const buttons = container.querySelectorAll('button');
        expect(buttons.length).toBe(2);
        // Crucially, neither button is nested inside the other.
        for (const b of buttons) {
            expect(b.querySelector('button')).toBeNull();
        }
        expect(await axe(container)).toHaveNoViolations();
    });

    it('SortableTableHeaderCell renders a button and sets aria-sort on the <th>', async () => {
        function Harness() {
            const [dir, setDir] = useState<'ascending' | 'descending'>('ascending');
            return (
                <Table>
                    <THead>
                        <tr>
                            <SortableTableHeaderCell
                                sortDirection={dir}
                                onSort={() => setDir((d) => (d === 'ascending' ? 'descending' : 'ascending'))}
                            >
                                Name
                            </SortableTableHeaderCell>
                        </tr>
                    </THead>
                    <TBody columns={1}>
                        <tr>
                            <td>Ada</td>
                        </tr>
                    </TBody>
                </Table>
            );
        }
        const { container } = renderWithProviders(<Harness />);
        const th = container.querySelector('th');
        expect(th?.getAttribute('aria-sort')).toBe('ascending');
        expect(th?.getAttribute('scope')).toBe('col');
        const btn = th?.querySelector('button');
        expect(btn?.getAttribute('type')).toBe('button');
        expect(btn?.textContent).toContain('Name');
        expect(await axe(container)).toHaveNoViolations();
    });
});
