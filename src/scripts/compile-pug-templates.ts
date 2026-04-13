#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

interface PugTemplatesMap {
  [key: string]: string;
}

/**
 * Recursively finds all .pug files in a directory
 */
function findPugFiles(
  dir: string,
  baseDir: string,
  files: Map<string, string> = new Map(),
): Map<string, string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively search subdirectories
      findPugFiles(fullPath, baseDir, files);
    } else if (entry.isFile() && entry.name.endsWith('.pug')) {
      // Read the pug file content
      const content = fs.readFileSync(fullPath, 'utf-8');
      // Use relative path from base directory as the key
      // Normalize to POSIX-style path (forward slashes) for cross-platform consistency
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.set(relativePath, content);
    }
  }

  return files;
}

/**
 * Main function to compile pug templates to JSON
 */
export function compilePugTemplates(
  inputDir: string = './templates',
  outputFile: string = 'compiled-templates.json',
): void {
  // Validate input directory exists
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Directory "${inputDir}" does not exist.`);
  }

  if (!fs.statSync(inputDir).isDirectory()) {
    throw new Error(`"${inputDir}" is not a directory.`);
  }

  console.log(`Searching for .pug files in: ${inputDir}`);

  // Find all pug files
  const pugFiles = findPugFiles(inputDir, inputDir);

  console.log(`Found ${pugFiles.size} .pug file(s)`);

  // Convert Map to plain object
  const result: PugTemplatesMap = {};
  for (const [filePath, content] of pugFiles.entries()) {
    result[filePath] = content;
    console.log(`  - ${filePath}`);
  }

  // Write to output file
  const outputContent = JSON.stringify(result, null, 2);
  fs.writeFileSync(outputFile, outputContent, 'utf-8');

  console.log(`\nSuccessfully compiled templates to: ${outputFile}`);
}

function printHelp(): void {
  console.log('Usage: compile-pug-templates [input-directory] [output-file]');
  console.log('');
  console.log('Arguments:');
  console.log('  input-directory  Directory containing .pug templates (default: ./templates)');
  console.log('  output-file      Output JSON file path (default: compiled-templates.json)');
  console.log('');
  console.log('Examples:');
  console.log('  compile-pug-templates');
  console.log('  compile-pug-templates ./templates');
  console.log('  compile-pug-templates ./templates ./compiled-templates.json');
}

export function runCli(args: string[] = process.argv.slice(2)): void {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const [inputDir, outputFile] = args;

  try {
    compilePugTemplates(inputDir, outputFile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

const isExecutedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1]);

if (isExecutedDirectly) {
  runCli(process.argv.slice(2));
}
