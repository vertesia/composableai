import { Badge } from '@vertesia/ui/core';
import { NavLink } from '@vertesia/ui/router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ResourceType } from '../types.js';
import { TYPE_VARIANTS } from './typeVariants.js';

interface DetailPageProps {
    type: ResourceType;
    title: string;
    description?: string;
    tags?: string[];
    backHref?: string;
    children?: ReactNode;
}

export function DetailPage({ type, title, description, tags, backHref = '/', children }: DetailPageProps) {
    return (
        <div className="mx-auto max-w-5xl px-7 py-10">
            <nav className="mb-5 flex items-center gap-4">
                {backHref !== '/' && (
                    <NavLink href="/" className="text-sm text-primary hover:opacity-75">Home</NavLink>
                )}
                <NavLink href={backHref} className="flex items-center gap-1 text-sm text-primary hover:opacity-75">
                    <ArrowLeft className="size-3.5" />
                    Back
                </NavLink>
            </nav>

            <div className="mb-8">
                <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${TYPE_VARIANTS[type] ?? ''}`}>
                    {type}
                </span>
                <h1 className="-tracking-wide text-3xl font-bold text-foreground">{title}</h1>
                {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
                {tags && tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {tags.map(tag => (
                            <Badge key={tag} variant="default">{tag}</Badge>
                        ))}
                    </div>
                )}
            </div>

            {children}
        </div>
    );
}
