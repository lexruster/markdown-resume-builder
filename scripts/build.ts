import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";
import Handlebars from "handlebars";

interface BuildContext {
  variantKey: string;
  data: Record<string, unknown>;
}

function getRootDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "..");
}

function getOption(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === name || arg.startsWith(`${name}=`)) {
      const value = arg === name ? argv[i + 1] : arg.slice(name.length + 1);
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${name}`);
      }
      return value;
    }
  }
  return undefined;
}

/** Explicit paths are resolved against the invoking process's working directory. */
function getPathOption(name: string): string | undefined {
  const value = getOption(name);
  return value === undefined ? undefined : path.resolve(value);
}

/** When true, outputs go under `dist/<profile>/`; otherwise flat `dist/` (default build). */
function getDistDir(rootDir: string, profile: string, useProfileSubdir: boolean): string {
  if (useProfileSubdir) {
    return path.join(rootDir, "dist", profile);
  }
  return path.join(rootDir, "dist");
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

function registerHelpers(): void {
  Handlebars.registerHelper("eq", function (a: unknown, b: unknown) {
    return a === b;
  });
  Handlebars.registerHelper("ne", function (a: unknown, b: unknown) {
    return a !== b;
  });
  Handlebars.registerHelper("and", function (...args: unknown[]) {
    const values = args.slice(0, -1);
    return values.every(Boolean);
  });
  Handlebars.registerHelper("or", function (...args: unknown[]) {
    const values = args.slice(0, -1);
    return values.some(Boolean);
  });
}

function getProfileResolution(): { profile: string; useProfileSubdir: boolean } {
  // default to "sample"; allow --profile=alex or --profile alex
  const argv = process.argv.slice(2);
  let profile = process.env.PROFILE || "sample";
  let useProfileSubdir = Boolean(process.env.PROFILE);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--profile" && argv[i + 1]) {
      profile = argv[i + 1];
      useProfileSubdir = true;
      break;
    }
    const m = arg.match(/^--profile=(.+)$/);
    if (m) {
      profile = m[1];
      useProfileSubdir = true;
      break;
    }
  }
  return { profile, useProfileSubdir };
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw;
  } catch {
    return null;
  }
}

async function loadBaseSections(baseDir: string): Promise<Record<string, string>> {
  const sections: Record<string, string> = {};
  const mdFiles = await fg("*.md", { cwd: baseDir });
  if (mdFiles.length === 0) {
    throw new Error(`No base sections found in ${baseDir}`);
  }
  for (const rel of mdFiles) {
    const sectionName = path.basename(rel, ".md");
    const abs = path.join(baseDir, rel);
    const content = await readIfExists(abs);
    if (!content) {
      throw new Error(`Failed to read base section file: ${abs}`);
    }
    sections[sectionName] = content;
  }
  return sections;
}

async function registerVariantPartials(
  overridesDir: string,
  variantKey: string,
  baseSections: Record<string, string>,
  data: Record<string, unknown>
): Promise<void> {
  // Each application may select a different profile. Do not retain its partials.
  for (const name of Object.keys(Handlebars.partials)) Handlebars.unregisterPartial(name);
  // Start with base sections
  const computed: Record<string, string> = { ...baseSections };

  // Register base aliases so overrides can opt-in to include base inline, e.g. {{> base_summary}}
  for (const key of Object.keys(baseSections)) {
    const alias = `base_${key.replace(/-/g, "_")}`;
    Handlebars.registerPartial(alias, baseSections[key]);
  }

  // Apply overrides: override replaces the base section entirely.
  // Use {{> base_<section>}} inside the override to inline base content where needed.
  for (const key of Object.keys(baseSections)) {
    const overridePath = path.join(overridesDir, `${key}.md`);
    const overrideContent = await readIfExists(overridePath);
    if (overrideContent && overrideContent.trim().length > 0) {
      const tpl = Handlebars.compile(overrideContent, { noEscape: true });
      computed[key] = `${tpl({ ...data, variant: variantKey }).trim()}\n`;
    }
  }

  // Register all sections as simple partials that templates can include directly
  for (const key of Object.keys(computed)) {
    Handlebars.registerPartial(key, computed[key]);
  }
}

async function readData(rootDir: string, profile: string): Promise<Record<string, unknown>> {
  const dataFile = path.join(rootDir, "cvs", profile, "personal.json");
  const raw = await fs.readFile(dataFile, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

async function compileVariant(
  variantPath: string,
  context: BuildContext,
  baseDir: string,
  overridesDir: string,
  outputPath: string,
  applicationFlags: Record<string, unknown> = {}
): Promise<void> {
  // Read the variant template first to extract optional flags that should
  // influence how overrides are compiled (e.g., exclude_latest_experience).
  const templateSource = await fs.readFile(variantPath, "utf8");

  // Extract optional inline flags from a JSON comment at the very top:
  // {{!-- flags: {"exclude_latest_experience": true} --}}
  let flags: Record<string, unknown> = {};
  let templateBody = templateSource;
  const flagsMatch = templateSource.match(/^\s*\{\{!--\s*flags:\s*(\{[\s\S]*?\})\s*--\}\}\s*\n?/);
  if (flagsMatch && flagsMatch[1]) {
    try {
      flags = JSON.parse(flagsMatch[1]) as Record<string, unknown>;
      templateBody = templateSource.slice(flagsMatch[0].length);
    } catch {
      // ignore malformed flags; proceed without them
    }
  }

  // Re-register partials for each variant to ensure overrides are applied correctly.
  // Important: pass flags into the data so overridden sections are compiled with them.
  const baseSections = await loadBaseSections(baseDir);
  const dataWithFlags = { ...context.data, ...flags, ...applicationFlags };
  await registerVariantPartials(overridesDir, context.variantKey, baseSections, dataWithFlags);

  const template = Handlebars.compile(templateBody, { noEscape: true });
  const compiled = template({ ...dataWithFlags, variant: context.variantKey });
  await ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, compiled, "utf8");
}

function isFolderName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
    && value !== "." && value !== ".." && !/[\\/]/.test(value);
}

async function buildApplications(applicationsRoot: string, profilesRoot: string, outputDir: string): Promise<void> {
  const selected = getOption("--application");
  if (selected !== undefined && !isFolderName(selected)) throw new Error("Invalid application folder name");
  const configs = selected
    ? [path.join(selected, "application.json")]
    : (await fg("*/application.json", { cwd: applicationsRoot })).sort();
  if (configs.length === 0) throw new Error(`No application.json files found in ${applicationsRoot}`);

  for (const relativeConfig of configs) {
    const configPath = path.join(applicationsRoot, relativeConfig);
    const config: unknown = JSON.parse(await fs.readFile(configPath, "utf8"));
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error(`Expected a JSON object in ${configPath}`);
    }
    const { profile, flags = {} } = config as Record<string, unknown>;
    if (!isFolderName(profile)) throw new Error(`Invalid or missing profile in ${configPath}`);
    if (!flags || typeof flags !== "object" || Array.isArray(flags)) {
      throw new Error(`Expected a flags object in ${configPath}`);
    }
    const applicationDir = path.dirname(configPath);
    const application = path.basename(applicationDir);
    const profileDir = path.join(profilesRoot, profile);
    const personalData = JSON.parse(await fs.readFile(path.join(profileDir, "personal.json"), "utf8"));
    await compileVariant(
      path.join(applicationDir, "resume.md.hbs"),
      { variantKey: application, data: { ...personalData, profile, application } },
      profileDir,
      applicationDir,
      path.join(outputDir, `${application}.md`),
      flags as Record<string, unknown>
    );
    console.log(` - ${application}.md (profile: ${profile})`);
  }
}

async function copyCssIfPresent(rootDir: string, distDir: string, cssPath?: string): Promise<void> {
  const sourceCss = cssPath ?? path.join(rootDir, "sample", "css.css");
  try {
    const stat = await fs.stat(sourceCss);
    if (stat.isFile()) {
      await ensureDir(distDir);
      await fs.copyFile(sourceCss, path.join(distDir, "css.css"));
    }
  } catch (error) {
    if (cssPath) throw error;
    // optional
  }
}

async function buildAll(): Promise<void> {
  const builderRoot = getRootDir();
  let applicationsRoot = getPathOption("--applications-root");
  let profilesRoot = getPathOption("--profiles-root");
  const legacyRoot = getPathOption("--source-root");
  if (!legacyRoot && !applicationsRoot && !profilesRoot) {
    applicationsRoot = path.join(builderRoot, "applications");
    profilesRoot = path.join(builderRoot, "resume");
  }
  if (legacyRoot && (applicationsRoot || profilesRoot)) {
    throw new Error("Do not combine --source-root with application build paths");
  }
  registerHelpers();
  if (applicationsRoot || profilesRoot) {
    if (!applicationsRoot || !profilesRoot) {
      throw new Error("Application builds require both --applications-root and --profiles-root");
    }
    const outputDir = getPathOption("--output-dir") ?? path.join(builderRoot, "dist");
    console.log("Built applications:");
    await buildApplications(applicationsRoot, profilesRoot, outputDir);
    await copyCssIfPresent(builderRoot, outputDir, getPathOption("--css"));
    return;
  }
  if (getOption("--application")) throw new Error("--application requires application build paths");
  const rootDir = legacyRoot ?? builderRoot;
  const { profile, useProfileSubdir } = getProfileResolution();
  const distDir = getPathOption("--output-dir") ?? getDistDir(rootDir, profile, useProfileSubdir);
  const cssPath = getPathOption("--css");
  const data = await readData(rootDir, profile);
  const variantsDir = path.join(rootDir, "variants", profile);
  const variantFiles = await fg("*.md.hbs", { cwd: variantsDir });
  if (variantFiles.length === 0) {
    throw new Error(`No variant templates found in ${variantsDir}/*.md.hbs`);
  }
  for (const rel of variantFiles) {
    const abs = path.join(variantsDir, rel);
    const variantKey = path.basename(rel).replace(/\.md\.hbs$/, "");
    await compileVariant(
      abs, { variantKey, data },
      path.join(rootDir, "cvs", profile, "base"),
      path.join(rootDir, "cvs", profile, "override", variantKey),
      path.join(distDir, `${variantKey}.md`)
    );
  }
  await copyCssIfPresent(builderRoot, distDir, cssPath);
  const relDist = path.relative(rootDir, distDir);
  const outputs = (await fg("*.md", { cwd: distDir })).map((f) =>
    path.join(relDist, f).split(path.sep).join("/")
  );
  // Basic console output for UX
  console.log("Built resumes:");
  for (const out of outputs) console.log(" -", out);
  console.log(`Profile: ${profile}`);
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});


