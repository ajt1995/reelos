package com.reelos.ui.shared

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.os.Build
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.webkit.WebViewAssetLoader
import com.reelos.core.offline.StandaloneNodeApi
import com.reelos.ui.mobile.MobilePlayerActivity
import com.reelos.ui.tv.TvPlayerActivity
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.net.URLConnection

abstract class SharedReelOsActivity : ComponentActivity() {
    protected open val tvMode: Boolean = false
    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private lateinit var nodeApi: StandaloneNodeApi

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val packagedAssets = WebViewAssetLoader.AssetsPathHandler(this)
        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/") { path ->
                packagedAssets.handle(if (path.startsWith("reelos/")) path else "reelos/assets/$path")
            }
            .build()
        nodeApi = StandaloneNodeApi(this, tvMode)
        webView = WebView(this).apply {
            setBackgroundColor(android.graphics.Color.BLACK)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.textZoom = 100
            settings.userAgentString = "${settings.userAgentString} ReelOSAndroid/${if (tvMode) "tv" else "mobile"}"
            webChromeClient = WebChromeClient()
            webViewClient = SharedClient()
            addJavascriptInterface(NativeBridge(), "ReelOSNative")
            isFocusable = true
            isFocusableInTouchMode = true
            overScrollMode = View.OVER_SCROLL_NEVER
            isHorizontalScrollBarEnabled = false
            isVerticalScrollBarEnabled = false
            if (tvMode && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
            }
        }
        setContentView(webView)
        webView.loadUrl(APP_ORIGIN)
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.onResume()
    }

    override fun onPause() {
        if (::webView.isInitialized) webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.removeJavascriptInterface("ReelOSNative")
            webView.destroy()
        }
        super.onDestroy()
    }

    @Deprecated("Android framework callback")
    override fun onBackPressed() {
        if (!::webView.isInitialized) {
            super.onBackPressed()
            return
        }
        webView.evaluateJavascript(NATIVE_BACK_BRIDGE) { handled ->
            if (handled != "true") runOnUiThread { performSystemBack() }
        }
    }

    @Suppress("DEPRECATION")
    private fun performSystemBack() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    private inner class SharedClient : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest): WebResourceResponse? {
            assetLoader.shouldInterceptRequest(request.url)?.let { return it }
            if (request.url.host != APP_HOST) return null
            val path = request.url.path.orEmpty()
            if (path.startsWith("/api/")) return nativeApi(request.url.toString(), request.method)
            packagedAsset(path)?.let { return it }
            return asset("reelos/index.html", "text/html")
        }

        override fun onPageFinished(view: WebView, url: String) {
            val state = JSONObject()
                .put("platform", if (tvMode) "android-tv" else "android")
                .put("sharedUi", true)
                .put("node", true)
                .put("homeOptional", true)
            view.evaluateJavascript(
                "window.__REELOS_NATIVE__=${state};window.dispatchEvent(new CustomEvent('reelos:native-ready',{detail:window.__REELOS_NATIVE__}));",
                null,
            )
            view.evaluateJavascript(NATIVE_FETCH_BRIDGE, null)
            if (tvMode) view.evaluateJavascript(TV_NAVIGATION_BRIDGE, null)
        }
    }

    private fun nativeApi(url: String, method: String): WebResourceResponse {
        val response = nodeApi.request(url, method)
        return bytes("application/json", response.body.toByteArray(), response.status)
    }

    private fun asset(path: String, mime: String): WebResourceResponse = assets.open(path).use {
        val cacheControl = if (path.endsWith("/index.html")) "no-cache" else "public, max-age=31536000, immutable"
        bytes(mime, it.readBytes(), cacheControl = cacheControl)
    }

    /** Serve only files inside the packaged shared UI; routes still fall back to index.html. */
    private fun packagedAsset(rawPath: String): WebResourceResponse? {
        val path = rawPath.trimStart('/')
        if (path.isBlank() || path.split('/').any { it == ".." }) return null
        return runCatching {
            asset("reelos/$path", mimeType(path))
        }.getOrNull()
    }

    private fun mimeType(path: String): String = when (path.substringAfterLast('.', "").lowercase()) {
        "js", "mjs" -> "application/javascript"
        "css" -> "text/css"
        "json", "map" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "gif" -> "image/gif"
        "woff" -> "font/woff"
        "woff2" -> "font/woff2"
        "ttf" -> "font/ttf"
        "mp4" -> "video/mp4"
        "webm" -> "video/webm"
        else -> URLConnection.guessContentTypeFromName(path) ?: "application/octet-stream"
    }

    private fun bytes(
        mime: String,
        value: ByteArray,
        status: Int = 200,
        cacheControl: String = "no-store",
    ): WebResourceResponse = WebResourceResponse(
        mime,
        "UTF-8",
        status,
        if (status == 200) "OK" else "Service Unavailable",
        mapOf("Cache-Control" to cacheControl, "X-ReelOS-Platform" to "android"),
        ByteArrayInputStream(value),
    )

    inner class NativeBridge {
        @JavascriptInterface fun platform(): String = if (tvMode) "android-tv" else "android"

        @JavascriptInterface fun capabilities(): String = JSONObject()
            .put("sharedUi", true)
            .put("nativePlayback", true)
            .put("localStorage", true)
                .put("sharedComputeStage", "local")
                .put("householdSynchronization", "discoverable")
            .toString()

        @JavascriptInterface fun request(method: String, url: String, body: String): String {
            val response = nodeApi.request(url, method, body)
            return JSONObject().put("status", response.status).put("body", response.body).toString()
        }

        @JavascriptInterface fun play(url: String, title: String) {
            if (!url.startsWith("https://") && !url.startsWith("content://")) return
            runOnUiThread {
                startActivity(Intent(this@SharedReelOsActivity, if (tvMode) TvPlayerActivity::class.java else MobilePlayerActivity::class.java).apply {
                    putExtra("item_id", url.hashCode().toString())
                    putExtra("title", title.take(200))
                    putExtra("stream_url", url)
                })
            }
        }
    }

    private companion object {
        const val APP_HOST = "appassets.androidplatform.net"
        const val APP_ORIGIN = "https://appassets.androidplatform.net/"
        val NATIVE_FETCH_BRIDGE = """
            (() => {
              if (window.__REELOS_NATIVE_FETCH_INSTALLED__) return;
              window.__REELOS_NATIVE_FETCH_INSTALLED__ = true;
              const networkFetch = window.fetch.bind(window);
              window.fetch = async (input, init = {}) => {
                const rawUrl = typeof input === 'string' ? input : input.url;
                const url = new URL(rawUrl, window.location.href);
                if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
                  const method = String(init.method || (typeof input === 'string' ? 'GET' : input.method) || 'GET').toUpperCase();
                  // Let WebViewClient serve reads off the JavaScript/UI thread. Only
                  // mutations need the bridge because shouldInterceptRequest has no body.
                  if (method === 'GET' || method === 'HEAD') return networkFetch(input, init);
                  const body = typeof init.body === 'string' ? init.body : '';
                  const native = JSON.parse(window.ReelOSNative.request(method, url.pathname + url.search, body));
                  return new Response(native.body, { status: native.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
                }
                return networkFetch(input, init);
              };
            })();
        """.trimIndent()
        val TV_NAVIGATION_BRIDGE = """
            (() => {
              if (window.__REELOS_TV_NAVIGATION_INSTALLED__) return;
              window.__REELOS_TV_NAVIGATION_INSTALLED__ = true;
              document.documentElement.classList.add('reelos-native-tv');

              const style = document.createElement('style');
              style.id = 'reelos-native-tv-performance';
              style.textContent = `
                html.reelos-native-tv, html.reelos-native-tv body { overscroll-behavior: none; }
                html.reelos-native-tv [class*="backdrop-blur"] {
                  -webkit-backdrop-filter: none !important;
                  backdrop-filter: none !important;
                }
                html.reelos-native-tv .reelos-profile-aura {
                  inset: 0 !important;
                  filter: none !important;
                  mix-blend-mode: normal !important;
                  will-change: opacity, transform;
                  animation: reelos-tv-aura 10s ease-in-out infinite alternate !important;
                }
                html.reelos-native-tv .reelos-art-haze,
                html.reelos-native-tv .reelos-taste-glow,
                html.reelos-native-tv .reelos-endless-taste-bubble img {
                  animation: none !important;
                }
                html.reelos-native-tv .reelos-setup-orb {
                  filter: none !important;
                  will-change: opacity, transform;
                  animation: reelos-tv-orb 9s ease-in-out infinite alternate !important;
                }
                html.reelos-native-tv .reelos-tv-living-art {
                  will-change: transform;
                  animation: reelos-tv-living-art 22s ease-in-out infinite alternate !important;
                }
                html.reelos-native-tv .reelos-falling-art > div {
                  animation-timing-function: steps(36, end) !important;
                }
                @keyframes reelos-tv-aura {
                  from { opacity: 0.22; transform: scale(0.98); }
                  to { opacity: 0.38; transform: scale(1.03); }
                }
                @keyframes reelos-tv-orb {
                  from { opacity: 0.18; transform: translate3d(-1.5%, -1%, 0) scale(0.96); }
                  to { opacity: 0.3; transform: translate3d(1.5%, 1%, 0) scale(1.04); }
                }
                @keyframes reelos-tv-living-art {
                  from { transform: scale(1); }
                  to { transform: scale(1.035); }
                }
                html.reelos-native-tv.reelos-tv-navigating *,
                html.reelos-native-tv.reelos-tv-navigating *::before,
                html.reelos-native-tv.reelos-tv-navigating *::after {
                  animation-play-state: paused !important;
                  transition-duration: 90ms !important;
                }
              `;
              document.head.appendChild(style);

              const selector = [
                'button:not([disabled])', 'a[href]', 'input:not([disabled])',
                'select:not([disabled])', 'textarea:not([disabled])',
                '[tabindex]:not([tabindex="-1"]):not([disabled])'
              ].join(',');
              let cached = [];
              let dirty = true;
              let navigatingTimer = 0;

              const visible = (element) => {
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== 'none' && style.visibility !== 'hidden' &&
                  Number(style.opacity) > 0.02 && rect.width >= 8 && rect.height >= 8;
              };
              const focusables = () => {
                if (dirty) {
                  cached = Array.from(document.querySelectorAll(selector)).filter(visible);
                  dirty = false;
                }
                return cached;
              };
              const markNavigating = () => {
                document.documentElement.classList.add('reelos-tv-navigating');
                clearTimeout(navigatingTimer);
                navigatingTimer = setTimeout(() => {
                  document.documentElement.classList.remove('reelos-tv-navigating');
                }, 420);
              };
              const center = (rect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
              const move = (key) => {
                const choices = focusables();
                if (!choices.length) return false;
                const active = document.activeElement;
                if (!choices.includes(active)) {
                  choices[0].focus({ preventScroll: true });
                  choices[0].scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
                  return true;
                }
                if (active.matches('select, textarea, input[type="range"], [role="slider"], [contenteditable="true"]')) return false;
                if (active.matches('input') && (key === 'ArrowLeft' || key === 'ArrowRight')) return false;
                const originRect = active.getBoundingClientRect();
                const origin = center(originRect);
                const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
                const sign = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
                let best = null;
                let bestScore = Infinity;
                for (const candidate of choices) {
                  if (candidate === active) continue;
                  const point = center(candidate.getBoundingClientRect());
                  const primary = (horizontal ? point.x - origin.x : point.y - origin.y) * sign;
                  if (primary <= 2) continue;
                  const cross = Math.abs(horizontal ? point.y - origin.y : point.x - origin.x);
                  const score = primary + cross * 0.42 + (cross > primary * 1.8 ? 10000 : 0);
                  if (score < bestScore) { best = candidate; bestScore = score; }
                }
                if (!best) return false;
                best.focus({ preventScroll: true });
                best.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
                return true;
              };

              addEventListener('keydown', (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                if (!move(event.key)) return;
                markNavigating();
                event.preventDefault();
                event.stopImmediatePropagation();
              }, true);

              const observer = new MutationObserver(() => {
                dirty = true;
                const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
                if (dialog && !dialog.contains(document.activeElement)) {
                  const first = Array.from(dialog.querySelectorAll(selector)).find(visible);
                  if (first) requestAnimationFrame(() => first.focus({ preventScroll: true }));
                }
              });
              observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'tabindex'] });
              setTimeout(() => {
                if (document.activeElement === document.body) {
                  const initial = document.querySelector('[aria-current="page"], main button:not([disabled]), main a[href]');
                  if (initial && visible(initial)) initial.focus({ preventScroll: true });
                }
              }, 120);
            })();
        """.trimIndent()
        val NATIVE_BACK_BRIDGE = """
            (() => {
              const overlay = document.querySelector('[role="dialog"][aria-modal="true"]');
              if (!overlay) return false;
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
              return true;
            })();
        """.trimIndent()
    }
}
