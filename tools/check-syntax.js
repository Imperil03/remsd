const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname,"..");
const files = directory => fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry => {
  const file=path.join(directory,entry.name);
  return entry.isDirectory() ? files(file) : entry.name.endsWith(".js") ? [file] : [];
});
const targets=[...files(path.join(root,"tools")),...files(path.join(root,"assets/js"))];
for (const file of targets) execFileSync(process.execPath,["--check",file],{stdio:"inherit"});
console.log(`JavaScript syntax OK: ${targets.length} files.`);
