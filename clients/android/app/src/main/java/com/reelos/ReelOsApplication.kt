package com.reelos

import android.app.Application
import com.reelos.core.prefs.AppPreferences
import com.reelos.core.grid.AndroidGridNode

class ReelOsApplication : Application() {
    lateinit var preferences: AppPreferences
        private set
    lateinit var gridNode: AndroidGridNode
        private set

    override fun onCreate() {
        super.onCreate()
        preferences = AppPreferences(this)
        gridNode = AndroidGridNode(this).also { it.start() }
    }
}
