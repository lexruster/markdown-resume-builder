## Multi-variant Markdown Resume (Composable)

This small Node + TypeScript tool composes shared Markdown partials into three role-specific resumes (Engineering Manager, Staff Engineer, Senior Engineer) with minimal duplication. It outputs plain Markdown that you can paste into the Markdown Resume UI and export PDFs.

- Built for Windows 11 and cross-platform.
- Uses Handlebars partials for reuse and simple helpers for conditional content if needed.
- Produces `dist/*.md` files and copies `sample/css.css` to `dist/css.css` for convenience.

### References
- Project used for UI/PDF export: `junian/markdown-resume` ([GitHub](https://github.com/junian/markdown-resume), [Live UI](https://www.junian.dev/markdown-resume/))

### Project Structure
- `data/personal.json`: basic person/contact data
- `content/Base/*.md`: base sections shared by all variants
  - `header.md`, `summary.md`, `experience.md`, `skills.md`, `education-awards-publications.md`
- `content/variants/<variant>/*.md`: per-variant overrides (delta appended after base)
  - For now: `summary.md`, `skills.md`
- `variants/*.md.hbs`: role templates that include generic sections (`{{> summary}}`, `{{> skills}}`, etc.)
- `scripts/build.ts`: builder that composes base + overrides for each variant, then compiles to Markdown
- `dist/`: compiled Markdown outputs

### Install

```bash
npm install
```

If you cloned just this folder into an existing repo without `node_modules`, install dev/runtime deps:

```bash
npm i -D typescript ts-node @types/node
npm i handlebars fast-glob
```

### Build

```bash
npm run build
```

Outputs:
- `dist/engineering-manager.md`
- `dist/staff-engineer.md`
- `dist/senior-engineer.md`
- `dist/css.css` (copy of `sample/css.css` for UI styling)

Paste a generated `.md` into the Markdown Resume UI ([link](https://www.junian.dev/markdown-resume/)) and export your PDF.

### Customization Tips
- Put shared content in `content/Base/*`.
- Place per-variant additions in `content/variants/<variant>/summary.md` and `skills.md`. They will be appended after the corresponding base section.
- If you prefer conditional bullets instead of appended overrides, you can also use helpers within base files:
  ```hbs
  {{#if (eq variant "engineering-manager")}}
  - Drove hiring plan across 3 teams and improved delivery predictability by 25%.
  {{/if}}
  ```
- Add a new variant by adding a subfolder under `content/variants/<new-variant>/` and a template `variants/<new-variant>.md.hbs`.


