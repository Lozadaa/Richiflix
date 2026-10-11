package com.kingdom.player

import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.SurfaceView
import android.view.View
import android.webkit.JavascriptInterface
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.common.text.CueGroup
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * ExoPlayer behind the transparent WebView, driven by src/androidAVPlay.js (an AVPlay-shaped facade, so the page's
 * Player runs the Samsung code path). Hardware decoders, HEVC and AC3/E-AC3 (passthrough to a soundbar when the TV
 * offers it) come from the platform; IPTV over HTTP, HLS and MPEG-TS are handled natively.
 * Events go back as window.__kingdomPlayer(type, json).
 */
@OptIn(UnstableApi::class)
class NativePlayer(
    private val activity: MainActivity,
    private val surface: SurfaceView,
    private val userAgent: String,
    private val send: (String, JSONObject) -> Unit,
) {
    private val main = Handler(Looper.getMainLooper())
    private var player: ExoPlayer? = null
    private var reportedReady = false
    private var pendingSeek = false
    private var subtitles = false
    @Volatile private var tracksJson = "[]"
    private var lastTrackGroups: List<Tracks.Group> = emptyList()

    private val ticker = object : Runnable {
        override fun run() {
            val exo = player ?: return
            if (exo.isPlaying) send("time", JSONObject().put("position", exo.currentPosition).put("duration", durationOf(exo)))
            main.postDelayed(this, 250)
        }
    }

    private fun durationOf(exo: ExoPlayer) = exo.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: 0L

    private val listener = object : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) {
            val exo = player ?: return
            when (state) {
                Player.STATE_BUFFERING -> send("buffering", JSONObject())
                Player.STATE_READY -> {
                    if (!reportedReady) {
                        reportedReady = true
                        send("ready", JSONObject().put("duration", durationOf(exo)))
                    } else send("buffered", JSONObject())
                    if (pendingSeek) { pendingSeek = false; send("seeked", JSONObject()) }
                }
                Player.STATE_ENDED -> send("ended", JSONObject())
                else -> Unit
            }
        }

        override fun onPositionDiscontinuity(old: Player.PositionInfo, new: Player.PositionInfo, reason: Int) {
            // A seek inside the buffer never passes through BUFFERING: confirm it here.
            if (reason == Player.DISCONTINUITY_REASON_SEEK && pendingSeek && player?.playbackState == Player.STATE_READY) {
                pendingSeek = false
                send("seeked", JSONObject())
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) = activity.keepScreenOn(isPlaying)

        override fun onPlayerError(error: PlaybackException) {
            // The HTTP status helps tell a dead channel (404) from an account limit (403, 458, 509…); never the URL (it has the password).
            val status = (error.cause as? androidx.media3.datasource.HttpDataSource.InvalidResponseCodeException)?.responseCode
            android.util.Log.w("KingdomPlayer", "${error.errorCodeName} status=$status")
            send("error", JSONObject().put("message", error.errorCodeName).put("status", status ?: 0))
        }

        override fun onTracksChanged(tracks: Tracks) {
            lastTrackGroups = tracks.groups
            val list = JSONArray()
            tracks.groups.forEachIndexed { groupIndex, group ->
                val type = when (group.type) {
                    C.TRACK_TYPE_AUDIO -> "AUDIO"
                    C.TRACK_TYPE_TEXT -> "TEXT"
                    else -> return@forEachIndexed
                }
                for (track in 0 until group.length) {
                    if (!group.isTrackSupported(track)) continue
                    val format = group.getTrackFormat(track)
                    // Subtitles: no codec (they arrive as parsed cues) but a forced flag; audio keeps its codec («ec-3», «mp4a…»).
                    val extra = JSONObject().put("language", format.language ?: "")
                        .put("fourCC", if (type == "TEXT") "" else format.codecs ?: format.sampleMimeType ?: "")
                        .put("forced", type == "TEXT" && format.selectionFlags and C.SELECTION_FLAG_FORCED != 0)
                    list.put(JSONObject().put("index", groupIndex * 100 + track).put("type", type).put("extra_info", extra.toString()))
                }
            }
            tracksJson = list.toString()
            // Codecs only (no URLs): tells an unsupported audio/subtitle format apart from a missing one.
            android.util.Log.i("KingdomPlayer", tracks.groups.joinToString(" | ") { group -> "type=${group.type} " + (0 until group.length).joinToString(",") { "${group.getTrackFormat(it).sampleMimeType}/${group.getTrackFormat(it).language}:${if (group.isTrackSupported(it)) "ok" else "unsupported"}" } })
        }

        override fun onCues(cueGroup: CueGroup) {
            if (!subtitles) return
            val text = cueGroup.cues.mapNotNull { it.text?.toString() }.joinToString("\n").trim()
            if (text.isNotEmpty()) send("subtitle", JSONObject().put("text", text).put("duration", 4000))
        }

        override fun onVideoSizeChanged(size: VideoSize) = fit(size)
    }

    /** Letterbox: the surface takes the video's shape, centred in the screen. */
    private fun fit(size: VideoSize) {
        val root = surface.parent as? View ?: return
        if (size.width <= 0 || size.height <= 0 || root.width <= 0 || root.height <= 0) return
        val video = size.width * size.pixelWidthHeightRatio / size.height
        val screen = root.width.toFloat() / root.height
        val width = if (video > screen) root.width else (root.height * video).roundToInt()
        val height = if (video > screen) (root.width / video).roundToInt() else root.height
        surface.layoutParams = FrameLayout.LayoutParams(max(1, width), max(1, height), Gravity.CENTER)
    }

    private fun open(url: String) {
        release()
        val http = DefaultHttpDataSource.Factory()
            .setUserAgent(userAgent)
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(30_000)
        val sources = DefaultMediaSourceFactory(DefaultDataSource.Factory(activity, http))
        // Live IPTV: start once 1.5 s is buffered, keep up to 50 s.
        val loadControl = DefaultLoadControl.Builder().setBufferDurationsMs(15_000, 50_000, 1_500, 3_000).build()
        // The TV's own decoders first (and passthrough to the soundbar); FFmpeg only for audio formats they lack.
        val renderers = DefaultRenderersFactory(activity)
            .setEnableDecoderFallback(true)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON)
        val exo = ExoPlayer.Builder(activity, renderers)
            .setMediaSourceFactory(sources)
            .setLoadControl(loadControl)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(), true)
            .setHandleAudioBecomingNoisy(true)
            .build()
        exo.setVideoSurfaceView(surface)
        val item = MediaItem.Builder().setUri(url).apply {
            if (url.substringBefore('?').endsWith(".m3u8", ignoreCase = true)) setMimeType(MimeTypes.APPLICATION_M3U8)
        }.build()
        exo.setMediaItem(item)
        // Subtitles stay off until the viewer picks a track.
        exo.trackSelectionParameters = exo.trackSelectionParameters.buildUpon().setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true).build()
        exo.addListener(listener)
        player = exo
        reportedReady = false
        pendingSeek = false
        subtitles = false
        tracksJson = "[]"
        surface.visibility = View.VISIBLE
        main.removeCallbacks(ticker)
        main.post(ticker)
    }

    private fun select(type: String, index: Int) {
        val exo = player ?: return
        val group = lastTrackGroups.getOrNull(index / 100) ?: return
        val track = index % 100
        if (track >= group.length) return
        val builder = exo.trackSelectionParameters.buildUpon().setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, track))
        if (type == "TEXT") {
            builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
            subtitles = true
        }
        exo.trackSelectionParameters = builder.build()
    }

    fun release() {
        main.removeCallbacks(ticker)
        player?.removeListener(listener)
        player?.release()
        player = null
        activity.keepScreenOn(false)
        surface.layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        surface.visibility = View.INVISIBLE
    }

    fun pauseForBackground() { player?.pause() }

    /** window.KingdomNative — every call hops to the main thread, where ExoPlayer lives. Calls into NativePlayer are
     *  qualified: inside Bridge, a bare open()/close() would resolve to the Bridge's own method and loop. */
    inner class Bridge {
        @JavascriptInterface fun open(url: String) { main.post { this@NativePlayer.open(url) } }
        @JavascriptInterface fun prepare() { main.post { player?.prepare() } }
        @JavascriptInterface fun play() { main.post { player?.play() } }
        @JavascriptInterface fun pause() { main.post { player?.pause() } }
        @JavascriptInterface fun seekTo(milliseconds: Double) { main.post { pendingSeek = true; player?.seekTo(milliseconds.toLong()) } }
        @JavascriptInterface fun stop() { main.post { player?.stop() } }
        @JavascriptInterface fun close() { main.post { this@NativePlayer.release() } }
        @JavascriptInterface fun suspend() { main.post { player?.pause() } }
        @JavascriptInterface fun restore() { main.post { player?.let { if (it.playbackState == Player.STATE_IDLE) it.prepare() } } }
        @JavascriptInterface fun tracks(): String = tracksJson
        @JavascriptInterface fun selectTrack(type: String, index: Int) { main.post { this@NativePlayer.select(type, index) } }
        @JavascriptInterface fun platform(): String = "android-tv"
        @JavascriptInterface fun exit() { main.post { activity.finish() } }
    }

    val bridge = Bridge()
}
