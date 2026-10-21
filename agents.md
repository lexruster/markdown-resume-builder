# Builder contributor guide

All repository content is written in English. This repository is a generic composition tool; do not put private career data or references to a consuming project's private context in it.

## Source layout

- resume/<profile>/personal.json and *.md contain only shared personal/profile data.
- applications/<key>/application.json selects a profile and optional flags.
- applications/<key>/resume.md.hbs defines layout and section selection.
- applications/<key>/*.md optionally replace shared sections. Keep related application content together; do not recreate a separate variants directory.
- applications/sample, sample-engineering-manager, and sample-short demonstrate reuse of resume/sample.
- scripts/build.ts owns composition. Consuming repositories may provide thin wrappers that only pass paths.

## Rendering behavior

Discover sections dynamically. Register base aliases as base_<section> with dashes replaced by underscores. Overrides replace sections and may include base aliases. Preserve personal data, flags, helpers (eq/ne/and/or), and the application/profile context. The legacy variant context key remains an alias of the application key.

Clear partials between applications so one person's sections cannot leak into another person's resume. Flags in application.json override legacy template flag comments. Each application explicitly selects its profile; application inheritance is not implemented.

## CLI and compatibility

npm run build must work standalone using the included sample applications and resume/sample. External projects pass --profiles-root and --applications-root together, optional --application, --output-dir, and --css. Relative explicit paths resolve from process.cwd(). Legacy external cvs/variants sources remain available through --source-root and --profile; do not break that mode accidentally.

Run npm test for functional coverage of application selection, overrides/base inclusion, profile isolation, invalid configuration, standalone samples, and legacy external sources. Verify that the public samples contain no private data. Do not commit or push unless the user authorizes it.

## Development map and checks

- scripts/build.ts: argument parsing, configuration validation, profile loading, partial registration, rendering, output, and stylesheet copying.
- tests/applications.test.mjs: functional CLI tests using temporary independent profiles/applications and legacy source fixtures.
- package.json: build/test commands; package-lock.json pins dependencies.
- resume/sample/ and applications/sample*/: public, fictional examples using the current schema.
- CLAUDE.md imports this guide so Claude Code and other agents can share the same instructions.

When changing rendering, preserve section-name matching (unrelated job notes are not overrides), inline base aliases, configuration flag precedence, application selection, and isolation between people. Keep Markdown files directly in profile/application folders; do not add base/ or overrides/ directories to the current schema. Legacy mode intentionally retains its historical external source layout.

After a logic change, run npm test and npm run build from this repository. If working within a consuming project, also run that project's build using external source paths. Keep the README and sample application.json/HBS files aligned with behavior. Do not duplicate consumer-specific business flags or career data in the public tool.

## Local UI

The generic browser interface belongs to this repository, not a consuming private workspace. scripts/ui-server.mjs reads disk catalogs and delegates generation to scripts/build.ts; ui/ owns controls and paginated preview. npm run ui works with standalone samples, or accepts paired --profiles-root/--applications-root plus --output-dir, --css and --port. Consumer launchers only pass paths. Preserve loopback binding, local-origin checks, request tokens, HTML sanitization, and offline assets. Do not introduce remote resume rendering or duplicate the engine. Keep ui/preview-shell.css separate from styles passed through Paged.js; print-media normalization otherwise overrides screen zoom. UI layout preferences are browser-local per application and do not change source data. Use the README UI verification checklist and npm test after UI changes.
Printing uses ui/print.html and ui/print.js as a top-level page receiving the current paginated DOM and styles. Do not revert to iframe.print(): screen rendering is not proof of correct PDF output. Run npm run test:browser when changing pagination, print CSS, fonts, or the print workflow. It checks actual Chromium PDF contents. Minion Pro is supported only from locally installed fonts; do not bundle proprietary font files.

Preserve empty level-two Markdown headings as decorative section-separator elements; they are used around employment rows. Three-cell definition lists use position-heading layout. Measure long rows at the selected paper content width after fonts load, before pagination; do not restore equal-width columns that split company locations or clip dates. Keep printed heading layout and divider coverage in browser regressions.

Application selection loads saved Markdown through GET /api/export without writing files or invoking the builder. Generate/Regenerate is the explicit write action. Preserve selection-request cancellation so a slower response cannot replace a newer selection. Test existing-export display, missing-export clearing, unchanged file timestamps, and explicit regeneration.

Pass a detached HTML fragment into Paged.js, including the outer resume wrapper. Passing the live wrapper element leaves that root without a data-ref and can crash break-token creation on some page boundaries. Never display unpaginated source after a render failure.
