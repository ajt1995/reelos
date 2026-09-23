package com.reelos.ui.tv

import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import com.reelos.ReelOsApplication
import com.reelos.core.api.ReelOsClient
import com.reelos.core.discovery.ServerDiscovery
import com.reelos.core.model.ClientResult
import com.reelos.core.prefs.AppPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.random.Random

/**
 * Android TV Leanback Pairing Activity.
 * Supports zero-click mDNS auto-pairing with 4-digit PIN / QR fallback.
 */
class TvPairingActivity : ComponentActivity() {
    private lateinit var prefs: AppPreferences
    private lateinit var api: ReelOsClient
    private lateinit var discovery: ServerDiscovery

    private var pairingState by mutableStateOf<PairingUiState>(PairingUiState.AutoSearching("Scanning local network via mDNS..."))
    private var fourDigitPin by mutableStateOf(generateFourDigitPin())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as ReelOsApplication
        prefs = app.preferences
        api = ReelOsClient(prefs)
        discovery = ServerDiscovery(this)

        startAutoDiscovery()
        startPairingStatusPolling()

        setContent {
            TvPairingScreen(
                state = pairingState,
                pin = fourDigitPin,
                serverBaseUrl = prefs.serverBaseUrl,
                onRetry = { startAutoDiscovery() },
                onContinueStandalone = {
                    prefs.useStandalone()
                    navigateToMain()
                }
            )
        }
    }

    /**
     * Attempts zero-click mDNS auto-pairing with the local ReelOS home server.
     */
    private fun startAutoDiscovery() {
        lifecycleScope.launch(Dispatchers.IO) {
            withContext(Dispatchers.Main) {
                pairingState = PairingUiState.AutoSearching("Scanning local network for ReelOS home via mDNS...")
            }

            // Zero-click mDNS / LAN discovery probe
            val discovered = discovery.discoverLocalServer(timeoutMs = 2500)
            if (discovered != null) {
                prefs.serverBaseUrl = discovered.baseUrl
                withContext(Dispatchers.Main) {
                    pairingState = PairingUiState.AutoSearching("Found ${discovered.boxName}. Performing zero-click pairing...")
                }

                val pairResult = api.pairDevice()
                if (pairResult is ClientResult.Success) {
                    prefs.useHome()
                    withContext(Dispatchers.Main) {
                        pairingState = PairingUiState.Success
                        delay(600)
                        navigateToMain()
                    }
                    return@launch
                }
            }

            // Fallback to 4-digit PIN / QR code pairing
            withContext(Dispatchers.Main) {
                fourDigitPin = generateFourDigitPin()
                pairingState = PairingUiState.FallbackPinOrQr(
                    pin = fourDigitPin,
                    qrDeepLink = "reelos://pair?pin=$fourDigitPin"
                )
            }
        }
    }

    /**
     * Polls the pairing status endpoint when in PIN / QR fallback mode.
     */
    private fun startPairingStatusPolling() {
        lifecycleScope.launch(Dispatchers.IO) {
            while (isActive) {
                delay(2000)
                if (prefs.serverBaseUrl.isNotBlank()) {
                    val status = api.pairingStatus()
                    if (status is ClientResult.Success && status.value.deviceAuthorized) {
                        prefs.useHome()
                        withContext(Dispatchers.Main) {
                            pairingState = PairingUiState.Success
                            delay(500)
                            navigateToMain()
                        }
                        break
                    }
                }
            }
        }
    }

    private fun navigateToMain() {
        startActivity(Intent(this, TvMainActivity::class.java))
        finish()
    }

    private fun generateFourDigitPin(): String {
        return "%04d".format(Random.nextInt(1000, 10000))
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (prefs.isConfigured || prefs.useStandaloneNode) {
                navigateToMain()
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }
}

sealed interface PairingUiState {
    data class AutoSearching(val message: String) : PairingUiState
    data class FallbackPinOrQr(val pin: String, val qrDeepLink: String) : PairingUiState
    data object Success : PairingUiState
}

@Composable
fun TvPairingScreen(
    state: PairingUiState,
    pin: String,
    serverBaseUrl: String,
    onRetry: () -> Unit,
    onContinueStandalone: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color(0xFF09090B)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 48.dp, vertical = 36.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "ReelOS TV Leanback",
                fontSize = 16.sp,
                color = Color(0xFFEAB308),
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp
            )

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = "Connect Your Screen",
                fontSize = 32.sp,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(24.dp))

            when (state) {
                is PairingUiState.AutoSearching -> {
                    CircularProgressIndicator(
                        color = Color(0xFFEAB308),
                        strokeWidth = 3.dp
                    )
                    Spacer(modifier = Modifier.height(20.dp))
                    Text(
                        text = state.message,
                        color = Color(0xFFA1A1AA),
                        fontSize = 18.sp,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = "Zero-click mDNS auto-pairing in progress...",
                        color = Color(0xFF71717A),
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }

                is PairingUiState.FallbackPinOrQr -> {
                    Text(
                        text = "Zero-click mDNS did not find a paired home. Use PIN or QR fallback:",
                        color = Color(0xFFA1A1AA),
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    // 4-Digit PIN Box
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF18181B), RoundedCornerShape(12.dp))
                            .border(2.dp, Color(0xFFEAB308), RoundedCornerShape(12.dp))
                            .padding(horizontal = 32.dp, vertical = 16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = pin.chunked(1).joinToString("  "),
                            color = Color.White,
                            fontSize = 44.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 8.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Enter this 4-digit PIN in your mobile companion or scan QR deep link:",
                        color = Color(0xFFCBD5E1),
                        fontSize = 15.sp,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = state.qrDeepLink,
                        color = Color(0xFFEAB308),
                        fontSize = 13.sp,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.padding(top = 4.dp)
                    )

                    Spacer(modifier = Modifier.height(30.dp))

                    var isRetryFocused by remember { mutableStateOf(false) }
                    var isStandaloneFocused by remember { mutableStateOf(false) }

                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Button(
                            onClick = onRetry,
                            modifier = Modifier
                                .onFocusChanged { isRetryFocused = it.isFocused }
                                .border(
                                    width = 2.dp,
                                    color = if (isRetryFocused) Color(0xFFEAB308) else Color.Transparent,
                                    shape = RoundedCornerShape(24.dp)
                                ),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isRetryFocused) Color(0xFF3F3F46) else Color(0xFF27272A),
                                contentColor = if (isRetryFocused) Color(0xFFEAB308) else Color.White
                            )
                        ) {
                            Text("Retry Auto-Pairing", fontWeight = FontWeight.SemiBold)
                        }

                        Button(
                            onClick = onContinueStandalone,
                            modifier = Modifier
                                .onFocusChanged { isStandaloneFocused = it.isFocused }
                                .border(
                                    width = 2.dp,
                                    color = if (isStandaloneFocused) Color(0xFFEAB308) else Color.Transparent,
                                    shape = RoundedCornerShape(24.dp)
                                ),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isStandaloneFocused) Color(0xFF3F3F46) else Color(0xFF27272A),
                                contentColor = if (isStandaloneFocused) Color(0xFFEAB308) else Color.White
                            )
                        ) {
                            Text("Continue as Standalone", fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                is PairingUiState.Success -> {
                    Text(
                        text = "✓ Paired Successfully!",
                        color = Color(0xFF22C55E),
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Loading your household library...",
                        color = Color(0xFFA1A1AA),
                        fontSize = 16.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
        }
    }
}
