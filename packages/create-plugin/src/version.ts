/**
 * CLI version and metadata utilities
 *
 * Reads the CLI's own package.json to get version and templateVersions map.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CliPackageJson {
  version: string;
  templateVersions?: Record<string, string>;
}

let _cached: CliPackageJson | undefined;

function readCliPackageJson(): CliPackageJson {
  if (_cached) return _cached;
  const pkgPath = path.resolve(__dirname, '..', 'package.json');
  _cached = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return _cached!;
}

/**
 * Get the CLI's own version string (e.g., "1.0.0" or "1.0.0-dev.20260203.130115Z")
 */
export function getCliVersion(): string {
  return readCliPackageJson().version;
}

/**
 * Get the template version map from the CLI's package.json.
 * Maps package scope prefixes (e.g., "@vertesia") to exact versions.
 * Returns undefined if the field is not present (e.g., running from source).
 */
export function getTemplateVersions(): Record<string, string> | undefined {
  const pkg = readCliPackageJson();
  if (!pkg.templateVersions) return undefined;

  // Only return if versions are actually populated (not the placeholder 0.0.0)
  const hasReal = Object.values(pkg.templateVersions).some(v => v !== '0.0.0');
  return hasReal ? pkg.templateVersions : undefined;
}
