# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**

# Kotlin serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keep,includedescriptorclasses class com.techphantoms.pocketqa.**$$serializer { *; }
-keepclassmembers class com.techphantoms.pocketqa.** {
    *** Companion;
}
-keepclasseswithmembers class com.techphantoms.pocketqa.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# ML Kit
-keep class com.google.mlkit.** { *; }
