import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const searchDirs = ['.', 'public'];
let sourceFile = null;

for (const dir of searchDirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.toLowerCase().includes('copilot') || file.toLowerCase().includes('title_button') || file.toLowerCase().includes('buttons_sheet')) {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
        sourceFile = path.join(dir, file);
        break;
      }
    }
  }
  if (sourceFile) break;
}

if (!sourceFile) {
  console.log('No user uploaded button sheet found yet.');
  process.exit(0);
}

console.log(`Found source button sheet: ${sourceFile}`);
const outDir = 'public/buttons';
fs.mkdirSync(outDir, { recursive: true });

try {
  // Get image dimensions
  const dims = execSync(`identify -format "%w %h" "${sourceFile}"`).toString().trim().split(' ');
  const width = parseInt(dims[0], 10);
  const height = parseInt(dims[1], 10);
  console.log(`Sheet dimensions: ${width}x${height}`);

  const buttonHeight = Math.floor(height / 3);

  // 1. Enter Arena (Top 1/3)
  execSync(`convert "${sourceFile}" -crop ${width}x${buttonHeight}+0+0 -fuzz 12% -transparent white -trim +repage "${outDir}/btn_enter_arena.png"`);
  console.log('Sliced: btn_enter_arena.png');

  // 2. Clashing Tournament (Middle 1/3)
  execSync(`convert "${sourceFile}" -crop ${width}x${buttonHeight}+0+${buttonHeight} -fuzz 12% -transparent white -trim +repage "${outDir}/btn_clashing_tournament.png"`);
  console.log('Sliced: btn_clashing_tournament.png');

  // 3. Options (Bottom 1/3)
  execSync(`convert "${sourceFile}" -crop ${width}x${height - (buttonHeight * 2)}+0+${buttonHeight * 2} -fuzz 12% -transparent white -trim +repage "${outDir}/btn_options.png"`);
  console.log('Sliced: btn_options.png');

  console.log('Successfully cut out all 3 title buttons!');
} catch (err) {
  console.error('Failed slicing buttons:', err);
}
