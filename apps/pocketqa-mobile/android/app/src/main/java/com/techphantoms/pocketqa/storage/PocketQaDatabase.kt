package com.techphantoms.pocketqa.storage

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    version = 1,
    entities = [
        ConsentRow::class, ProviderRow::class, IntentRow::class,
        SessionRow::class, CaptureEventRow::class, UIStateRow::class,
        CompileJobRow::class, TestDraftRow::class, ApprovedTestRow::class,
        ReplayRunRow::class, MissionRow::class, ActiveOperationRow::class,
    ],
    exportSchema = false,
)
abstract class PocketQaDatabase : RoomDatabase() {
    abstract fun dao(): PocketQaDao

    companion object {
        @Volatile private var INSTANCE: PocketQaDatabase? = null
        fun get(context: Context): PocketQaDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room
                    .databaseBuilder(context.applicationContext, PocketQaDatabase::class.java, "pocketqa.db")
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
    }
}
