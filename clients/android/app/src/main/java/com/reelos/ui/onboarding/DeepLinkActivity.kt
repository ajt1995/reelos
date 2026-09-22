package com.reelos.ui.onboarding

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import com.reelos.ReelOsApplication
import com.reelos.core.api.HouseholdEndpoint
import com.reelos.ui.mobile.MainActivity

class DeepLinkActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val server = intent?.data?.getQueryParameter("server")
        HouseholdEndpoint.parse(server.orEmpty())?.let {
            (application as ReelOsApplication).preferences.apply {
                clearSession()
                serverBaseUrl = it.toString().trimEnd('/')
            }
        }
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
