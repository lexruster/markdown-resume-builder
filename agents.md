## Agents Guide: Project Structure and Build Flow

This repository composes shared Markdown sections into multiple role‑specific resumes using Handlebars, then outputs plain Markdown you can paste into the Markdown Resume UI for PDF export. The UI referenced is "Markdown Resume" by Junian, which provides live preview and PDF export capabilities (see References at the end).

### High-level Workflow
- Read base resume sections from `cvs/<profile>/base/*.md`.
- Optionally apply per‑variant overrides from `cvs/<profile>/override/<variant>/*.md`.
- Register the composed sections as Handlebars partials.
- For each template in `variants/<profile>/*.md.hbs`, compile with context:
  - `cvs/<profile>/personal.json` (all fields are available to templates)
  - per-template flags (parsed from the template header)
  - `variant` (current variant key, e.g., `"engineering-manager"`)
- Write outputs under `dist/` (see **Output paths** below) and copy `sample/css.css` alongside the Markdown files (if present).

---

### Repository Layout
- `cvs/<profile>/base/`
  - Authoritative shared sections for all variants of a profile. Sections are discovered dynamically from all `*.md` filenames in this folder. The section key equals the filename without extension (e.g., `education-awards-publications.md` -> `education-awards-publications`).
- `cvs/<profile>/override/<variant>/`
  - Optional per‑variant overrides for any section, named exactly as the base filename (e.g., `summary.md`, `skills.md`, `experience.md`, etc.). Overrides replace the base section entirely.
- `variants/<profile>/*.md.hbs`
  - Per-profile Handlebars templates per variant (e.g., `variants/alex/engineering-manager.md.hbs`).
  - Each profile can have a different set of variants.
  - These templates include the registered partials directly (e.g., `{{> summary}}`).
- `cvs/<profile>/personal.json`
  - Per-profile JSON data merged into the render context and usable in templates via `{{...}}`.
- `scripts/build.ts`
  - Node + TypeScript builder that orchestrates composition and compilation.
- `sample/css.css`
  - Example CSS you can load in the Markdown Resume UI for styling; copied next to generated `.md` files (see **Output paths**).
- `dist/`
  - Build outputs: one Markdown file per variant + CSS copy.

**Output paths**

- Default build (`npm run build` with no profile flag and no `PROFILE` env): `dist/<variant>.md` and `dist/css.css`.
- When a profile is selected explicitly (`npm run build -- --profile <name>` or `--profile=<name>`, or `PROFILE=<name>`): `dist/<name>/<variant>.md` and `dist/<name>/css.css`.

---

### How Templates and Partials Work
Build steps handled in `scripts/build.ts`:
1. Discover all sections from `cvs/<profile>/base/*.md` and read them into memory.
2. For each base section, register a base alias partial named `base_<sectionName>` where dashes are replaced by underscores (e.g., `education-awards-publications` -> `base_education_awards_publications`).
3. For each section, if a corresponding override exists at `cvs/<profile>/override/<variant>/<sectionName>.md`:
   - The override **replaces** the base section entirely.
   - If the override contains `{{> base_<sectionName>}}`, the base content is inlined at that position.
   - Overrides are compiled as templates with the same context, flags, and helpers.
4. Register each computed section (after override processing) as a Handlebars partial named exactly by its section key (e.g., `summary`, `skills`, `header`, `education-awards-publications`).
5. Compile each template in `variants/<profile>/*.md.hbs` with context `{ ...personalData, ...flags, variant }`.
6. Write Markdown outputs to `dist/` (or `dist/<profile>/` when the profile is explicit) and copy CSS to the same folder.

Example minimal template (`variants/<profile>/<variant>.md.hbs`):

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

You can also interpolate values from `cvs/<profile>/personal.json`, e.g.:

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

Tip: Prefer shared bullets in base files and sprinkle conditional bullets only where a role truly needs bespoke emphasis. For longer role‑specific content, use the override files in `cvs/<profile>/override/<variant>/`.

---

### Sub-templates in Variant Overrides (Inline Base Inclusion)
Variant overrides (`cvs/<profile>/override/<variant>/summary.md`, `skills.md`, etc.) can behave like small templates. If you want to include the base section inline, use the provided base aliases:

- `{{> base_summary}}` for the base Summary
- `{{> base_skills}}` for the base Skills

Example `cvs/<profile>/override/senior-engineer/summary.md`:

```hbs
I’m a pragmatic engineer because:

{{> base_summary}}

Therefore, I can deliver business impact quickly and safely.
```

Behavior:
- An override **replaces** the base section entirely.
- If your override includes `{{> base_summary}}` (or `{{> base_skills}}`), the base section is inserted exactly where the tag appears.
- Overrides are compiled with the same context, flags, and helpers as the main templates, so you can also use `{{variant}}`, `{{name}}` from `cvs/<profile>/personal.json`, and helpers like `eq`, `and`, etc.

Note: The inline base alias names replace dashes with underscores. If you later add new sections, their base alias will be `base_<sectionNameWithDashesReplacedByUnderscores>`.

---

### Template-level Flags (per-variant)
You can set per-template flags at the top of any `variants/<profile>/*.md.hbs` file using a JSON comment:

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
1. Create optional per‑variant overrides:
   - `cvs/<profile>/override/<new-variant>/summary.md`
   - `cvs/<profile>/override/<new-variant>/skills.md`
2. Create a template:
   - `variants/<profile>/<new-variant>.md.hbs` that includes the standard partials you need (see example above).
3. Build:
   - `npm run build -- --profile <profile>`
4. Find the output:
   - `dist/<new-variant>.md` (default build), or `dist/<profile>/<new-variant>.md` when building with `--profile <profile>` or `PROFILE=<profile>`.

You can omit override files—if not present, only base content is used.

---

### Add a New Section (Advanced)
If you want an additional shared section (e.g., `projects`):
1. Add a base file: `cvs/<profile>/base/projects.md`.
2. Sections are discovered dynamically — no build script changes needed.
3. Use the new partial in your templates:
   - `{{> projects}}`
4. Optionally add an override: `cvs/<profile>/override/<variant>/projects.md`.

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

Outputs (default build; use `dist/<profile>/` when you pass `--profile <profile>` or set `PROFILE`):
- `dist/engineering-manager.md`
- `dist/staff-engineer.md`
- `dist/senior-engineer.md`
- `dist/css.css` (copy of `sample/css.css` if present)

Export to PDF:
1. Open the Markdown Resume UI.
2. Paste a generated `.md` file into the editor.
3. Optionally import `css.css` from the same folder as that `.md` for consistent styling.
4. Export to A4/US Letter PDF from the UI.

---

### Troubleshooting
- Error: `Missing base section file: ...`
  - Ensure all required base files exist in `cvs/<profile>/base/`.
- Error: `No variant templates found in variants/<profile>/*.md.hbs`
  - Ensure at least one template file exists in `variants/<profile>/`.
- Variant append not applied
  - Only `summary.md` and `skills.md` are appended by default; add content to those paths or extend the builder for more sections.

---

### Authoring Tips
- Keep bullets crisp and quantified; avoid long paragraphs.
- Use shared base content for 80–90% of material to minimize duplication.
- Use per‑variant override files for role‑specific emphasis and keywords.
- Prefer conditional helpers sparingly in base files when a small toggle suffices.
- For the UI:
  - You can use `\newpage` to start a new page and `\\[10px]` to insert line breaks, supported by the Markdown Resume UI.

---

### References
- Markdown Resume repository (for the UI you paste into): [GitHub](https://github.com/junian/markdown-resume)
- Live UI for preview and PDF export: [junian.dev/markdown-resume](https://www.junian.dev/markdown-resume/)


