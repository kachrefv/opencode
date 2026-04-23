import fs from "node:fs/promises";
import { glob } from "glob";

async function replaceInFiles(pattern) {
  const files = await glob(pattern, { absolute: true });
  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    let newContent = content.replace(/OpenCode/g, "Carthis");
    newContent = newContent.replace(/opencode/g, "carthis");
    
    if (content !== newContent) {
      await fs.writeFile(file, newContent, "utf8");
      console.log(`Updated: ${file}`);
    }
  }
}

async function run() {
  await replaceInFiles("packages/app/src/i18n/**/*.ts");
  await replaceInFiles("packages/desktop-electron/src/renderer/i18n/**/*.ts");
  await replaceInFiles("packages/ui/src/i18n/**/*.ts");
}

run().catch(console.error);