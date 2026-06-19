import type { AnyExtension } from '@tiptap/core';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

/**
 * Single source of truth for which markdown constructs the collaborative document
 * editor supports.
 *
 * The editor schema AND the markdown serializer share this exact extension set. Any
 * construct whose node/mark is not registered here is silently dropped when content is
 * serialized back to markdown — e.g. a GFM table with no TableKit serializes to an
 * empty string. The Phase 0 spike validated that the canonical markdown form produced
 * by this set is idempotent for headings, inline marks, nested/ordered lists, code
 * fences, blockquotes, links, horizontal rules, long wrapped prose, GFM tables and task
 * lists (see markdownRoundtrip.test.ts).
 *
 * Lossless-preservation principle: before adding a construct that agents may emit but
 * that isn't covered here (math/KaTeX, custom directives, footnotes), register a node
 * for it — even a passthrough/raw node — so editing the document never destroys content
 * the agent produced.
 */
export const richTextExtensions: AnyExtension[] = [StarterKit, Markdown, TableKit, TaskList, TaskItem];
