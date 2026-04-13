#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const version = process.argv[2];

if (!version) {
  console.error("Usage: npm run delete-version <version>");
  console.error("Example: npm run delete-version 1.0");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, `versioned_docs/version-${version}`);
const sidebarsFile = path.join(root, `versioned_sidebars/version-${version}-sidebars.json`);
const versionsFile = path.join(root, "versions.json");

let removed = false;

// 1. Remove versioned docs folder
if (fs.existsSync(docsDir)) {
  fs.rmSync(docsDir, { recursive: true, force: true });
  console.log(`Deleted: versioned_docs/version-${version}/`);
  removed = true;
} else {
  console.warn(`Not found: versioned_docs/version-${version}/`);
}

// 2. Remove versioned sidebars file
if (fs.existsSync(sidebarsFile)) {
  fs.rmSync(sidebarsFile);
  console.log(`Deleted: versioned_sidebars/version-${version}-sidebars.json`);
  removed = true;
} else {
  console.warn(`Not found: versioned_sidebars/version-${version}-sidebars.json`);
}

// 3. Remove from versions.json
if (fs.existsSync(versionsFile)) {
  const versions = JSON.parse(fs.readFileSync(versionsFile, "utf8"));
  const updated = versions.filter((v) => v !== version);
  if (versions.length !== updated.length) {
    fs.writeFileSync(versionsFile, JSON.stringify(updated, null, 2) + "\n");
    console.log(`Removed "${version}" from versions.json`);
    removed = true;
  } else {
    console.warn(`"${version}" not found in versions.json`);
  }
}

if (!removed) {
  console.error(`Version "${version}" not found anywhere. Nothing was deleted.`);
  process.exit(1);
}

console.log(`\nDone. Version ${version} has been removed.`);
