# Color token migration

The updated theme uses surface / foreground pairs consistently. Update consumer classes and CSS
alongside the shared theme. Keeping old text classes with the new theme will paint surface
colors as text. This is a styling compatibility change even though the React APIs are unchanged.

| Previous usage | New usage |
|----------------|-----------|
| `text-muted` | `text-muted-foreground` |
| `text-success` | `text-success-foreground` |
| `border-info` | `border-info-foreground` for a strong accent, `border-border` for a neutral border |
| `bg-success` | Unchanged: the pale/translucent success surface |
| `bg-success/50` | `bg-success-foreground/50` to preserve the old strong tint, or `bg-success/50` for a translucent surface |
| `var(--success)` used as an accent | `var(--success-foreground)` |
| `var(--success-background)` | `var(--success)` |
| `bg-primary text-white` | `bg-primary text-primary-foreground` (prefer the shared Button) |

The same migration applies to secondary, muted, attention, destructive, done, and info.
It also applies to SVG fill/stroke, ring, outline, decoration, shadow, and mixer utilities.
Existing standard background utilities with opacity previously used the stronger text token;
the repository migration names that foreground token explicitly to preserve their appearance.
Use the surface token for new translucent panels.

`--<name>-background` and `--color-<name>-background` remain compatibility aliases for those
seven surface tokens. They do not preserve the old meaning of `--<name>` as text.
These aliases are deprecated for new code. Keep them throughout this migration; removal
requires a separately announced breaking change after downstream consumers have migrated.
Primary remains blue; `--primary-foreground` is white in both modes. The old
`--primary-background` variable and `bg-primary-background` utility remain available as a legacy tint, not the
primary button surface. New buttons use `bg-primary text-primary-foreground`.

The generic `@utility bg-*` override is removed. Built-in background, text, border, and opacity
utilities all use the named token. `@theme static` emits every `--color-*` binding, including
ones used only by downstream CSS or inline styles. Utilities read these bindings, preserving
scoped `--color-*` overrides. Set global raw tokens on `:root` / `.dark` at the document root;
for a nested theme, override the corresponding `--color-*` bindings inside that scope.
Mixer utilities explicitly blend the named token with white/black;
standard `/50` is opacity, not a mixer percentage.

## Surface recipes

- Page: `bg-background text-foreground`.
- Card: `bg-card text-card-foreground border border-border`.
- Dialog: `bg-popover text-popover-foreground`.
- Subdued section: `bg-muted text-muted-foreground`.
- Status panel: `bg-info text-info-foreground` (or another status pair).
- Primary action: `<Button>Save</Button>`; secondary action: `<Button variant="outline">Cancel</Button>`.

Page and card surfaces are white in light mode. Dark pages and cards deliberately use distinct
near-black/dark-gray surfaces. Do not substitute hardcoded gray or black utility classes.

## Verification

Run the package's `test`, `typecheck:test`, `lint`, and `build` scripts, then build affected consumers.
The theme compiler tests check exposed token resolution, foreground utility generation, and
opacity behavior; contrast tests check canonical pairs in light and dark mode. Check rendered
pages/buttons in both modes, including hover, disabled, focus, and scoped `--color-*` overrides.
