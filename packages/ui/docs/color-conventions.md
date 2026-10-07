# Color conventions

Use `bg-background text-foreground` for pages, `bg-card text-card-foreground` for cards,
and `bg-popover text-popover-foreground` for dialogs. Page and card surfaces are white in light
mode. Reserve `bg-muted` for subdued areas; muted text is `text-muted-foreground`.

Color names describe surfaces and `-foreground` names describe their text/icons. Status panels
pair `bg-success text-success-foreground` (likewise info, attention, destructive, and done).
Primary actions use `<Button>` with its default primary variant, which pairs a blue background
with `text-primary-foreground`. Avoid overriding button label colors.

All standard utilities use the named color token. `/50` changes opacity, never the selected token.
The CSS compiler contract is checked by `src/__tests__/theme.test.ts`; contrast is checked by
`src/__tests__/contrast.test.ts`. Verify rendered states in both themes as well.

See [the migration guide](../COLOR-MIGRATION.md) before updating an existing consumer to this theme.
