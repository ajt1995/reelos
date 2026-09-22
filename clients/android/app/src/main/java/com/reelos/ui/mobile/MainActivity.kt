package com.reelos.ui.mobile

import android.os.Bundle
import android.view.WindowManager
import com.reelos.ui.shared.SharedReelOsActivity

class MainActivity : SharedReelOsActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Keep the in-app keyboard from covering search/refine controls on phones.
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        super.onCreate(savedInstanceState)
    }
}
