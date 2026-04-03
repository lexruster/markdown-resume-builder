## Multi-variant Markdown Resume (Composable)

This small Node + TypeScript tool composes shared Markdown partials into three role-specific resumes (Engineering Manager, Staff Engineer, Senior Engineer) with minimal duplication. It outputs plain Markdown that you can paste into the Markdown Resume UI and export PDFs.

- Built for Windows 11 and cross-platform.
- Uses Handlebars partials for reuse and simple helpers for conditional content if needed.
- Produces `dist/*.md` (default build) or `dist/<profile>/*.md` when you pass `--profile <profile>` or set `PROFILE`; copies `sample/css.css` into the same output folder.

### References
- Project used for UI/PDF export: `junian/markdown-resume` ([GitHub](https://github.com/junian/markdown-resume), [Live UI](https://www.junian.dev/markdown-resume/))
Also https://ohmycv.app/ can be used, that have better styling.

### Project Structure
- `cvs/<profile>/personal.json`: per-profile person/contact data (e.g., `cvs/sample/personal.json`, `cvs/alex/personal.json`)
- `cvs/<profile>/base/*.md`: base sections for a profile
  - `header.md`, `summary.md`, `experience.md`, `skills.md`, `education-awards-publications.md`, etc.
- `cvs/<profile>/override/<variant>/*.md`: per-variant overrides for that profile (optional)
  - Commonly `summary.md`, `skills.md`
- `variants/<profile>/*.md.hbs`: per-profile variant templates (each profile has its own set of variants)
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
- `dist/<variant>.md` for each template in `variants/<profile>/*.md.hbs` when using the default build; `dist/<profile>/<variant>.md` when the profile is set explicitly (`--profile` or `PROFILE`).
- `css.css` in the same folder as those `.md` files (copy of `sample/css.css` for UI styling)

Paste a generated `.md` into the Markdown Resume UI ([link](https://www.junian.dev/markdown-resume/)) and export your PDF.
Suggestion - choose blue theme

### Customization Tips
- Put shared content in `cvs/<profile>/base/*`.
- Place per-variant overrides in `cvs/<profile>/override/<variant>/`. An override **replaces** the base section entirely. Use `{{> base_*}}` inside the override to inline the base content where needed.
- If you prefer conditional bullets instead of appended overrides, you can also use helpers within base files:
  ```hbs
  {{#if (eq variant "engineering-manager")}}
  - Drove hiring plan across 3 teams and improved delivery predictability by 25%.
  {{/if}}
  ```
- Add a new variant by adding a template `variants/<profile>/<new-variant>.md.hbs` and (optionally) overrides in `cvs/<profile>/override/<new-variant>/`.


### Short Explanation
`/cvs/<profile>/override` folder have subfolders per variant. 
`/variants/<profile>` have variant templates per profile.
When CV is built, builder will take variant name and use override folder with the same name