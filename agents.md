## Agents Guide: Project Structure and Build Flow

This repository composes shared Markdown sections into multiple role‑specific resumes using Handlebars, then outputs plain Markdown you can paste into the Markdown Resume UI for PDF export. The UI referenced is "Markdown Resume" by Junian, which provides live preview and PDF export capabilities (see References at the end).

### High-level Workflow
- Read base resume sections from `content/base/*.md`.
- Optionally append per‑variant deltas from `content/variants/<variant>/*.md` (currently for `summary.md` and `skills.md` only).
- Register the composed sections as Handlebars partials.
- For each template in `variants/*.md.hbs`, compile with context:
  - `data/personal.json` (all fields are available to templates)
  - `variant` (current variant key, e.g., `"engineering-manager"`)
- Write outputs to `dist/*.md` and copy `sample/css.css` to `dist/css.css` (if present).

---

### Repository Layout
- `content/base/`
  - Authoritative shared sections for all variants. Sections are discovered dynamically from all `*.md` filenames in this folder. The section key equals the filename without extension (e.g., `education-awards-publications.md` -> `education-awards-publications`).
- `content/variants/<variant>/`
  - Optional per‑variant overrides for any section, named exactly as the base filename (e.g., `summary.md`, `skills.md`, `header.md`, etc.).
- `variants/*.md.hbs`
  - Handlebars templates per variant (e.g., `engineering-manager.md.hbs`).
  - These templates include the registered partials directly (e.g., `{{> summary}}`).
- `data/personal.json`
  - Arbitrary JSON data merged into the render context and usable in templates via `{{...}}`.
- `scripts/build.ts`
  - Node + TypeScript builder that orchestrates composition and compilation.
- `sample/css.css`
  - Example CSS you can load in the Markdown Resume UI for styling; copied to `dist/css.css`.
- `dist/`
  - Build outputs: one Markdown file per variant + CSS copy.

---

### How Templates and Partials Work
Build steps handled in `scripts/build.ts`:
1. Discover all sections from `content/base/*.md` and read them into memory.
2. For each base section, register a base alias partial named `base_<sectionName>` where dashes are replaced by underscores (e.g., `education-awards-publications` -> `base_education_awards_publications`).
3. For each section, if a corresponding override exists at `content/variants/<variant>/<sectionName>.md`:
   - If the override contains `{{> base_<sectionName>}}`, inline the base exactly where referenced.
   - Otherwise, default behavior is base content followed by the override (append).
   - Overrides are compiled as templates with the same context and helpers.
4. Register each computed section (after override processing) as a Handlebars partial named exactly by its section key (e.g., `summary`, `skills`, `header`, `education-awards-publications`).
5. Compile each template in `variants/*.md.hbs` with context `{ ...personalData, variant }`.
6. Write Markdown outputs to `dist/` and copy CSS.

Example minimal template (`variants/<variant>.md.hbs`):

```hbs
{{> header}}

## Summary
{{> summary}}

## Experience
{{> experience}}

## Skills
{{> skills}}

## Education, Awards & Publications
{{> education-awards-publications}}
```

You can also interpolate values from `data/personal.json`, e.g.:

```hbs
{{! inside any template or included section }}
Name: {{name}}
Email: {{email}}
```

---

### Conditional Content with Helpers
The builder registers a small set of helpers:
- `eq`, `ne` for equality/inequality checks
- `and`, `or` for boolean composition

The current variant key is available as `variant`. You can use helpers inside any section (including base files) to render conditional bullets:

```hbs
{{#if (eq variant "engineering-manager")}}
- Drove hiring plan across 3 teams; improved delivery predictability by 25%.
{{/if}}
```

Tip: Prefer shared bullets in base files and sprinkle conditional bullets only where a role truly needs bespoke emphasis. For longer role‑specific content, use the append files in `content/variants/<variant>/`.

---

### Sub-templates in Variant Overrides (Inline Base Inclusion)
Variant overrides (`content/variants/<variant>/summary.md` and `skills.md`) can behave like small templates. If you want to include the base section inline (not only append after base), use the provided base aliases:

- `{{> base_summary}}` for the base Summary
- `{{> base_skills}}` for the base Skills

Example `content/variants/senior-engineer/summary.md`:

```hbs
I’m a pragmatic engineer because:

{{> base_summary}}

Therefore, I can deliver business impact quickly and safely.
```

Behavior:
- If your override includes `{{> base_summary}}` (or `{{> base_skills}}`), the base section is inserted exactly where the tag appears.
- If your override does NOT include the alias tag, the builder falls back to the previous behavior: base content followed by your override (append).
- Overrides are compiled with the same context and helpers as the main templates, so you can also use `{{variant}}`, `{{name}}` from `data/personal.json`, and helpers like `eq`, `and`, etc.

Note: The inline base alias names replace dashes with underscores. If you later add new sections, their base alias will be `base_<sectionNameWithDashesReplacedByUnderscores>`.

---

### Template-level Flags (per-variant)
You can set per-template flags at the top of any `variants/*.md.hbs` file using a JSON comment:

```hbs
{{!-- flags: {"exclude_latest_experience": true} --}}
```

These flags are parsed and merged into the render context. They are available everywhere (templates, base sections, overrides) and can be used with helpers:

```hbs
{{#unless exclude_latest_experience}}
- Latest role ...
{{/unless}}
```

Example: `variants/csod.md.hbs` copies `senior-engineer.md.hbs` and sets `exclude_latest_experience` to `true` to hide the newest position while keeping everything else identical.

Notes:
- Flags must be valid JSON.
- The flags comment must be at the very top of the file.
- Flags merge into context alongside `data/personal.json` and `variant`.

---

### Add a New Variant
1. Create optional per‑variant deltas:
   - `content/variants/<new-variant>/summary.md`
   - `content/variants/<new-variant>/skills.md`
2. Create a template:
   - `variants/<new-variant>.md.hbs` that includes the standard partials you need (see example above).
3. Build:
   - `npm run build`
4. Find the output:
   - `dist/<new-variant>.md`

You can omit either or both per‑variant files—if not present, only base content is used.

---

### Add a New Section (Advanced)
If you want an additional shared section (e.g., `projects`):
1. Add a base file: `content/base/projects.md`.
2. Update `scripts/build.ts`:
   - Extend the `SectionName` union to include `"projects"`.
   - Add the file path to the `files` map in `loadBaseSections`.
   - Optionally add an append behavior in `registerVariantPartials` (patterned after `summary`/`skills`).
3. Use the new partial in your templates:
   - `{{> projects}}`

---

### Build and Usage
Install dependencies:

```bash
npm install
```

If needed (standalone usage):

```bash
npm i -D typescript ts-node @types/node
npm i handlebars fast-glob
```

Build all variants:

```bash
npm run build
```

Outputs:
- `dist/engineering-manager.md`
- `dist/staff-engineer.md`
- `dist/senior-engineer.md`
- `dist/css.css` (copy of `sample/css.css` if present)

Export to PDF:
1. Open the Markdown Resume UI.
2. Paste a generated `.md` file into the editor.
3. Optionally import `dist/css.css` for consistent styling.
4. Export to A4/US Letter PDF from the UI.

---

### Troubleshooting
- Error: `Missing base section file: ...`
  - Ensure all required base files exist in `content/base/`.
- Error: `No variant templates found in variants/*.md.hbs`
  - Ensure at least one template file exists in `variants/`.
- Variant append not applied
  - Only `summary.md` and `skills.md` are appended by default; add content to those paths or extend the builder for more sections.

---

### Authoring Tips
- Keep bullets crisp and quantified; avoid long paragraphs.
- Use shared base content for 80–90% of material to minimize duplication.
- Use per‑variant append files for role‑specific emphasis and keywords.
- Prefer conditional helpers sparingly in base files when a small toggle suffices.
- For the UI:
  - You can use `\newpage` to start a new page and `\\[10px]` to insert line breaks, supported by the Markdown Resume UI.

---

### References
- Markdown Resume repository (for the UI you paste into): [GitHub](https://github.com/junian/markdown-resume)
- Live UI for preview and PDF export: [junian.dev/markdown-resume](https://www.junian.dev/markdown-resume/)


