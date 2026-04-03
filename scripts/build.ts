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

async function loadBaseSections(rootDir: string, profile: string): Promise<Record<string, string>> {
  const baseDir = path.join(rootDir, "cvs", profile, "base");
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
  rootDir: string,
  variantKey: string,
  baseSections: Record<string, string>,
  data: Record<string, unknown>,
  profile: string
): Promise<void> {
  // Start with base sections
  const computed: Record<string, string> = { ...baseSections };

  // Register base aliases so overrides can opt-in to include base inline, e.g. {{> base_summary}}
  for (const key of Object.keys(baseSections)) {
    const alias = `base_${key.replace(/-/g, "_")}`;
    Handlebars.registerPartial(alias, baseSections[key]);
  }

  // Apply overrides: override replaces the base section entirely.
  // Use {{> base_<section>}} inside the override to inline base content where needed.
  const overridesDir = path.join(rootDir, "cvs", profile, "override", variantKey);
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
  rootDir: string,
  variantPath: string,
  context: BuildContext,
  profile: string,
  distDir: string
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
  const baseSections = await loadBaseSections(rootDir, profile);
  const dataWithFlags = { ...context.data, ...flags };
  await registerVariantPartials(rootDir, context.variantKey, baseSections, dataWithFlags, profile);

  const template = Handlebars.compile(templateBody, { noEscape: true });
  const compiled = template({ ...dataWithFlags, variant: context.variantKey });
  await ensureDir(distDir);
  const baseName = path.basename(variantPath).replace(/\.md\.hbs$/, "");
  const outputPath = path.join(distDir, `${baseName}.md`);
  await fs.writeFile(outputPath, compiled, "utf8");
}

async function copyCssIfPresent(rootDir: string, distDir: string): Promise<void> {
  const sourceCss = path.join(rootDir, "sample", "css.css");
  try {
    const stat = await fs.stat(sourceCss);
    if (stat.isFile()) {
      await ensureDir(distDir);
      await fs.copyFile(sourceCss, path.join(distDir, "css.css"));
    }
  } catch {
    // optional
  }
}

async function buildAll(): Promise<void> {
  const rootDir = getRootDir();
  const { profile, useProfileSubdir } = getProfileResolution();
  const distDir = getDistDir(rootDir, profile, useProfileSubdir);
  registerHelpers();
  const data = await readData(rootDir, profile);
  const variantsDir = path.join(rootDir, "variants", profile);
  const variantFiles = await fg("*.md.hbs", { cwd: variantsDir });
  if (variantFiles.length === 0) {
    throw new Error(`No variant templates found in ${variantsDir}/*.md.hbs`);
  }
  for (const rel of variantFiles) {
    const abs = path.join(variantsDir, rel);
    const variantKey = path.basename(rel).replace(/\.md\.hbs$/, "");
    await compileVariant(rootDir, abs, { variantKey, data }, profile, distDir);
  }
  await copyCssIfPresent(rootDir, distDir);
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


