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
