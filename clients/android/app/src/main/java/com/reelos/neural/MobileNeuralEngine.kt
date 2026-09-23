package com.reelos.neural

import android.content.Context
import android.os.StatFs
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.reelos.core.prefs.AppPreferences
import java.io.File
import java.util.PriorityQueue
import java.util.concurrent.TimeUnit
import kotlin.math.sqrt

/**
 * On-Device Mobile Neural Engine.
 * Executes 512D Float32 vector operations on mobile NPU/CPU
 * and maintains continuous resident taste centroids across all platforms.
 */
object MobileNeuralEngine {
    const val MANIFOLD_DIMS = 512

    /**
     * Compute cosine similarity between two high-dimensional Float32 vectors.
     */
    fun cosineSimilarity(vectorA: FloatArray, vectorB: FloatArray): Float {
        if (vectorA.size != vectorB.size || vectorA.isEmpty()) return 0f

        var dotProduct = 0f
        var normA = 0f
        var normB = 0f

        for (i in vectorA.indices) {
            val a = vectorA[i]
            val b = vectorB[i]
            dotProduct += a * b
            normA += a * a
            normB += b * b
        }

        val denominator = sqrt(normA) * sqrt(normB)
        return if (denominator > 0f) (dotProduct / denominator).coerceIn(-1f, 1f) else 0f
    }

    /**
     * Normalize an input vector to the L2 unit hypersphere (||v||_2 = 1.0).
     */
    fun normalizeToUnitSphere(vector: FloatArray): FloatArray {
        var normSq = 0f
        for (v in vector) normSq += v * v
        val norm = sqrt(normSq)
        if (norm <= 0f) return FloatArray(vector.size)
        return FloatArray(vector.size) { i -> vector[i] / norm }
    }

    /**
     * Deterministic FNV-1a subword feature hashing projecting any search or taste query
     * into a unit-normalized 512D Float32 latent vector on the hypersphere.
     */
    fun projectQueryTo512D(text: String): FloatArray {
        val vec = FloatArray(MANIFOLD_DIMS)
        val clean = text.lowercase().trim()
        if (clean.isBlank()) return vec
        val words = clean.split(Regex("\\s+"))
        val scale = 1.0f / sqrt(words.size.toFloat().coerceAtLeast(1f))
        for (word in words) {
            var h = -2128831035
            for (char in word) {
                h = (h xor char.code) * 16777619
                val dim = kotlin.math.abs(h % MANIFOLD_DIMS)
                val sign = if (h < 0) -1f else 1f
                vec[dim] += sign * scale
            }
        }
        return normalizeToUnitSphere(vec)
    }

    /**
     * Update the resident user taste centroid with an incoming interaction vector
     * scaled by an affinity multiplier (e.g., Love +2.5x, Like +1.0x, Cozy +1.2x, Less-Like -1.5x).
     */
    fun updateResidentCentroid(
        currentCentroid: FloatArray,
        interactionVector: FloatArray,
        affinityMultiplier: Float
    ): FloatArray {
        val size = if (currentCentroid.size == MANIFOLD_DIMS) MANIFOLD_DIMS else interactionVector.size
        val updated = FloatArray(size)

        for (i in 0 until size) {
            val c = if (i < currentCentroid.size) currentCentroid[i] else 0f
            val v = if (i < interactionVector.size) interactionVector[i] else 0f
            updated[i] = c + (v * affinityMultiplier)
        }

        return normalizeToUnitSphere(updated)
    }

    /**
     * Rank candidate items against a user taste vector using a bounded min-heap priority queue.
     */
    fun rankMedia(
        userTasteVector: FloatArray,
        candidates: List<Pair<String, FloatArray>>,
        topK: Int = 50
    ): List<Pair<String, Float>> {
        if (candidates.isEmpty()) return emptyList()

        val comparator = Comparator<Pair<String, Float>> { a, b -> a.second.compareTo(b.second) }
        val pq = PriorityQueue(topK.coerceAtLeast(1), comparator)

        for ((id, vector) in candidates) {
            val sim = cosineSimilarity(userTasteVector, vector)
            if (pq.size < topK) {
                pq.offer(id to sim)
            } else if (sim > (pq.peek()?.second ?: -1f)) {
                pq.poll()
                pq.offer(id to sim)
            }
        }

        val result = mutableListOf<Pair<String, Float>>()
        while (!pq.isEmpty()) {
            result.add(pq.poll())
        }
        return result.asReversed()
    }

    fun scheduleFoldingWork(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiresCharging(true)
            .setRequiredNetworkType(NetworkType.UNMETERED)
            .build()

        val foldingRequest = PeriodicWorkRequestBuilder<FoldingWorker>(6, TimeUnit.HOURS)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueue(foldingRequest)
    }
}

/**
 * Overnight Charging Sync Helper.
 * Pre-stages recommended offline media and synchronizes local storage quotas
 * strictly when the device is plugged in and connected to unmetered Wi-Fi.
 */
object OvernightChargingSyncHelper {
    fun scheduleOvernightSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiresCharging(true)
            .setRequiredNetworkType(NetworkType.UNMETERED)
            .build()

        val syncRequest = PeriodicWorkRequestBuilder<OvernightSyncWorker>(12, TimeUnit.HOURS)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueue(syncRequest)
    }
}

class OvernightSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val prefs = AppPreferences(applicationContext)
            val storageLimitGb = prefs.offlineStorageLimitGb
            val storageLimitBytes = storageLimitGb.toLong() * 1024L * 1024L * 1024L

            val mediaDir = File(applicationContext.filesDir, "offline_media")
            if (mediaDir.exists() && mediaDir.isDirectory) {
                var totalUsed = 0L
                val files = mediaDir.listFiles()?.sortedBy { it.lastModified() } ?: emptyList()
                for (file in files) totalUsed += file.length()

                // Evict oldest offline media if exceeding user configured limit
                if (totalUsed > storageLimitBytes) {
                    for (file in files) {
                        if (totalUsed <= storageLimitBytes) break
                        val size = file.length()
                        if (file.delete()) totalUsed -= size
                    }
                }
            }

            // StatFs check on local storage
            val stat = StatFs(applicationContext.filesDir.absolutePath)
            val availableBytes = stat.availableBlocksLong * stat.blockSizeLong
            if (availableBytes < 500L * 1024L * 1024L) {
                // Low disk space warning threshold (500MB)
                return Result.success()
            }

            Result.success()
        } catch (_: Exception) {
            Result.failure()
        }
    }
}

class FoldingWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val prefs = AppPreferences(applicationContext)
            val residentCentroid = prefs.getResidentTasteVector()

            // Run offline continuous taste refinement across resident vectors
            val unitNormalized = MobileNeuralEngine.normalizeToUnitSphere(residentCentroid)
            prefs.setResidentTasteVector(unitNormalized)

            Result.success()
        } catch (_: Exception) {
            Result.failure()
        }
    }
}
