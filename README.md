# Markdown Resume Builder

Compose reusable profile data and application-specific templates into Markdown resumes with Handlebars. An application can be a general resume, a role-focused version, or a tailored job application; all use the same folder structure.

## Quick start

```sh
npm ci
npm run build
npm test
```

The default build uses the included sample profile and applications. Results are written to dist/<application>.md, with css.css alongside them. Paste Markdown into [Oh My CV](https://ohmycv.app/) or [Markdown Resume](https://www.junian.dev/markdown-resume/) for PDF export.

## Structure

```text
resume/
  sample/
    personal.json                 # Person's contact and template data
    *.md                     # Shared sections; no application overrides here
applications/
  sample/
    application.json              # Profile selection and flags
    resume.md.hbs                 # Section order and layout
    summary.md           # Optional replacement sections
  sample-engineering-manager/     # Another application using the same profile
  sample-short/
sample/css.css                    # Default stylesheet
scripts/build.ts                  # Composition engine
```

There is no separate variants directory. Copy an application folder to create a new version. To support another person, add a profile under resume/ and select it in application.json.

## Application configuration

```json
{
  "profile": "sample",
  "flags": {
    "show_projects": true
  }
}
```

The profile must name a direct child folder under resume/. Each application requires application.json and resume.md.hbs. Flags are optional and default to an empty object. No settings are inherited from another application.

Example resume.md.hbs:

```hbs
{{> header}}

## Summary
{{> summary}}

{{> skills}}
{{> experience}}
{{> education-awards-publications}}

{{#if show_projects}}
{{> projects}}
{{/if}}
```

All *.md files directly under the profile directory become partials. An application's <section>.md directly in its folder replaces that section. Only filenames matching existing profile sections are loaded; unrelated files such as job.md are ignored. To include the original text inside a replacement, use its base alias:

```hbs
{{> base_summary}}

Additional emphasis for this application.
```

Aliases replace dashes with underscores: education-awards-publications becomes base_education_awards_publications. Personal data, flags, application, profile, and variant (an alias of the application key) are available in templates and sections. Helpers: eq, ne, and, or. Application JSON flags take precedence over legacy flags comments in a template. Partials and flags are isolated between applications, including applications for different people.

## Build one application

```sh
npm run build -- --application sample
```

Without --application, all folders containing application.json are built. An application can also contain job.md, notes, and external result links; the builder ignores these files.

## Use external private data

```sh
npm run build -- --profiles-root /path/to/private/resume --applications-root /path/to/private/applications --output-dir /path/to/private/exports/current --css /path/to/private/resume/css.css
```

- --profiles-root: folder containing <profile>/personal.json and <profile>/*.md.
- --applications-root: folder containing <application>/application.json, resume.md.hbs, and optional section Markdown files.
- --output-dir: exact output folder; defaults to the builder's dist/.
- --css: optional stylesheet; defaults to the bundled sample/css.css. A missing explicit file fails the build.
- --application: optional application folder name.

Supply both external root options together. Paths resolve from the process working directory. Both --option value and --option=value are supported. Keep private sources outside a public builder checkout.

## Legacy source layout

Existing external sources using cvs/<profile>/ and variants/<profile>/ remain supported through explicit legacy mode:

```sh
npm run build -- --source-root /path/to/old-sources --profile sample --output-dir /path/to/output
```

Do not combine --source-root with application root options. Legacy --profile and PROFILE select a person only in this mode. New applications select their profile in application.json.

## Local resume studio

Start the generic browser UI with:

```sh
npm run ui
# http://127.0.0.1:4173
```

It reads profiles and applications directly from disk. Choose a profile and select one of its applications. If its Markdown export already exists, the studio displays that saved file immediately without rebuilding or modifying it. Click **Regenerate resume** to explicitly rebuild it; **Generate resume** is shown when no export exists. Generation invokes the existing scripts/build.ts engine, writes the configured Markdown export and css.css, and then renders that exact Markdown into a paginated preview. Click Refresh after adding or removing folders. Selection/Refresh only reads saved exports; Generate/Regenerate rereads source content and writes the export. Use a current Chrome or Edge browser for the native PDF print dialog; embedded app browsers may not expose printing.

For an external workspace:

```sh
npm run ui -- --profiles-root /path/to/private/resume --applications-root /path/to/private/applications --output-dir /path/to/private/exports/current --css /path/to/private/resume/css.css
```

Both source-root options are required together. Paths may be absolute or relative to the invoking working directory. Optional --port changes the default 4173; --open opens the local URL in the default browser. The UI server binds only to 127.0.0.1. A consuming project needs only a path-forwarding launcher, not its own UI or composition engine. No additional app.json is required.

### Preview and PDF

- Classic is an independently implemented print theme inspired by [Oh My CV's default settings](https://github.com/Renovamen/oh-my-cv/blob/main/site/src/composables/constant/variables/default.ts): A4, 15 px text, 1.3 line spacing, 50 px vertical/45 px horizontal margins, and #377bb5 accent.
- Source Serif 4 is bundled through [Fontsource](https://fontsource.org/fonts/source-serif-4) under its SIL Open Font License. No proprietary font files or upstream application code are copied. Minion Pro (installed) selects a locally installed Minion Pro font; if it is unavailable, the UI reports the fallback to Source Serif 4. Georgia, Arial, and Times New Roman use fonts installed on the machine.
- Select Repository CSS to apply the configured stylesheet on top of the print theme. Existing #vue-smart-pages-preview selectors are supported. A stylesheet's own rules may override toolbar colors and spacing.
- Paper, font, spacing, margins, and color are remembered per application in this browser's local storage. They do not modify Markdown, application.json, or the shared profile. Reset restores defaults.
- **Print / Save PDF** opens a dedicated top-level print tab using a snapshot of the already paginated resume, then opens the browser print dialog. This avoids Chromium clipping iframe content. Allow pop-ups for the local site. Studio controls are excluded. Choose Save as PDF, match the selected A4/Letter paper, use 100% scale, and disable browser headers/footers. Browser print settings can affect pagination. Save the PDF outside the public tool.
- **Markdown** downloads the generated text; it is also saved in the configured output directory.
- Definition lists, contact icons used by the samples, raw HTML layout, \newpage and \\[10px] are supported. Executable HTML is sanitized. Remote images/fonts are blocked; the studio works offline after dependency installation. Full Oh My CV-specific math, citations, front matter, and arbitrary Iconify libraries are not implemented.

### UI development

scripts/ui-server.mjs owns the local HTTP API, catalog discovery, generation delegation, and sanitized Markdown rendering. ui/ contains the browser controls, print theme, and iframe pagination using [Paged.js](https://pagedjs.org/). Keep preview-shell.css outside the Paged.js content stylesheet pipeline: its screen zoom must not be rewritten as print rules. No framework build step is required. Pagination must run at 100% scale; apply screen zoom only after layout completes.

npm test covers catalog refresh, generation through the real engine, profile/application validation, local request restrictions, preview Markdown, assets, and the existing CLI. For browser changes also check profile/application switching, repeated pagination, A4/Letter, font/theme changes, zoom, and the print dialog.

Run npm run test:browser for actual Chromium PDF regression coverage (Chrome installed, or set RESUME_BROWSER_CHANNEL=msedge for Edge). The test opens the real print tab, creates PDFs in memory, and verifies page counts, paper dimensions, body text on every page, and all 65 fixture entries across A4/Letter, both themes, and font changes. Tests use fictional data; no PDFs are committed.

Empty ## lines in existing Markdown are intentional decorative dividers and remain visible in preview/PDF. Three-cell definition lists are rendered as position headings: title, company/location, and dates. Their columns use content widths; unusually long headings are fitted at the actual paper width before pagination so addresses and dates do not wrap or extend beyond the page. Contact addresses and links also stay intact. Browser PDF tests cover divider visibility and single-line heading layout.
