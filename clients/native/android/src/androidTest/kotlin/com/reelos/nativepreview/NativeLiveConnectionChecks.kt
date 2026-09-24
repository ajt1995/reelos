package com.reelos.nativepreview

import android.app.Instrumentation
import android.app.Activity
import android.os.Bundle
import com.reelos.providers.*

/** Explicit owner-authorized live check. Secret/account/file identity never leaves this process. */
internal object NativeLiveConnectionChecks {
    fun run(host: Instrumentation) {
        val results = Bundle()
        var passed = 0
        fun case(name: String, block: () -> Unit) {
            block(); passed++; results.putString(name, "passed")
            host.sendStatus(0, Bundle().apply { putString("stream", "$name: passed\n") })
        }
        var phase = "saved-connection"
        try {
            val store = ProtectedConnectionStore(host.targetContext.noBackupFilesDir.resolve("connection.bin").toPath(), AndroidCredentialProtector(host.targetContext))
            val saved = store.read() ?: throw ConnectionChanged()
            saved.use {
                val account = saved.accountId ?: throw ConnectionChanged()
                var selected: ProviderVideo? = null
                val client = TorBoxProviderClient(ProviderTransport { path, secret, auth ->
                    val response = JdkProviderTransport { reason ->
                        host.sendStatus(0, Bundle().apply { putString("stream", "Transport guard: ${reason.name}\n") })
                    }.get(path, secret, auth)
                    val expected = selected
                    if (expected != null && path.contains("/mylist?id=")) {
                        val payload = runCatching { org.json.JSONObject(response.body).opt("data") }.getOrNull()
                        val rows = if (payload is org.json.JSONArray) payload else org.json.JSONArray().apply { if (payload != null) put(payload) }
                        val row = (0 until rows.length()).mapNotNull { rows.optJSONObject(it) }.singleOrNull {
                            it.optString("id") == expected.torrentId && it.optString("hash").equals(expected.infohash, true)
                        }
                        val files = row?.optJSONArray("files")
                        val file = (0 until (files?.length() ?: 0)).mapNotNull { files?.optJSONObject(it) }.singleOrNull { it.optString("id") == expected.fileId }
                        host.sendStatus(0, Bundle().apply { putString("stream",
                            "Exact schema: status=${response.status}, chars=${response.body.length}, rows=${rows.length()}, identity=${row != null}, finished=${row?.opt("download_finished") == true}, present=${row?.opt("download_present") == true}, file=${file != null}, nameMatches=${file?.optString("name") == expected.name}, sizeMatches=${file?.optLong("size") == expected.sizeBytes}\n") })
                    }
                    if (path.contains("/requestdl?")) {
                        val root = runCatching { org.json.JSONObject(response.body) }.getOrNull()
                        val value = root?.opt("data")
                        val link = value as? String
                        val uri = link?.let { runCatching { java.net.URI(it) }.getOrNull() }
                        val safeHost = uri?.host?.takeIf { it.length <= 253 && !it.contains(String(secret), ignoreCase = true) } ?: "[redacted]"
                        host.sendStatus(0, Bundle().apply { putString("stream",
                            "Lease schema: status=${response.status}, success=${root?.opt("success") == true}, text=${link != null}, https=${uri?.scheme == "https"}, endpointHost=$safeHost, secretIncluded=${link?.contains(String(secret)) == true}, bytes=${response.body.length}\n") })
                    }
                    if (path.contains("/torrents/mylist") && !path.contains("?id=")) {
                        // Schema-only diagnostics: never print keys, names, IDs, URLs, or raw provider bodies.
                        val root = runCatching { org.json.JSONObject(response.body) }.getOrNull()
                        val rows = root?.optJSONArray("data") ?: root?.optJSONObject("data")?.optJSONArray("torrents")
                        var ids = 0; var hashes = 0; var lists = 0; var fileIds = 0; var integralSizes = 0; var files = 0
                        for (index in 0 until (rows?.length() ?: 0)) {
                            val row = rows?.optJSONObject(index) ?: continue
                            if (row.opt("id") is Number || row.opt("id") is String) ids++
                            if (Regex("[A-Fa-f0-9]{40}").matches(row.optString("hash"))) hashes++
                            row.optJSONArray("files")?.let { entries ->
                                lists++
                                for (f in 0 until entries.length()) {
                                    val file = entries.optJSONObject(f) ?: continue; files++
                                    if (file.opt("id") is Number || file.opt("id") is String) fileIds++
                                    val size = file.opt("size")
                                    if (size is Int || size is Long) integralSizes++
                                }
                            }
                        }
                        host.sendStatus(0, Bundle().apply { putString("stream",
                            "Collection schema: status=${response.status}, chars=${response.body.length}, rows=${rows?.length() ?: -1}, identified=$ids, hashes=$hashes, fileLists=$lists, files=$files, fileIds=$fileIds, integralSizes=$integralSizes\n") })
                    }
                    response
                })
                phase = "account"
                case("live-provider-account") {
                    saved.useSecret { secret -> check(client.validate(secret).id == account) }
                    check(store.isCurrent(saved.revision))
                }
                phase = "collection"
                val videos = saved.useSecret { secret -> client.page(secret, account, 0).videos }
                val video = videos.firstOrNull { it.ready } ?: throw ProviderFailure(ProviderFailureCode.NOT_READY)
                selected = video
                var lease: ProviderStream? = null
                phase = "exact-file"
                case("live-provider-exact-file") {
                    lease = saved.useSecret { secret -> client.resolve(secret, account, video) }
                    check(store.isCurrent(saved.revision))
                }
                phase = "range-bytes"
                case("live-provider-range-bytes") {
                    requireNotNull(lease).openBytes(video.sizeBytes) { store.isCurrent(saved.revision) }.use { remote ->
                            val count = minOf(video.sizeBytes, 16_384L)
                            remote.open(0, count).use { range ->
                                val buffer = ByteArray(8192)
                                var read = 0
                                while (true) { val n = range.read(buffer); if (n < 0) break; read += n }
                                check(read.toLong() == count)
                            }
                    }
                }
            }
            results.putString("stream", "Live account, exact-file and bounded range checks passed; no decoder or sustained-playback claim.\n")
            host.finish(Activity.RESULT_OK, results)
        } catch (failure: Exception) {
            val code = when (failure) {
                is ProviderFailure -> failure.code.name
                is ConnectionChanged -> "NO_CURRENT_CONNECTION"
                is ConnectionStorageFailure -> "PROTECTED_STORAGE"
                else -> "VERIFICATION_FAILED"
            }
            results.putString("stream", "Live checks failed after $passed passed at $phase ($code). No secrets or media identities logged.\n")
            host.finish(Activity.RESULT_CANCELED, results)
        }
    }
}
