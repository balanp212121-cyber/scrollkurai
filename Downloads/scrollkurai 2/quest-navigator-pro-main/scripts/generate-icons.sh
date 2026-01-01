#!/bin/bash

# ScrollKurai Icon Generation Script
# Prerequisites: ImageMagick (install via: brew install imagemagick on macOS)

SOURCE_ICON="resources/icon.png"

# Check if source icon exists
if [ ! -f "$SOURCE_ICON" ]; then
    echo "Error: Source icon not found at $SOURCE_ICON"
    exit 1
fi

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick is required. Install with: brew install imagemagick"
    exit 1
fi

echo "🎨 Generating ScrollKurai app icons..."

# ============================================
# iOS Icons (AppIcon.appiconset)
# ============================================
IOS_ICON_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$IOS_ICON_DIR"

echo "📱 Generating iOS icons..."

# iPhone Notification (20pt)
convert "$SOURCE_ICON" -resize 40x40 "$IOS_ICON_DIR/AppIcon-20x20@2x.png"
convert "$SOURCE_ICON" -resize 60x60 "$IOS_ICON_DIR/AppIcon-20x20@3x.png"

# iPhone Settings (29pt)
convert "$SOURCE_ICON" -resize 58x58 "$IOS_ICON_DIR/AppIcon-29x29@2x.png"
convert "$SOURCE_ICON" -resize 87x87 "$IOS_ICON_DIR/AppIcon-29x29@3x.png"

# iPhone Spotlight (40pt)
convert "$SOURCE_ICON" -resize 80x80 "$IOS_ICON_DIR/AppIcon-40x40@2x.png"
convert "$SOURCE_ICON" -resize 120x120 "$IOS_ICON_DIR/AppIcon-40x40@3x.png"

# iPhone App (60pt)
convert "$SOURCE_ICON" -resize 120x120 "$IOS_ICON_DIR/AppIcon-60x60@2x.png"
convert "$SOURCE_ICON" -resize 180x180 "$IOS_ICON_DIR/AppIcon-60x60@3x.png"

# iPad Notifications (20pt)
convert "$SOURCE_ICON" -resize 20x20 "$IOS_ICON_DIR/AppIcon-20x20@1x.png"
convert "$SOURCE_ICON" -resize 40x40 "$IOS_ICON_DIR/AppIcon-20x20@2x-1.png"

# iPad Settings (29pt)
convert "$SOURCE_ICON" -resize 29x29 "$IOS_ICON_DIR/AppIcon-29x29@1x.png"
convert "$SOURCE_ICON" -resize 58x58 "$IOS_ICON_DIR/AppIcon-29x29@2x-1.png"

# iPad Spotlight (40pt)
convert "$SOURCE_ICON" -resize 40x40 "$IOS_ICON_DIR/AppIcon-40x40@1x.png"
convert "$SOURCE_ICON" -resize 80x80 "$IOS_ICON_DIR/AppIcon-40x40@2x-1.png"

# iPad App (76pt)
convert "$SOURCE_ICON" -resize 76x76 "$IOS_ICON_DIR/AppIcon-76x76@1x.png"
convert "$SOURCE_ICON" -resize 152x152 "$IOS_ICON_DIR/AppIcon-76x76@2x.png"

# iPad Pro App (83.5pt)
convert "$SOURCE_ICON" -resize 167x167 "$IOS_ICON_DIR/AppIcon-83.5x83.5@2x.png"

# App Store (1024pt)
convert "$SOURCE_ICON" -resize 1024x1024 "$IOS_ICON_DIR/AppIcon-1024x1024@1x.png"

# ============================================
# Android Icons
# ============================================
echo "🤖 Generating Android icons..."

ANDROID_RES_DIR="android/app/src/main/res"

# Standard launcher icons
convert "$SOURCE_ICON" -resize 48x48 "$ANDROID_RES_DIR/mipmap-mdpi/ic_launcher.png"
convert "$SOURCE_ICON" -resize 72x72 "$ANDROID_RES_DIR/mipmap-hdpi/ic_launcher.png"
convert "$SOURCE_ICON" -resize 96x96 "$ANDROID_RES_DIR/mipmap-xhdpi/ic_launcher.png"
convert "$SOURCE_ICON" -resize 144x144 "$ANDROID_RES_DIR/mipmap-xxhdpi/ic_launcher.png"
convert "$SOURCE_ICON" -resize 192x192 "$ANDROID_RES_DIR/mipmap-xxxhdpi/ic_launcher.png"

# Adaptive icon foreground (with padding for safe zone)
# Foreground should be 108dp with content in center 72dp (66% of 108)
convert "$SOURCE_ICON" -resize 66x66 -gravity center -background none -extent 108x108 "$ANDROID_RES_DIR/mipmap-mdpi/ic_launcher_foreground.png"
convert "$SOURCE_ICON" -resize 99x99 -gravity center -background none -extent 162x162 "$ANDROID_RES_DIR/mipmap-hdpi/ic_launcher_foreground.png"
convert "$SOURCE_ICON" -resize 132x132 -gravity center -background none -extent 216x216 "$ANDROID_RES_DIR/mipmap-xhdpi/ic_launcher_foreground.png"
convert "$SOURCE_ICON" -resize 198x198 -gravity center -background none -extent 324x324 "$ANDROID_RES_DIR/mipmap-xxhdpi/ic_launcher_foreground.png"
convert "$SOURCE_ICON" -resize 264x264 -gravity center -background none -extent 432x432 "$ANDROID_RES_DIR/mipmap-xxxhdpi/ic_launcher_foreground.png"

# Round icons
convert "$SOURCE_ICON" -resize 48x48 "$ANDROID_RES_DIR/mipmap-mdpi/ic_launcher_round.png"
convert "$SOURCE_ICON" -resize 72x72 "$ANDROID_RES_DIR/mipmap-hdpi/ic_launcher_round.png"
convert "$SOURCE_ICON" -resize 96x96 "$ANDROID_RES_DIR/mipmap-xhdpi/ic_launcher_round.png"
convert "$SOURCE_ICON" -resize 144x144 "$ANDROID_RES_DIR/mipmap-xxhdpi/ic_launcher_round.png"
convert "$SOURCE_ICON" -resize 192x192 "$ANDROID_RES_DIR/mipmap-xxxhdpi/ic_launcher_round.png"

echo "✅ Icon generation complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npx cap sync' to sync assets"
echo "2. Build your app with 'npx cap run ios' or 'npx cap run android'"
