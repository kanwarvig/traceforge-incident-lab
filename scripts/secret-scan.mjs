import { execFileSync } from "node:child_process";

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const prohibited = [
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:api[_-]?key|secret|token)\s*[=:]\s*["'][A-Za-z0-9_\-]{20,}/i,
  /(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/,
];

const findings = [];
for (const file of files) {
  if (file === "scripts/secret-scan.mjs" || file.endsWith("package-lock.json")) continue;
  let contents;
  try { contents = execFileSync("git", ["show", `:${file}`], { encoding: "utf8" }); } catch { continue; }
  for (const pattern of prohibited) if (pattern.test(contents)) findings.push(`${file}: ${pattern}`);
}

if (findings.length) {
  console.error(`Potential secrets found:\n${findings.join("\n")}`);
  process.exit(1);
}
console.log(`Secret scan passed across ${files.length} tracked files.`);
