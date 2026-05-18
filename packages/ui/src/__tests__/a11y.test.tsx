import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { useState } from 'react';
import { Button, CopyButton } from '../core/components/shadcn/button.js';
import { Input } from '../core/components/shadcn/input.js';
import { Label } from '../core/components/shadcn/label.js';
import { Checkbox } from '../core/components/shadcn/checkbox.js';
import { Switch } from '../core/components/shadcn/switch.js';
import { RadioGroup } from '../core/components/shadcn/radioGroup.js';
import { FormItem } from '../core/components/FormItem.js';
import { Modal, ModalTitle, ModalBody } from '../core/components/shadcn/modal/dialog.js';
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
        const { container } = renderWithProviders(
            <CopyButton content="example value" />,
        );
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
                <Input
                    id="a11y-test-invalid-input"
                    value="x"
                    onChange={() => undefined}
                    clearable={false}
                    invalid
                />
            </div>,
        );
        const input = container.querySelector('input');
        expect(input?.getAttribute('aria-invalid')).toBe('true');
        expect(await axe(container)).toHaveNoViolations();
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
                <Label htmlFor="a11y-test-tos" id="a11y-test-tos-label">I accept the terms</Label>
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
});
