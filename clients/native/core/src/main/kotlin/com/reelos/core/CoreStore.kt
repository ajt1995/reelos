package com.reelos.core

import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.FileOutputStream
import java.nio.channels.FileChannel
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption
import java.util.Collections
import java.util.ConcurrentModificationException

/** Versioned storage boundary. Implementations must reject unsupported versions. */
interface CoreStore {
    val schemaVersion: Int get() = CORE_SCHEMA_VERSION
    fun load(): CoreState
    fun save(state: CoreState)
}

class MemoryCoreStore(initial: CoreState = CoreState()) : CoreStore {
    private var state = validateCoreState(initial)
    override fun load(): CoreState = state
    override fun save(state: CoreState) {
        val next = validateCoreState(state)
        if (next.revision != Math.addExact(this.state.revision, 1)) {
            throw ConcurrentModificationException("Stale core revision")
        }
        this.state = next
    }
}

/**
 * Durable local snapshot. A same-directory temporary file is synced and atomically replaces the
 * previous snapshot; filesystems without atomic replacement fail the write. It stores no
 * credentials, tokens, or PINs. The caller selects
 * a private application-data path and is responsible for OS-level file permissions and backups.
 */
class FileCoreStore(private val path: Path) : CoreStore {
    override fun load(): CoreState {
        if (!Files.exists(path)) return CoreState()
        DataInputStream(Files.newInputStream(path)).use { input ->
            require(input.readInt() == MAGIC) { "Not a ReelOS core snapshot" }
            val version = input.readInt()
            require(version in 1..schemaVersion) { "Unsupported core state version: $version" }
            val revision = input.readLong()
            val profiles = readMap(input) {
                val id = input.readUTF()
                id to ProfileState(
                    id = id,
                    name = input.readUTF(),
                    color = input.readUTF(),
                    onboardingStep = enumValueOf<OnboardingStep>(input.readUTF()),
                    guidance = enumValueOf<GuidanceLevel>(input.readUTF()),
                    tasteSeeds = readSet(input),
                    positiveReactions = readMap(input) { input.readUTF() to enumValueOf<ReactionKind>(input.readUTF()) },
                    dismissedIds = readSet(input),
                    lessLikeIds = readSet(input),
                    savedMediaIds = readSet(input),
                    playbackPositionsMs = readMap(input) { input.readUTF() to input.readLong() },
                    readingPositions = readMap(input) { input.readUTF() to input.readUTF() },
                    motionMode = if (version >= 4) enumValueOf<MotionMode>(input.readUTF()) else MotionMode.SUBTLE,
                    browsingDensity = if (version >= 4) enumValueOf<BrowsingDensity>(input.readUTF()) else BrowsingDensity.COMFORTABLE,
                    transparencyEnabled = if (version >= 4) input.readBoolean() else true,
                )
            }
            val activeId = readNullable(input)
            val requestedHomeId = readNullable(input)
            val sources = readMap(input) {
                val id = input.readUTF()
                id to SourceRecord(id, enumValueOf<SourceKind>(input.readUTF()), enumValueOf<SourceStatus>(input.readUTF()))
            }
            val media = readMap(input) {
                val id = input.readUTF()
                id to MediaRecord(id, input.readUTF(), readNullable(input), enumValueOf<MediaAvailability>(input.readUTF()))
            }
            val legacyOrHandoffFlag = if (version >= 2) input.readBoolean() else false
            // Legacy blanket provider consent is not consent to external-app experiments.
            val handoffsEnabled = version >= 3 && legacyOrHandoffFlag
            require(input.read() == -1) { "Unexpected trailing core data" }
            require(activeId == null || activeId in profiles) { "Active profile is missing" }
            val migratedSources = if (version < 3) sources.mapValues { (_, source) ->
                if (source.kind == SourceKind.OPTIONAL_ADAPTER && source.status == SourceStatus.AVAILABLE)
                    source.copy(status = SourceStatus.UNAVAILABLE) else source
            } else sources
            return validateCoreState(CoreState(CORE_SCHEMA_VERSION, revision, profiles, activeId, requestedHomeId, migratedSources, media, handoffsEnabled))
        }
    }

    override fun save(state: CoreState) {
        val next = validateCoreState(state)
        val target = path.toAbsolutePath().normalize()
        val parent = target.parent ?: error("Snapshot needs a parent directory")
        Files.createDirectories(parent)
        val lockPath = target.resolveSibling(target.fileName.toString() + ".lock")
        FileChannel.open(lockPath, StandardOpenOption.CREATE, StandardOpenOption.WRITE).use { channel ->
            channel.lock().use {
                val current = load()
                if (next.revision != Math.addExact(current.revision, 1)) {
                    throw ConcurrentModificationException("Stale core revision")
                }
                writeAtomically(parent, target, next)
            }
        }
    }

    private fun writeAtomically(parent: Path, target: Path, state: CoreState) {
        val temporary = Files.createTempFile(parent, ".reelos-core-", ".tmp")
        try {
            FileOutputStream(temporary.toFile()).use { file ->
                val output = DataOutputStream(file)
                output.writeInt(MAGIC)
                output.writeInt(schemaVersion)
                output.writeLong(state.revision)
                writeMap(output, state.profiles) { _, p ->
                    output.writeUTF(p.id)
                    output.writeUTF(p.name)
                    output.writeUTF(p.color)
                    output.writeUTF(p.onboardingStep.name)
                    output.writeUTF(p.guidance.name)
                    writeSet(output, p.tasteSeeds)
                    writeMap(output, p.positiveReactions) { id, kind ->
                        output.writeUTF(id)
                        output.writeUTF(kind.name)
                    }
                    writeSet(output, p.dismissedIds)
                    writeSet(output, p.lessLikeIds)
                    writeSet(output, p.savedMediaIds)
                    writeMap(output, p.playbackPositionsMs) { id, position ->
                        output.writeUTF(id)
                        output.writeLong(position)
                    }
                    writeMap(output, p.readingPositions) { id, position ->
                        output.writeUTF(id)
                        output.writeUTF(position)
                    }
                    output.writeUTF(p.motionMode.name)
                    output.writeUTF(p.browsingDensity.name)
                    output.writeBoolean(p.transparencyEnabled)
                }
                writeNullable(output, state.activeProfileId)
                writeNullable(output, state.requestedHomeId)
                writeMap(output, state.sources) { _, source ->
                    output.writeUTF(source.id)
                    output.writeUTF(source.kind.name)
                    output.writeUTF(source.status.name)
                }
                writeMap(output, state.media) { _, item ->
                    output.writeUTF(item.id)
                    output.writeUTF(item.title)
                    writeNullable(output, item.sourceId)
                    output.writeUTF(item.availability.name)
                }
                output.writeBoolean(state.experimentalHandoffsEnabled)
                output.flush()
                file.fd.sync()
            }
            Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } finally {
            Files.deleteIfExists(temporary)
        }
    }

    private fun readSet(input: DataInputStream): Set<String> = buildSet {
        repeat(readCount(input)) { add(input.readUTF()) }
    }

    private fun <K, V> readMap(input: DataInputStream, readEntry: () -> Pair<K, V>): Map<K, V> = buildMap {
        repeat(readCount(input)) {
            val (key, value) = readEntry()
            require(key !in this) { "Duplicate core key" }
            put(key, value)
        }
    }

    private fun readCount(input: DataInputStream): Int = input.readInt().also {
        require(it in 0..MAX_ITEMS) { "Invalid core collection size" }
    }

    private fun readNullable(input: DataInputStream): String? = if (input.readBoolean()) input.readUTF() else null

    private fun writeSet(output: DataOutputStream, values: Set<String>) {
        require(values.size <= MAX_ITEMS)
        output.writeInt(values.size)
        values.sorted().forEach(output::writeUTF)
    }

    private fun <K, V> writeMap(output: DataOutputStream, values: Map<K, V>, writeEntry: (K, V) -> Unit) {
        require(values.size <= MAX_ITEMS)
        output.writeInt(values.size)
        values.forEach { (key, value) -> writeEntry(key, value) }
    }

    private fun writeNullable(output: DataOutputStream, value: String?) {
        output.writeBoolean(value != null)
        if (value != null) output.writeUTF(value)
    }

    private companion object {
        const val MAGIC = 0x52454F53 // REOS
        const val MAX_ITEMS = 100_000
    }
}

/** Rejects a malformed or future snapshot before exposing it to any native renderer. */
internal fun validateCoreState(state: CoreState): CoreState {
    require(state.schemaVersion == CORE_SCHEMA_VERSION) { "Unsupported core state version" }
    require(state.revision >= 0) { "Invalid core revision" }
    require(state.activeProfileId == null || state.activeProfileId in state.profiles) { "Active profile is missing" }
    require(state.requestedHomeId == null || (state.requestedHomeId.isNotBlank() && state.requestedHomeId.length <= 128)) {
        "Invalid Home identity"
    }
    state.profiles.forEach { (id, profile) ->
        require(id.isNotBlank() && id == profile.id) { "Invalid profile identity" }
        require(profile.name.isNotBlank() || profile.onboardingStep == OnboardingStep.IDENTITY) { "Incomplete profile identity" }
        require(Regex("#[0-9A-Fa-f]{6}").matches(profile.color)) { "Invalid profile color" }
        require(profile.tasteSeeds.all { it.isNotBlank() && it.length <= 128 }) { "Invalid taste seed identifier" }
        require(profile.positiveReactions.values.all { it == ReactionKind.LIKE || it == ReactionKind.LOVE || it == ReactionKind.COZY }) {
            "Invalid positive reaction"
        }
        require((profile.positiveReactions.keys intersect profile.dismissedIds).isEmpty()) { "Conflicting reactions" }
        require((profile.positiveReactions.keys intersect profile.lessLikeIds).isEmpty()) { "Conflicting reactions" }
        require((profile.dismissedIds intersect profile.lessLikeIds).isEmpty()) { "Conflicting reactions" }
        require(profile.playbackPositionsMs.values.all { it >= 0 }) { "Invalid playback position" }
    }
    state.sources.forEach { (id, source) ->
        require(id.isNotBlank() && id == source.id) { "Invalid source identity" }
        require(when (source.kind) {
            SourceKind.PERSONAL -> id == PERSONAL_SOURCE_ID
            SourceKind.PUBLIC_DOMAIN -> id == PUBLIC_DOMAIN_SOURCE_ID
            SourceKind.OPTIONAL_ADAPTER -> id != PERSONAL_SOURCE_ID && id != PUBLIC_DOMAIN_SOURCE_ID
        }) { "Source kind conflicts with reserved identity" }
    }
    state.media.forEach { (id, item) ->
        require(id.isNotBlank() && id == item.id && item.title.isNotBlank() && item.title.length <= 512) { "Invalid media identity" }
    }
    val frozenProfiles = state.profiles.mapValues { (_, profile) ->
        profile.copy(
            tasteSeeds = immutableSet(profile.tasteSeeds),
            positiveReactions = immutableMap(profile.positiveReactions),
            dismissedIds = immutableSet(profile.dismissedIds),
            lessLikeIds = immutableSet(profile.lessLikeIds),
            savedMediaIds = immutableSet(profile.savedMediaIds),
            playbackPositionsMs = immutableMap(profile.playbackPositionsMs),
            readingPositions = immutableMap(profile.readingPositions),
        )
    }
    return state.copy(
        profiles = immutableMap(frozenProfiles),
        sources = immutableMap(state.sources),
        media = immutableMap(state.media),
    )
}

private fun <T> immutableSet(source: Set<T>): Set<T> = Collections.unmodifiableSet(LinkedHashSet(source))

private fun <K, V> immutableMap(source: Map<K, V>): Map<K, V> = Collections.unmodifiableMap(LinkedHashMap(source))
