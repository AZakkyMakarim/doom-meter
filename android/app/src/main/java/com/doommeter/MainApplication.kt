package com.doommeter

import android.app.Application
import com.doommeter.detection.DoomMeterDetectionPackage
import com.doommeter.insets.DoomMeterInsetsPackage
import com.doommeter.overlay.DoomMeterOverlayPackage
import com.doommeter.permissions.DoomMeterPermissionsPackage
import com.doommeter.widget.DoomMeterWidgetPackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(DoomMeterOverlayPackage())
          add(DoomMeterDetectionPackage())
          add(DoomMeterPermissionsPackage())
          add(DoomMeterInsetsPackage())
          add(DoomMeterWidgetPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
