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
