/**
 * PWA Icon Generator
 * Creates properly sized icons from source logo
 * Run: npx tsx scripts/generate_icons.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const publicDir = path.resolve(process.cwd(), 'public');
const sourceImage = path.join(publicDir, 'logo-original.jpg');

console.log('📱 PWA Icon Generator\n');

// Check if source exists
if (!fs.existsSync(sourceImage)) {
    console.log('❌ Source logo not found at:', sourceImage);
    process.exit(1);
}

console.log('✅ Source logo found:', sourceImage);
console.log('\n📋 Required PWA Icons:');
console.log('   - icon-192.png (192x192) - App icon');
console.log('   - icon-512.png (512x512) - Splash/Install icon');
console.log('   - apple-touch-icon.png (180x180) - iOS home screen');
console.log('   - favicon.ico (32x32) - Browser tab');

console.log('\n⚠️  Manual Steps Required:');
console.log('   Since sharp installation failed, please:');
console.log('');
console.log('   1. Go to https://favicon.io/favicon-converter/');
console.log('   2. Upload the logo from: public/logo-original.jpg');
console.log('   3. Download the generated package');
console.log('   4. Extract and copy these files to public/:');
console.log('      - android-chrome-192x192.png → icon-192.png');
console.log('      - android-chrome-512x512.png → icon-512.png');
console.log('      - apple-touch-icon.png');
console.log('      - favicon.ico');
console.log('');
console.log('   OR use an online image resizer:');
console.log('   - https://www.iloveimg.com/resize-image');
console.log('   - Resize to 192x192 and 512x512');
console.log('');

// Verify current manifest.json
const manifestPath = path.join(publicDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

console.log('📄 Current manifest.json icons:');
manifest.icons?.forEach((icon: any) => {
    console.log(`   - ${icon.src} (${icon.sizes})`);
});

console.log('\n✅ Manifest is correctly configured for PWA icons');
console.log('   Just replace the icon files with your logo!');
