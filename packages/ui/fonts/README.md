# Bundled fonts

`../fonts.css` loads these files. Each folder holds one family and its licence (`OFL.txt`, SIL Open Font License 1.1).

| Folder | Family | Files |
| --- | --- | --- |
| `atkinson-hyperlegible-next/` | Atkinson Hyperlegible Next (variable weight, upright) | `latin.woff2`, `latin-ext.woff2` |
| `noto-sans-telugu/` | Noto Sans Telugu (variable weight) | `telugu.woff2` |
| `noto-sans-devanagari/` | Noto Sans Devanagari (variable weight) | `devanagari.woff2` |
| `noto-sans-arabic/` | Noto Sans Arabic (variable weight) | `arabic.woff2` |

Source: the woff2 subsets and `LICENSE` files of the npm packages `@fontsource-variable/atkinson-hyperlegible-next`, `@fontsource-variable/noto-sans-telugu`, `@fontsource-variable/noto-sans-devanagari` and `@fontsource-variable/noto-sans-arabic`, version 5.3.0, copied by hand (`npm pack`, not installed). The `unicode-range` values in `fonts.css` come from those packages' `wght.css`.

Only these subsets are kept, to keep the installer small (about 460 KB in total). Atkinson has no italic here because the design uses none. Chinese, Japanese and Korean use the computer's own fonts (see `--font-ui`).

To update: `npm pack @fontsource-variable/<name>@<version>` in a scratch folder, extract, copy the same `*-wght-normal.woff2` subsets and `LICENSE` over these files, and update the version above and the ranges in `fonts.css`.
