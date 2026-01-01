# App Icon & Splash Screen Generation

This project includes pre-configured app icons and splash screens for iOS and Android Capacitor builds.

## Source Assets

- **Icon**: `resources/icon.png`
- **Splash**: `resources/splash.png`

## Generating Properly Sized Assets

After cloning the project, run the generation scripts to create properly sized assets:

```bash
# Make scripts executable
chmod +x scripts/generate-icons.sh
chmod +x scripts/generate-splash.sh

# Generate icons (requires ImageMagick)
./scripts/generate-icons.sh

# Generate splash screens
./scripts/generate-splash.sh
```

### Prerequisites

- **ImageMagick**: Install via `brew install imagemagick` (macOS) or `apt-get install imagemagick` (Linux)

## Manual Icon Placement

### iOS Icons

Icons are placed in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`:

| Size | Scale | Filename | Usage |
|------|-------|----------|-------|
| 20x20 | 2x | AppIcon-20x20@2x.png | iPhone Notification |
| 20x20 | 3x | AppIcon-20x20@3x.png | iPhone Notification |
| 29x29 | 2x | AppIcon-29x29@2x.png | iPhone Settings |
| 29x29 | 3x | AppIcon-29x29@3x.png | iPhone Settings |
| 40x40 | 2x | AppIcon-40x40@2x.png | iPhone Spotlight |
| 40x40 | 3x | AppIcon-40x40@3x.png | iPhone Spotlight |
| 60x60 | 2x | AppIcon-60x60@2x.png | iPhone App |
| 60x60 | 3x | AppIcon-60x60@3x.png | iPhone App |
| 76x76 | 1x | AppIcon-76x76@1x.png | iPad App |
| 76x76 | 2x | AppIcon-76x76@2x.png | iPad App |
| 83.5x83.5 | 2x | AppIcon-83.5x83.5@2x.png | iPad Pro App |
| 1024x1024 | 1x | AppIcon-1024x1024@1x.png | App Store |

### Android Icons

Icons are placed in `android/app/src/main/res/mipmap-*/`:

| Density | Size | Folder |
|---------|------|--------|
| mdpi | 48x48 | mipmap-mdpi |
| hdpi | 72x72 | mipmap-hdpi |
| xhdpi | 96x96 | mipmap-xhdpi |
| xxhdpi | 144x144 | mipmap-xxhdpi |
| xxxhdpi | 192x192 | mipmap-xxxhdpi |

#### Adaptive Icons (Android 8.0+)

Adaptive icons use:
- `ic_launcher_foreground.png` - The icon content (centered in safe zone)
- `ic_launcher_background.xml` - Background color (#E8E8E8)
- `ic_launcher.xml` - Combines foreground and background

## After Icon Generation

```bash
# Sync with native platforms
npx cap sync

# Run on device
npx cap run ios
# or
npx cap run android
```
