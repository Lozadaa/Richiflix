package com.kingdom.player

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * The page's API traffic (IPTV panels over plain HTTP, ESPN, MLB, the trailer bridge) is fetched natively and answered
 * with permissive CORS headers. On Samsung the widget's <access origin="*"> does this; in a WebView served from
 * https://appassets.androidplatform.net those providers would fail CORS or mixed content, and ESPN's edge rejects
 * some browser user agents. Media, YouTube and TMDB images keep the WebView's own network stack.
 */
class NetworkProxy(private val userAgent: String) {
    private val passthrough = listOf(
        "appassets.androidplatform.net",
        "youtube.com", "youtube-nocookie.com", "ytimg.com", "googlevideo.com", "google.com", "gstatic.com",
        "googleapis.com", "doubleclick.net", "image.tmdb.org", "api.themoviedb.org",
    )
    private val forwarded = setOf("accept", "accept-language", "range", "authorization", "if-none-match", "if-modified-since")
    private val exposed = setOf("content-length", "content-range", "accept-ranges", "cache-control", "last-modified", "etag", "date")

    fun intercept(request: WebResourceRequest): WebResourceResponse? {
        val url = request.url
        val scheme = url.scheme ?: return null
        if (scheme != "http" && scheme != "https") return null
        val host = url.host ?: return null
        if (passthrough.any { host == it || host.endsWith(".$it") }) return null
        if (request.method.equals("OPTIONS", true)) return empty(204, "No Content")
        if (!request.method.equals("GET", true)) return null
        // src/polyfills.js sends plain-HTTP API calls as https://kingdom.proxy/http/<host>/<path>: map them back.
        val target = if (host == "kingdom.proxy") "http://" + url.toString().substringAfter("://kingdom.proxy/http/") else url.toString()
        return try {
            fetch(target, request.requestHeaders)
        } catch (error: Exception) {
            empty(502, "Bad Gateway")
        }
    }

    private fun fetch(start: String, headers: Map<String, String>): WebResourceResponse {
        var address = start
        var redirects = 0
        while (true) {
            val connection = URL(address).openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 15_000
            connection.readTimeout = 45_000
            // No Origin/Referer/Sec-* (not a browser request any more) and no Accept-Encoding: HttpURLConnection
            // then negotiates gzip itself and hands back plain bytes, which the WebView expects.
            for ((name, value) in headers) if (name.lowercase() in forwarded) connection.setRequestProperty(name, value)
            connection.setRequestProperty("User-Agent", userAgent)
            val code = connection.responseCode
            if (code in 300..399 && redirects < 8) {
                val location = connection.getHeaderField("Location")
                if (location != null) {
                    address = URL(URL(address), location).toString()
                    redirects++
                    connection.disconnect()
                    continue
                }
            }
            val type = connection.contentType ?: "application/octet-stream"
            val mime = type.substringBefore(';').trim().ifEmpty { "application/octet-stream" }
            val charset = Regex("charset=([^;]+)", RegexOption.IGNORE_CASE).find(type)?.groupValues?.get(1)?.trim()
            val responseHeaders = cors().toMutableMap()
            for ((name, values) in connection.headerFields) {
                if (name != null && values.isNotEmpty() && name.lowercase() in exposed) responseHeaders[name] = values.joinToString(", ")
            }
            val body = if (code >= 400) connection.errorStream ?: ByteArrayInputStream(ByteArray(0)) else connection.inputStream
            val reason = connection.responseMessage?.takeIf { it.isNotBlank() } ?: "OK"
            return WebResourceResponse(mime, charset, if (code in 300..399) 502 else code, reason, responseHeaders, body)
        }
    }

    private fun empty(code: Int, reason: String) = WebResourceResponse("text/plain", "utf-8", code, reason, cors(), ByteArrayInputStream(ByteArray(0)))

    private fun cors() = mapOf(
        "Access-Control-Allow-Origin" to "*",
        "Access-Control-Allow-Headers" to "*",
        "Access-Control-Allow-Methods" to "GET, OPTIONS",
        "Access-Control-Expose-Headers" to "*",
    )
}
