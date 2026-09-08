import { cleanup, render, screen } from '@testing-library/react';
import { InteractionStatus } from '@vertesia/common';
import { afterEach, describe, expect, it } from 'vitest';
import {
    InteractionLabel,
    isUnresolvedInteractionRef,
    resolveInteractionName,
    splitInteractionType,
} from './interaction.js';

describe('splitInteractionType', () => {
    it('splits a known namespace off the name', () => {
        expect(splitInteractionType('sys:code_agent')).toEqual({ type: 'sys', label: 'code_agent' });
    });

    it('keeps colons that are part of the name', () => {
        expect(splitInteractionType('nfwf-chatbot:main:rag-agent')).toEqual({ label: 'nfwf-chatbot:main:rag-agent' });
        expect(splitInteractionType('WhatColor')).toEqual({ label: 'WhatColor' });
    });
});

describe('resolveInteractionName', () => {
    it('prefers the resolved ref name over the run snapshot', () => {
        const name = resolveInteractionName({ name: 'Current Name' }, 'Stale Name', '682a822c4dbfdc27017ff6cd');
        expect(name).toBe('Current Name');
    });

    it('falls back when the ref name is the bare ObjectId the resolver left behind', () => {
        const name = resolveInteractionName({ name: '682a822c4dbfdc27017ff6cd' }, 'Legacy Name');
        expect(name).toBe('Legacy Name');
    });

    it('skips empty fallbacks and returns undefined when nothing is usable', () => {
        expect(resolveInteractionName(undefined, '', 'ref-string')).toBe('ref-string');
        expect(resolveInteractionName(undefined, undefined, '')).toBeUndefined();
    });

    it('names a deleted interaction from its id, from either the ref or a bare bucket id', () => {
        // The run row has the ref the server left behind; the facet bucket has only its `_id`.
        // Both must produce the same label or the option stops matching the row it filters for.
        const fromRow = resolveInteractionName({ name: '682a822c4dbfdc27017ff6cd' });
        const fromBucket = resolveInteractionName(undefined, '682a822c4dbfdc27017ff6cd');
        expect(fromRow).toBe('Deleted interaction (~017ff6cd)');
        expect(fromBucket).toBe(fromRow);
    });
});

describe('isUnresolvedInteractionRef', () => {
    it('flags only refs with neither a version nor a status', () => {
        expect(isUnresolvedInteractionRef({ version: 0, status: InteractionStatus.unknown })).toBe(true);
        expect(isUnresolvedInteractionRef({ version: 0, status: InteractionStatus.code })).toBe(false);
        expect(isUnresolvedInteractionRef({ version: 2, status: InteractionStatus.unknown })).toBe(false);
        expect(isUnresolvedInteractionRef(undefined)).toBe(false);
    });
});

describe('InteractionLabel', () => {
    afterEach(cleanup);

    it('lifts the namespace out of the name and badges the version and status', () => {
        render(
            <InteractionLabel interaction={{ name: 'sys:code_agent', version: 3, status: InteractionStatus.code }} />,
        );
        expect(screen.getByText('code_agent')).toBeTruthy();
        expect(screen.getByText('sys')).toBeTruthy();
        expect(screen.getByText('v3 code')).toBeTruthy();
    });

    it('badges nothing for a ref the server could not resolve', () => {
        const { container } = render(
            <InteractionLabel
                interaction={{ name: '682a822c4dbfdc27017ff6cd', version: 0, status: InteractionStatus.unknown }}
                fallbacks={['Legacy Name']}
            />,
        );
        expect(container.textContent).toBe('Legacy Name');
    });

    it('renders the fallback node only when there is no reference at all', () => {
        render(<InteractionLabel fallbackNode={<span>Interaction not found</span>} />);
        expect(screen.getByText('Interaction not found')).toBeTruthy();
    });

    it('names a deleted interaction rather than falling through to the fallback node', () => {
        const { container } = render(
            <InteractionLabel
                interaction={{ name: '682a822c4dbfdc27017ff6cd', version: 0, status: InteractionStatus.unknown }}
                fallbackNode={<span>Interaction not found</span>}
            />,
        );
        expect(container.textContent).toBe('Deleted interaction (~017ff6cd)');
    });
});
