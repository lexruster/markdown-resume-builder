## Multi-variant Markdown Resume (Composable)

This small Node + TypeScript tool composes shared Markdown partials into three role-specific resumes (Engineering Manager, Staff Engineer, Senior Engineer) with minimal duplication. It outputs plain Markdown that you can paste into the Markdown Resume UI and export PDFs.

- Built for Windows 11 and cross-platform.
- Uses Handlebars partials for reuse and simple helpers for conditional content if needed.
- Produces `dist/*.md` files and copies `sample/css.css` to `dist/css.css` for convenience.

### References
- Project used for UI/PDF export: `junian/markdown-resume` ([GitHub](https://github.com/junian/markdown-resume), [Live UI](https://www.junian.dev/markdown-resume/))
Also https://ohmycv.app/ can be used, that have better styling.

### Project Structure
- `cvs/<profile>/personal.json`: per-profile person/contact data (e.g., `cvs/sample/personal.json`, `cvs/alex/personal.json`)
- `cvs/<profile>/base/*.md`: base sections for a profile
  - `header.md`, `summary.md`, `experience.md`, `skills.md`, `education-awards-publications.md`, etc.
- `cvs/<profile>/override/<variant>/*.md`: per-variant overrides for that profile (optional)
  - Commonly `summary.md`, `skills.md`
- `variants/*.md.hbs`: global templates (shared across profiles)
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
npm run build -- --profile sample   # uses cvs/sample/personal.json and cvs/sample/*
npm run build -- --profile alex     # uses cvs/alex/personal.json and cvs/alex/*
```

Outputs:
- `dist/<variant>.md` for each template in `variants/*.md.hbs`
- `dist/css.css` (copy of `sample/css.css` for UI styling)

Paste a generated `.md` into the Markdown Resume UI ([link](https://www.junian.dev/markdown-resume/)) and export your PDF.

### Customization Tips
- Put shared content in `cvs/<profile>/base/*`.
- Place per-variant additions in `cvs/<profile>/override/<variant>/summary.md` and `skills.md`. They will be appended after the corresponding base section (or inline if you use the `{{> base_*}}` alias).
- If you prefer conditional bullets instead of appended overrides, you can also use helpers within base files:
  ```hbs
  {{#if (eq variant "engineering-manager")}}
  - Drove hiring plan across 3 teams and improved delivery predictability by 25%.
  {{/if}}
  ```
- Add a new variant by adding a template `variants/<new-variant>.md.hbs` and (optionally) overrides in `cvs/<profile>/override/<new-variant>/`.


