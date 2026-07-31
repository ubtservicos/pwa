import Jimp from 'jimp';
import fs from 'fs';
import path from 'path';

async function makeTransparent(filename, bgR, bgG, bgB, threshold = 30) {
  const originalPath = path.join('public', filename);
  const backupPath = path.join('public', filename.replace('.png', '-original.png'));
  
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(originalPath, backupPath);
    console.log(`Backed up ${filename} to ${backupPath}`);
  } else {
    console.log(`Using existing backup for ${filename}`);
  }
  
  const image = await Jimp.read(backupPath);
  const width = image.getWidth();
  const height = image.getHeight();
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = Jimp.intToRGBA(image.getPixelColor(x, y));
      
      // Calculate distance to the background color
      const rDiff = color.r - bgR;
      const gDiff = color.g - bgG;
      const bDiff = color.b - bgB;
      const dist = Math.sqrt(rDiff*rDiff + gDiff*gDiff + bDiff*bDiff);
      
      if (dist < threshold) {
        // Completely transparent
        image.setPixelColor(Jimp.rgbaToInt(0, 0, 0, 0), x, y);
      } else if (dist < threshold + 25) {
        // Semi-transparent edge for anti-aliasing
        const factor = (dist - threshold) / 25; // 0 to 1
        const alpha = Math.round(color.a * factor);
        // Blend towards transparent
        image.setPixelColor(Jimp.rgbaToInt(color.r, color.g, color.b, alpha), x, y);
      }
    }
  }
  
  await image.writeAsync(originalPath);
  console.log(`Saved transparent version of ${filename} to ${originalPath}`);
}

async function run() {
  // logo-02 corner is around (237, 237, 229)
  await makeTransparent('logo-02.png', 237, 237, 229, 30);
  
  // logo-03 corner is around (247, 247, 245)
  await makeTransparent('logo-03.png', 247, 247, 245, 30);
  
  // logo-aplicacoes corner is around (244, 250, 250)
  await makeTransparent('logo-aplicacoes.png', 244, 250, 250, 40);
}

run().catch(console.error);
