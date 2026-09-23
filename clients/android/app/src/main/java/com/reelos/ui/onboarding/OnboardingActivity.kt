package com.reelos.ui.onboarding

import android.app.UiModeManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.reelos.ReelOsApplication
import com.reelos.core.discovery.ServerDiscovery
import com.reelos.core.prefs.AppPreferences
import com.reelos.neural.MobileNeuralEngine
import com.reelos.ui.components.NativePinBox
import com.reelos.ui.components.TasteAffinity
import com.reelos.ui.components.TasteBubblesCanvas
import com.reelos.ui.mobile.MainActivity
import com.reelos.ui.tv.TvMainActivity
import kotlinx.coroutines.launch

/**
 * Pure Native Unified Onboarding Flow for ReelOS.
 * Sovereign Node Parity: Identical 7-step onboarding across PC, TV, Foldable, and Phone.
 * Zero WebViews. Zero Chromium wrappers.
 * Full 10-foot TV D-Pad remote focus navigation & Mali GPU shader safety.
 */
class OnboardingActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        super.onCreate(savedInstanceState)

        val app = application as ReelOsApplication
        val prefs = app.preferences
        val uiModeManager = getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager
        val isTv = uiModeManager?.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION ||
                intent.getBooleanExtra("is_tv", false)

        setContent {
            UnifiedOnboardingScreen(
                isTv = isTv,
                prefs = prefs,
                onComplete = {
                    prefs.hasCompletedOnboarding = true
                    val targetClass = if (isTv) TvMainActivity::class.java else MainActivity::class.java
                    val nextIntent = Intent(this@OnboardingActivity, targetClass).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    }
                    startActivity(nextIntent)
                    finish()
                }
            )
        }
    }
}

enum class OnboardingStep(val title: String, val subtitle: String) {
    GREETING("Welcome to ReelOS", "One end-to-end local neural system adapting to the glass it inhabits"),
    ATMOSPHERE("Atmosphere & Ambiance", "Select the luminous ambient aura that reflects your cinema space"),
    IDENTITY("Household & Profile", "Set your resident profile identity and optional tactile PIN"),
    GUIDANCE("Curator Guidance", "Select how intimately the resident neural engine guides your evenings"),
    TASTE_CALIBRATION("Taste Constellation", "Tap once to like, twice to love. Calibrate your resident neural centroid"),
    MESH_CHOICE("Node Topology", "Declare how this node connects with your household mesh"),
    READY("Cinema Stage Ready", "Your sovereign ReelOS node is configured and ready for illumination"),
}

data class AtmospherePalette(
    val id: String,
    val name: String,
    val accentColor: Color,
    val auraGlow: Color,
    val description: String,
)

val ATMOSPHERE_PALETTES = listOf(
    AtmospherePalette("gold", "Golden Hour", Color(0xFFF5C518), Color(0x33F5C518), "Criterion warmth & timeless tungsten"),
    AtmospherePalette("neon_noir", "Neon Noir", Color(0xFF38BDF8), Color(0x3338BDF8), "Cyberpunk atmospheric blue & crisp neon"),
    AtmospherePalette("velvet", "Velvet Cinema", Color(0xFFE50914), Color(0x33E50914), "Classic theater curtain & deep mahogany"),
    AtmospherePalette("emerald", "Bioluminescent", Color(0xFF10B981), Color(0x3310B981), "Lush deep-forest calm & twilight serenity"),
    AtmospherePalette("amethyst", "Midnight Velvet", Color(0xFFA855F7), Color(0x33A855F7), "A24 surrealist dreamscape & nocturnal mood"),
    AtmospherePalette("monochrome", "Obsidian Minimal", Color(0xFF94A3B8), Color(0x3394A3B8), "Pure reference black with slate accents"),
)

@Composable
fun UnifiedOnboardingScreen(
    isTv: Boolean,
    prefs: AppPreferences,
    onComplete: () -> Unit,
) {
    var stepIndex by remember { mutableIntStateOf(0) }
    val steps = OnboardingStep.values()
    val currentStep = steps[stepIndex]

    // Form states
    var selectedAtmosphere by remember { mutableStateOf(ATMOSPHERE_PALETTES[0]) }
    var residentName by remember { mutableStateOf(prefs.activeResidentName.ifBlank { "Austin" }) }
    var residentPin by remember { mutableStateOf("") }
    var hasPinEnabled by remember { mutableStateOf(false) }
    var guidanceMode by remember { mutableStateOf("balanced") }
    var nodeMode by remember { mutableStateOf(if (prefs.isStandalone) "standalone" else "mesh") }
    var meshStatus by remember { mutableStateOf("Ready to scan household mesh") }
    var isScanningMesh by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current
    val discovery = remember { ServerDiscovery(context) }

    // Pre-blended hardware radial background (TV hardware shader safe - Mali GPU proof)
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(
                        selectedAtmosphere.auraGlow,
                        Color(0xFF0A0A0C),
                        Color(0xFF050507),
                    ),
                    radius = if (isTv) 1200f else 900f,
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(if (isTv) 48.dp else 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Header Progress Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                steps.forEachIndexed { idx, _ ->
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(
                                if (idx <= stepIndex) selectedAtmosphere.accentColor
                                else Color.White.copy(alpha = 0.15f)
                            )
                    )
                }
            }

            // Step Title and Subtitle
            Text(
                text = currentStep.title,
                fontSize = if (isTv) 32.sp else 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = currentStep.subtitle,
                fontSize = if (isTv) 16.sp else 13.sp,
                color = Color.White.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 24.dp)
            )
            Spacer(modifier = Modifier.height(24.dp))

            // Step Content Area with smooth transitions
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center,
            ) {
                AnimatedContent(
                    targetState = currentStep,
                    transitionSpec = {
                        (slideInHorizontally { width -> width } + fadeIn()).togetherWith(
                            slideOutHorizontally { width -> -width } + fadeOut()
                        )
                    },
                    label = "OnboardingStepTransition",
                ) { step ->
                    when (step) {
                        OnboardingStep.GREETING -> {
                            GreetingStepContent(
                                isTv = isTv,
                                accentColor = selectedAtmosphere.accentColor,
                            )
                        }
                        OnboardingStep.ATMOSPHERE -> {
                            AtmosphereStepContent(
                                isTv = isTv,
                                selected = selectedAtmosphere,
                                onSelect = {
                                    selectedAtmosphere = it
                                    prefs.onboardingAtmosphereColor = it.id
                                }
                            )
                        }
                        OnboardingStep.IDENTITY -> {
                            IdentityStepContent(
                                isTv = isTv,
                                residentName = residentName,
                                onNameChange = { residentName = it },
                                hasPin = hasPinEnabled,
                                onPinToggle = { hasPinEnabled = it },
                                pin = residentPin,
                                onPinChange = { residentPin = it },
                                accentColor = selectedAtmosphere.accentColor,
                            )
                        }
                        OnboardingStep.GUIDANCE -> {
                            GuidanceStepContent(
                                isTv = isTv,
                                selectedMode = guidanceMode,
                                onSelectMode = { guidanceMode = it },
                                accentColor = selectedAtmosphere.accentColor,
                            )
                        }
                        OnboardingStep.TASTE_CALIBRATION -> {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center,
                            ) {
                                TasteBubblesCanvas(
                                    modifier = Modifier.fillMaxSize(),
                                    onAffinityChanged = { affinities ->
                                        // Update resident neural manifold centroid dynamically
                                        affinities.forEach { (itemKey, affinity) ->
                                            val multiplier = when (affinity) {
                                                TasteAffinity.LOVE -> 2.5f
                                                TasteAffinity.LIKE -> 1.0f
                                                TasteAffinity.NEUTRAL -> 0.0f
                                            }
                                            if (multiplier > 0f) {
                                                val latent = MobileNeuralEngine.projectQueryTo512D(itemKey)
                                                val updated = MobileNeuralEngine.updateResidentCentroid(
                                                    prefs.getResidentTasteVector(),
                                                    latent,
                                                    multiplier,
                                                )
                                                prefs.setResidentTasteVector(updated)
                                            }
                                        }
                                    }
                                )
                            }
                        }
                        OnboardingStep.MESH_CHOICE -> {
                            MeshChoiceStepContent(
                                isTv = isTv,
                                selectedMode = nodeMode,
                                onSelectMode = { mode ->
                                    nodeMode = mode
                                    if (mode == "standalone") {
                                        prefs.useStandalone()
                                    } else {
                                        prefs.useHome()
                                    }
                                },
                                statusMessage = meshStatus,
                                isScanning = isScanningMesh,
                                onScanMesh = {
                                    isScanningMesh = true
                                    meshStatus = "Scanning LAN UDP 44445 & mDNS..."
                                    coroutineScope.launch {
                                        try {
                                            val found = discovery.discoverLocalServer(3000L)
                                            if (found != null) {
                                                prefs.serverBaseUrl = found.baseUrl
                                                meshStatus = "Discovered household node: ${found.boxName} (${found.baseUrl})"
                                            } else {
                                                meshStatus = "No active household node responded. Running as sovereign standalone node."
                                                prefs.useStandalone()
                                                nodeMode = "standalone"
                                            }
                                        } catch (e: Exception) {
                                            meshStatus = "Mesh discovery completed. Sovereign standalone active."
                                        } finally {
                                            isScanningMesh = false
                                        }
                                    }
                                },
                                accentColor = selectedAtmosphere.accentColor,
                            )
                        }
                        OnboardingStep.READY -> {
                            ReadyStepContent(
                                isTv = isTv,
                                residentName = residentName,
                                palette = selectedAtmosphere,
                                nodeMode = nodeMode,
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Navigation Footer Controls
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = if (isTv) 48.dp else 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (stepIndex > 0) {
                    OnboardingButton(
                        text = "Back",
                        isTv = isTv,
                        isPrimary = false,
                        accentColor = selectedAtmosphere.accentColor,
                        onClick = { stepIndex-- }
                    )
                } else {
                    Spacer(modifier = Modifier.width(100.dp))
                }

                if (stepIndex < steps.size - 1) {
                    OnboardingButton(
                        text = "Continue",
                        isTv = isTv,
                        isPrimary = true,
                        accentColor = selectedAtmosphere.accentColor,
                        onClick = {
                            if (currentStep == OnboardingStep.IDENTITY) {
                                prefs.activeResidentName = residentName.ifBlank { "Austin" }
                            }
                            stepIndex++
                        }
                    )
                } else {
                    OnboardingButton(
                        text = "Enter Cinema Stage",
                        isTv = isTv,
                        isPrimary = true,
                        accentColor = selectedAtmosphere.accentColor,
                        onClick = onComplete,
                    )
                }
            }
        }
    }
}

@Composable
fun OnboardingButton(
    text: String,
    isTv: Boolean,
    isPrimary: Boolean,
    accentColor: Color,
    onClick: () -> Unit,
) {
    var isFocused by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .onFocusChanged { isFocused = it.isFocused }
            .focusable()
            .clip(RoundedCornerShape(12.dp))
            .background(
                when {
                    isPrimary && isFocused -> Color.White
                    isPrimary -> accentColor
                    isFocused -> Color.White.copy(alpha = 0.25f)
                    else -> Color.White.copy(alpha = 0.08f)
                }
            )
            .border(
                width = if (isFocused) 2.dp else 1.dp,
                color = when {
                    isFocused -> Color.White
                    isPrimary -> accentColor
                    else -> Color.White.copy(alpha = 0.2f)
                },
                shape = RoundedCornerShape(12.dp),
            )
            .clickable(onClick = onClick)
            .padding(
                horizontal = if (isTv) 32.dp else 24.dp,
                vertical = if (isTv) 16.dp else 12.dp,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = if (isFocused || isPrimary) Color(0xFF0A0A0C) else Color.White,
            fontSize = if (isTv) 16.sp else 14.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
fun GreetingStepContent(
    isTv: Boolean,
    accentColor: Color,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(if (isTv) 110.dp else 80.dp)
                .clip(CircleShape)
                .background(accentColor.copy(alpha = 0.15f))
                .border(2.dp, accentColor, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "✦",
                fontSize = if (isTv) 44.sp else 32.sp,
                color = accentColor,
            )
        }
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "Sovereign Neural Entertainment",
            fontSize = if (isTv) 24.sp else 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "ReelOS runs natively on this device as a standalone peer node. Your taste vectors, offline caches, and hardware decoders are fully sovereign, private, and mesh-aware.",
            fontSize = if (isTv) 15.sp else 13.sp,
            color = Color.White.copy(alpha = 0.65f),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = if (isTv) 96.dp else 16.dp),
            lineHeight = if (isTv) 22.sp else 18.sp,
        )
    }
}

@Composable
fun AtmosphereStepContent(
    isTv: Boolean,
    selected: AtmospherePalette,
    onSelect: (AtmospherePalette) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ATMOSPHERE_PALETTES.forEach { palette ->
            val isSelected = selected.id == palette.id
            var isFocused by remember { mutableStateOf(false) }

            Row(
                modifier = Modifier
                    .fillMaxWidth(if (isTv) 0.7f else 1f)
                    .onFocusChanged { isFocused = it.isFocused }
                    .focusable()
                    .clip(RoundedCornerShape(14.dp))
                    .background(
                        if (isSelected) palette.accentColor.copy(alpha = 0.18f)
                        else if (isFocused) Color.White.copy(alpha = 0.12f)
                        else Color.White.copy(alpha = 0.04f)
                    )
                    .border(
                        width = if (isSelected || isFocused) 2.dp else 1.dp,
                        color = if (isSelected) palette.accentColor
                        else if (isFocused) Color.White
                        else Color.White.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(14.dp),
                    )
                    .clickable { onSelect(palette) }
                    .padding(horizontal = 20.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(palette.accentColor)
                )
                Spacer(modifier = Modifier.width(16.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = palette.name,
                        fontSize = if (isTv) 16.sp else 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                    )
                    Text(
                        text = palette.description,
                        fontSize = if (isTv) 13.sp else 11.sp,
                        color = Color.White.copy(alpha = 0.6f),
                    )
                }
                if (isSelected) {
                    Text(
                        text = "✓",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = palette.accentColor,
                    )
                }
            }
        }
    }
}

@Composable
fun IdentityStepContent(
    isTv: Boolean,
    residentName: String,
    onNameChange: (String) -> Unit,
    hasPin: Boolean,
    onPinToggle: (Boolean) -> Unit,
    pin: String,
    onPinChange: (String) -> Unit,
    accentColor: Color,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "Resident Profile Name",
            fontSize = if (isTv) 16.sp else 14.sp,
            color = Color.White.copy(alpha = 0.8f),
        )
        Spacer(modifier = Modifier.height(8.dp))

        Box(
            modifier = Modifier
                .fillMaxWidth(if (isTv) 0.5f else 0.85f)
                .clip(RoundedCornerShape(12.dp))
                .background(Color.White.copy(alpha = 0.06f))
                .border(1.dp, accentColor.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            contentAlignment = Alignment.Center,
        ) {
            BasicTextField(
                value = residentName,
                onValueChange = onNameChange,
                textStyle = TextStyle(
                    color = Color.White,
                    fontSize = if (isTv) 20.sp else 16.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                ),
                cursorBrush = SolidColor(accentColor),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Security PIN toggle
        Row(
            modifier = Modifier
                .fillMaxWidth(if (isTv) 0.5f else 0.85f)
                .clip(RoundedCornerShape(10.dp))
                .clickable { onPinToggle(!hasPin) }
                .padding(8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Protect with 4-Digit Security PIN",
                fontSize = if (isTv) 14.sp else 12.sp,
                color = Color.White.copy(alpha = 0.8f),
            )
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (hasPin) accentColor else Color.White.copy(alpha = 0.1f))
                    .border(1.dp, Color.White.copy(alpha = 0.3f), RoundedCornerShape(4.dp)),
                contentAlignment = Alignment.Center,
            ) {
                if (hasPin) {
                    Text(text = "✓", color = Color.Black, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (hasPin) {
            Spacer(modifier = Modifier.height(16.dp))
            NativePinBox(
                pin = pin,
                onPinChange = onPinChange,
                onComplete = {},
                autoFocus = false,
            )
        }
    }
}

@Composable
fun GuidanceStepContent(
    isTv: Boolean,
    selectedMode: String,
    onSelectMode: (String) -> Unit,
    accentColor: Color,
) {
    val modes = listOf(
        Triple("quiet", "Quiet Luxury", "Subtle, unhurried recommendations. Ambient cinema cards that breathe without overwhelming."),
        Triple("balanced", "Balanced Cinema", "Intelligent mix of director retrospectives, actor affinities, and pristine 4K transfers."),
        Triple("deep", "Deep Discovery", "Exploratory curation surfacing underground international cinema, 35mm prints, and rare gems."),
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        modes.forEach { (key, title, desc) ->
            val isSelected = selectedMode == key
            var isFocused by remember { mutableStateOf(false) }

            Column(
                modifier = Modifier
                    .fillMaxWidth(if (isTv) 0.7f else 1f)
                    .onFocusChanged { isFocused = it.isFocused }
                    .focusable()
                    .clip(RoundedCornerShape(14.dp))
                    .background(
                        if (isSelected) accentColor.copy(alpha = 0.16f)
                        else if (isFocused) Color.White.copy(alpha = 0.1f)
                        else Color.White.copy(alpha = 0.04f)
                    )
                    .border(
                        width = if (isSelected || isFocused) 2.dp else 1.dp,
                        color = if (isSelected) accentColor
                        else if (isFocused) Color.White
                        else Color.White.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(14.dp),
                    )
                    .clickable { onSelectMode(key) }
                    .padding(18.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = title,
                        fontSize = if (isTv) 18.sp else 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                    )
                    if (isSelected) {
                        Text(text = "✓", color = accentColor, fontWeight = FontWeight.Black)
                    }
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = desc,
                    fontSize = if (isTv) 13.sp else 12.sp,
                    color = Color.White.copy(alpha = 0.65f),
                    lineHeight = if (isTv) 18.sp else 16.sp,
                )
            }
        }
    }
}

@Composable
fun MeshChoiceStepContent(
    isTv: Boolean,
    selectedMode: String,
    onSelectMode: (String) -> Unit,
    statusMessage: String,
    isScanning: Boolean,
    onScanMesh: () -> Unit,
    accentColor: Color,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        val options = listOf(
            Pair("mesh", "Join Household Mesh (Peer Discovery via UDP 44445 & mDNS)"),
            Pair("standalone", "Standalone Sovereign Node (Local Storage & Embedded Engine)"),
        )

        options.forEach { (mode, title) ->
            val isSelected = selectedMode == mode
            var isFocused by remember { mutableStateOf(false) }

            Row(
                modifier = Modifier
                    .fillMaxWidth(if (isTv) 0.75f else 1f)
                    .onFocusChanged { isFocused = it.isFocused }
                    .focusable()
                    .clip(RoundedCornerShape(12.dp))
                    .background(
                        if (isSelected) accentColor.copy(alpha = 0.18f)
                        else if (isFocused) Color.White.copy(alpha = 0.1f)
                        else Color.White.copy(alpha = 0.04f)
                    )
                    .border(
                        width = if (isSelected || isFocused) 2.dp else 1.dp,
                        color = if (isSelected) accentColor
                        else if (isFocused) Color.White
                        else Color.White.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(12.dp),
                    )
                    .clickable { onSelectMode(mode) }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(if (isSelected) accentColor else Color.Transparent)
                        .border(1.dp, if (isSelected) accentColor else Color.White.copy(alpha = 0.3f), CircleShape)
                )
                Spacer(modifier = Modifier.width(14.dp))
                Text(
                    text = title,
                    fontSize = if (isTv) 15.sp else 13.sp,
                    color = Color.White,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                )
            }
        }

        if (selectedMode == "mesh") {
            Spacer(modifier = Modifier.height(8.dp))
            OnboardingButton(
                text = if (isScanning) "Scanning Mesh..." else "Scan Household LAN",
                isTv = isTv,
                isPrimary = false,
                accentColor = accentColor,
                onClick = onScanMesh,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = statusMessage,
                fontSize = if (isTv) 13.sp else 11.sp,
                color = Color.White.copy(alpha = 0.6f),
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
fun ReadyStepContent(
    isTv: Boolean,
    residentName: String,
    palette: AtmospherePalette,
    nodeMode: String,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(if (isTv) 90.dp else 70.dp)
                .clip(CircleShape)
                .background(palette.accentColor.copy(alpha = 0.2f))
                .border(2.dp, palette.accentColor, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "✓",
                fontSize = if (isTv) 36.sp else 28.sp,
                color = palette.accentColor,
                fontWeight = FontWeight.Bold,
            )
        }
        Spacer(modifier = Modifier.height(20.dp))
        Text(
            text = "Welcome Home, $residentName",
            fontSize = if (isTv) 24.sp else 18.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = "Atmosphere: ${palette.name} • Topology: ${if (nodeMode == "mesh") "Household Mesh Node" else "Sovereign Standalone Node"}\nYour 512D resident neural manifold is active. DirectPlay hardware decoders are primed.",
            fontSize = if (isTv) 14.sp else 12.sp,
            color = Color.White.copy(alpha = 0.65f),
            textAlign = TextAlign.Center,
            lineHeight = 20.sp,
            modifier = Modifier.padding(horizontal = if (isTv) 64.dp else 16.dp),
        )
    }
}
