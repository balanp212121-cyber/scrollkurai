#!/bin/bash

# ScrollKurai Splash Screen Generation Script
# Prerequisites: ImageMagick (install via: brew install imagemagick on macOS)

SOURCE_ICON="resources/icon.png"
SPLASH_BG="#0a0a0a"

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

echo "🎨 Generating ScrollKurai splash screens..."

# Create a centered splash with logo on dark background
create_splash() {
    local size=$1
    local output=$2
    local logo_size=$((size / 3))
    
    convert -size ${size}x${size} xc:"$SPLASH_BG" \
        \( "$SOURCE_ICON" -resize ${logo_size}x${logo_size} \) \
        -gravity center -composite \
        "$output"
}

# ============================================
# iOS Splash Screens
# ============================================
IOS_SPLASH_DIR="ios/App/App/Assets.xcassets/Splash.imageset"
mkdir -p "$IOS_SPLASH_DIR"

echo "📱 Generating iOS splash screens..."
create_splash 2732 "$IOS_SPLASH_DIR/splash-2732x2732.png"

# ============================================
# Android Splash Screens
# ============================================
echo "🤖 Generating Android splash screens..."

ANDROID_RES_DIR="android/app/src/main/res"

# Portrait splash screens
mkdir -p "$ANDROID_RES_DIR/drawable"
mkdir -p "$ANDROID_RES_DIR/drawable-port-mdpi"
mkdir -p "$ANDROID_RES_DIR/drawable-port-hdpi"
mkdir -p "$ANDROID_RES_DIR/drawable-port-xhdpi"
mkdir -p "$ANDROID_RES_DIR/drawable-port-xxhdpi"
mkdir -p "$ANDROID_RES_DIR/drawable-port-xxxhdpi"

# Landscape splash screens
mkdir -p "$ANDROID_RES_DIR/drawable-land-mdpi"
mkdir -p "$ANDROID_RES_DIR/drawable-land-hdpi"
mkdir -p "$ANDROID_RES_DIR/drawable-land-xhdpi"
mkdir -p "$ANDROID_RES_DIR/drawable-land-xxhdpi"
mkdir -p "$ANDROID_RES_DIR/drawable-land-xxxhdpi"

# Create portrait splash screens (width x height)
create_portrait_splash() {
    local width=$1
    local height=$2
    local output=$3
    local logo_size=$((width / 2))
    
    convert -size ${width}x${height} xc:"$SPLASH_BG" \
        \( "$SOURCE_ICON" -resize ${logo_size}x${logo_size} \) \
        -gravity center -composite \
        "$output"
}

# Create landscape splash screens
create_landscape_splash() {
    local width=$1
    local height=$2
    local output=$3
    local logo_size=$((height / 2))
    
    convert -size ${width}x${height} xc:"$SPLASH_BG" \
        \( "$SOURCE_ICON" -resize ${logo_size}x${logo_size} \) \
        -gravity center -composite \
        "$output"
}

# Default drawable
create_portrait_splash 480 800 "$ANDROID_RES_DIR/drawable/splash.png"

# Portrait sizes
create_portrait_splash 320 480 "$ANDROID_RES_DIR/drawable-port-mdpi/splash.png"
create_portrait_splash 480 800 "$ANDROID_RES_DIR/drawable-port-hdpi/splash.png"
create_portrait_splash 720 1280 "$ANDROID_RES_DIR/drawable-port-xhdpi/splash.png"
create_portrait_splash 960 1600 "$ANDROID_RES_DIR/drawable-port-xxhdpi/splash.png"
create_portrait_splash 1280 1920 "$ANDROID_RES_DIR/drawable-port-xxxhdpi/splash.png"

# Landscape sizes
create_landscape_splash 480 320 "$ANDROID_RES_DIR/drawable-land-mdpi/splash.png"
create_landscape_splash 800 480 "$ANDROID_RES_DIR/drawable-land-hdpi/splash.png"
create_landscape_splash 1280 720 "$ANDROID_RES_DIR/drawable-land-xhdpi/splash.png"
create_landscape_splash 1600 960 "$ANDROID_RES_DIR/drawable-land-xxhdpi/splash.png"
create_landscape_splash 1920 1280 "$ANDROID_RES_DIR/drawable-land-xxxhdpi/splash.png"

echo "✅ Splash screen generation complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npx cap sync' to sync assets"
echo "2. Build your app with 'npx cap run ios' or 'npx cap run android'"
