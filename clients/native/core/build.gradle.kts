plugins { kotlin("jvm") }
kotlin { jvmToolchain(17) }
dependencies { testImplementation(kotlin("test-junit")) }
tasks.test { useJUnit() }

val buildIdentityDirectory = layout.buildDirectory.dir("generated/reelos-build")
val generateBuildIdentity by tasks.registering {
    val fields = linkedMapOf(
        "productVersion" to rootProject.extra["reelosProductVersion"].toString(),
        "sourceRevision" to rootProject.extra["reelosSourceRevision"].toString(),
        "sourceFingerprint" to rootProject.extra["reelosSourceFingerprint"].toString(),
        "displayVersion" to rootProject.extra["reelosNativeVersion"].toString(),
    )
    inputs.properties(fields)
    outputs.dir(buildIdentityDirectory)
    doLast {
        val target = buildIdentityDirectory.get().file("reelos-build.properties").asFile
        target.parentFile.mkdirs()
        target.writeText(fields.entries.joinToString("\n", postfix = "\n") { "${it.key}=${it.value}" })
    }
}
sourceSets.main { resources.srcDir(buildIdentityDirectory) }
tasks.processResources { dependsOn(generateBuildIdentity) }
