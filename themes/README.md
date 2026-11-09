# Toolkitty theme packs

A theme sets the colors of the aurora backdrop, the footer and accent of the turn
receipt, and the frame and accent of the buddy.

The four files here (`classic`, `sunset`, `matrix`, `pastel`) are the built-in
themes, written out as JSON so you can copy one and edit it.

## Add your own

1. Copy one of these files.
2. Give it a new `id` (letters, digits, `-` or `_`) and a `name`.
3. Drop it in `~/.claude/toolkitty-themes/` (on Windows: `%USERPROFILE%\.claude\toolkitty-themes\`).
4. Run `/themes` to list the themes and `/themes <id>` to pick one.

A file whose `id` matches a built-in theme replaces it.

## Fields

- `aurora.idle`, `aurora.working`, `aurora.warn`, `aurora.danger`: three `#rrggbb` colors each, the blobs of the backdrop.
- `receipt.accent`: `#rrggbb`, the receipt's asterisk mark and title.
- `receipt.footer`: the line printed at the bottom of the receipt; `""` keeps the default "THANK YOU FOR VIBING".
- `buddy.frame`: `#rrggbb` for the card frame of common to rare buddies; `""` keeps the rarity color. Epic and legendary buddies always keep their rarity color.
- `buddy.accent`: `#rrggbb`, the scarf and the streak charm.

Colors must be six-digit hex; a file that breaks this is ignored.
