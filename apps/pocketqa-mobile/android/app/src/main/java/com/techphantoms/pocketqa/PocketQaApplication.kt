package com.techphantoms.pocketqa

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.techphantoms.pocketqa.bridge.PocketQaPackage

class PocketQaApplication : Application(), ReactApplication {

    // `this` inside an object expression is the anonymous object, not the
    // Application. DefaultReactNativeHost needs the Application instance.
    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this@PocketQaApplication) {
        override fun getPackages(): List<ReactPackage> {
            val packages = PackageList(this).packages.toMutableList()
            packages.add(PocketQaPackage())
            return packages
        }
        override fun getJSMainModuleName(): String = "index"
        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
        override val isNewArchEnabled: Boolean = true
        override val isHermesEnabled: Boolean = true
    }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        // React Native 0.76+ merges the individual JNI libraries into
        // libreactnative.so. Without the merged mapping, SoLoader still looks
        // for the old split libs and dies at startup on the first one:
        // UnsatisfiedLinkError: library "libreact_featureflagsjni.so" not found.
        SoLoader.init(this, OpenSourceMergedSoMapping)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) load()
    }
}
