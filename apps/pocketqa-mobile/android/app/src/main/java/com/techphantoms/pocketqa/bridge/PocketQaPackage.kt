package com.techphantoms.pocketqa.bridge

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Registers PocketQaModule with the New Architecture TurboModule registry.
 *
 * The `TurboReactPackage` base class exposes two hooks:
 *   - `getModule(name, ctx)`  — returns a lazily-instantiated module by name.
 *   - `getReactModuleInfoProvider()` — declares which modules this package
 *     provides and whether they're TurboModules.
 *
 * When `newArchEnabled=true` the runtime consults this package via the codegen
 * bindings; on the old arch it degrades to the legacy `createNativeModules`
 * behaviour for backwards compatibility.
 */
class PocketQaPackage : TurboReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        when (name) {
            PocketQaModule.NAME -> PocketQaModule(reactContext)
            else -> null
        }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
        mapOf(
            PocketQaModule.NAME to ReactModuleInfo(
                /* name = */ PocketQaModule.NAME,
                /* className = */ PocketQaModule::class.java.name,
                /* canOverrideExistingModule = */ false,
                /* needsEagerInit = */ false,
                /* isCxxModule = */ false,
                /* isTurboModule = */ true,
            ),
        )
    }
}
