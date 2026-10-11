plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Kingdom for Android TV / Google TV (TCL C6K, Android TV 12). The interface is the web build in
// src/main/assets/www (npm run build:android); video plays in ExoPlayer behind the transparent WebView.
android {
    namespace = "com.kingdom.player"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.kingdom.player"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Sideloaded personal build: signed with this machine's debug key so updates install over it.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.media3:media3-exoplayer:1.5.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.5.1")
    // Software AC3/E-AC3/DTS/TrueHD for TVs whose platform decoders lack them (Jellyfin's prebuilt FFmpeg extension).
    implementation("org.jellyfin.media3:media3-ffmpeg-decoder:1.5.0+1")
}
