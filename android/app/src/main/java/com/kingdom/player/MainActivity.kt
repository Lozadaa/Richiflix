package com.kingdom.player

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.os.SystemClock
import android.view.KeyEvent
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

/**
 * Kingdom on Google TV / Android TV. Layers, back to front: the ExoPlayer surface, then a transparent WebView with the
 * same interface as the Samsung build (src/, `npm run build:android`), served from https://appassets.androidplatform.net
 * so storage, WebCrypto and YouTube embeds behave like a normal secure site.
 */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var player: NativePlayer
    private var backArmedAt = 0L

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#0d172b")) }
        val surface = SurfaceView(this).apply { visibility = View.INVISIBLE }
        root.addView(surface, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        web = object : WebView(this) {
            // Back while the keyboard is up only closes the keyboard (the page never sees it): tell the page.
            override fun onKeyPreIme(keyCode: Int, event: KeyEvent): Boolean {
                if (keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_DOWN && keyboardShown(this)) {
                    evaluateJavascript("window.__kingdomKeyboardClosed&&window.__kingdomKeyboardClosed()", null)
                }
                return super.onKeyPreIme(keyCode, event)
            }
        }.apply { setBackgroundColor(Color.TRANSPARENT) }
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)

        // Debug builds only (assembleDebug): the interface can be inspected and driven from the PC over adb.
        WebView.setWebContentsDebuggingEnabled(applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0)
        val agent = "${WebSettings.getDefaultUserAgent(this)} KingdomAndroidTV/1.0"
        val networkAgent = "Mozilla/5.0 (Linux; Android ${android.os.Build.VERSION.RELEASE}; ${android.os.Build.MODEL}) KingdomPlayer/1.0"
        player = NativePlayer(this, surface, networkAgent) { type, data -> sendToPage(type, data) }
        val assets = WebViewAssetLoader.Builder().addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        val proxy = NetworkProxy(networkAgent)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            // The page declares width=1920 (vite --mode android): laid out like the Samsung build, scaled to the screen.
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            userAgentString = agent
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assets.shouldInterceptRequest(request.url) ?: proxy.intercept(request)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                request.url.host != "appassets.androidplatform.net"

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // The TV may reclaim the renderer under memory pressure: start over instead of crashing.
                player.release()
                recreate()
                return true
            }
        }
        web.webChromeClient = WebChromeClient()
        web.addJavascriptInterface(player.bridge, "KingdomNative")
        web.isFocusable = true
        web.isFocusableInTouchMode = true
        if (savedInstanceState == null) web.loadUrl("https://appassets.androidplatform.net/www/index.html")
        web.requestFocus()
    }

    private fun sendToPage(type: String, data: JSONObject) {
        runOnUiThread { web.evaluateJavascript("window.__kingdomPlayer&&window.__kingdomPlayer('$type',${JSONObject.quote(data.toString())})", null) }
    }

    private fun keyboardShown(view: View): Boolean =
        android.os.Build.VERSION.SDK_INT < 30 || view.rootWindowInsets?.isVisible(android.view.WindowInsets.Type.ime()) == true

    fun keepScreenOn(on: Boolean) = runOnUiThread {
        if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    /** D-pad and OK reach the WebView as arrow keys and Enter; Back and the media keys go to the page as remote names. */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if ((event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER || event.keyCode == KeyEvent.KEYCODE_ENTER) && event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            // OK on a text field at rest starts typing: the page refocuses it for editing and the WebView opens the keyboard
            // (src/platform.js). Anywhere else the page gets its usual Enter.
            web.evaluateJavascript("window.__kingdomOk&&window.__kingdomOk()", null)
        }
        val name = when (event.keyCode) {
            KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_ESCAPE -> "Back"
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_HEADSETHOOK -> "MediaPlayPause"
            KeyEvent.KEYCODE_MEDIA_PLAY -> "MediaPlay"
            KeyEvent.KEYCODE_MEDIA_PAUSE -> "MediaPause"
            KeyEvent.KEYCODE_MEDIA_STOP -> "MediaStop"
            KeyEvent.KEYCODE_MEDIA_REWIND -> "MediaRewind"
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "MediaFastForward"
            KeyEvent.KEYCODE_CHANNEL_UP -> "ChannelUp"
            KeyEvent.KEYCODE_CHANNEL_DOWN -> "ChannelDown"
            else -> return super.dispatchKeyEvent(event)
        }
        if (event.action == KeyEvent.ACTION_DOWN && (event.repeatCount == 0 || name != "Back")) {
            web.evaluateJavascript("window.__kingdomRemote?window.__kingdomRemote('$name'):'unhandled'") { result ->
                if (name == "Back" && result?.contains("unhandled") == true) unhandledBack()
            }
        }
        return true
    }

    /** Back with nothing left to close: a second Back within 2.5 s leaves the app (Android TV convention). */
    private fun unhandledBack() {
        val now = SystemClock.uptimeMillis()
        if (now - backArmedAt < 2_500) finish()
        else {
            backArmedAt = now
            Toast.makeText(this, R.string.back_to_exit, Toast.LENGTH_SHORT).show()
        }
    }

    override fun onPause() {
        super.onPause()
        player.pauseForBackground()
        web.onPause()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onDestroy() {
        player.release()
        web.destroy()
        super.onDestroy()
    }
}
