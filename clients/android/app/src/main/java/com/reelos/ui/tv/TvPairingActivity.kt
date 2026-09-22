package com.reelos.ui.tv

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity

class TvPairingActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(Intent(this, TvMainActivity::class.java))
        finish()
    }
}
