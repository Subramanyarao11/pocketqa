package com.techphantoms.pocketqa.storage

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface PocketQaDao {
    // Consent + providers -----------------------------------------------------------
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertConsent(row: ConsentRow)
    @Query("SELECT * FROM consent WHERE id = 'default'")
    suspend fun consent(): ConsentRow?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertProvider(row: ProviderRow)
    @Query("SELECT * FROM provider WHERE provider = :provider")
    suspend fun provider(provider: String): ProviderRow?
    @Query("SELECT * FROM provider")
    suspend fun providers(): List<ProviderRow>
    @Query("DELETE FROM provider WHERE provider = :provider")
    suspend fun deleteProvider(provider: String)

    // Intents + sessions ------------------------------------------------------------
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertIntent(row: IntentRow)
    @Query("SELECT * FROM intent WHERE id = :id")
    suspend fun intent(id: String): IntentRow?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSession(row: SessionRow)
    @Query("SELECT * FROM session WHERE id = :id")
    suspend fun session(id: String): SessionRow?
    @Query("UPDATE session SET state = :state, checkpointedAt = :now WHERE id = :id")
    suspend fun updateSessionState(id: String, state: String, now: Long)
    @Query("UPDATE session SET stepCount = stepCount + 1, checkpointedAt = :now WHERE id = :id")
    suspend fun incrementSessionStepCount(id: String, now: Long)
    @Query("DELETE FROM session WHERE id = :id")
    suspend fun deleteSession(id: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCaptureEvent(row: CaptureEventRow)
    @Query("SELECT * FROM capture_event WHERE sessionId = :sessionId ORDER BY at")
    suspend fun eventsForSession(sessionId: String): List<CaptureEventRow>
    @Query("DELETE FROM capture_event WHERE sessionId = :sessionId")
    suspend fun deleteEventsForSession(sessionId: String)

    // UI states ---------------------------------------------------------------------
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertUIState(row: UIStateRow)
    @Query("SELECT * FROM ui_state WHERE id = :id")
    suspend fun uiState(id: String): UIStateRow?
    @Query("SELECT * FROM ui_state WHERE id IN (:ids)")
    suspend fun uiStatesForIds(ids: List<String>): List<UIStateRow>

    // Compile / drafts / approved tests ---------------------------------------------
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCompileJob(row: CompileJobRow)
    @Query("SELECT * FROM compile_job WHERE jobId = :jobId")
    suspend fun compileJob(jobId: String): CompileJobRow?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDraft(row: TestDraftRow)
    @Query("SELECT * FROM test_draft WHERE id = :id")
    suspend fun draft(id: String): TestDraftRow?
    @Query("DELETE FROM test_draft WHERE id = :id")
    suspend fun deleteDraft(id: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertApprovedTest(row: ApprovedTestRow)
    @Query("SELECT * FROM approved_test WHERE id = :id ORDER BY version DESC LIMIT 1")
    suspend fun latestApproved(id: String): ApprovedTestRow?
    @Query("SELECT * FROM approved_test WHERE id = :id AND version = :v")
    suspend fun approvedAt(id: String, v: Int): ApprovedTestRow?
    @Query("SELECT * FROM approved_test ORDER BY approvedAt DESC")
    suspend fun allApproved(): List<ApprovedTestRow>
    @Query("DELETE FROM approved_test WHERE id = :id")
    suspend fun deleteApproved(id: String)

    // Runs --------------------------------------------------------------------------
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertRun(row: ReplayRunRow)
    @Query("SELECT * FROM replay_run WHERE runId = :runId")
    suspend fun run(runId: String): ReplayRunRow?
    @Query("SELECT * FROM replay_run WHERE testId = :testId ORDER BY finishedAt DESC LIMIT 1")
    suspend fun latestRunForTest(testId: String): ReplayRunRow?

    // Missions ----------------------------------------------------------------------
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMission(row: MissionRow)
    @Query("SELECT * FROM mission WHERE id = :id")
    suspend fun mission(id: String): MissionRow?

    // Active op -----
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertActiveOp(row: ActiveOperationRow)
    @Query("SELECT * FROM active_operation WHERE id = 0")
    suspend fun activeOp(): ActiveOperationRow?
    @Query("DELETE FROM active_operation")
    suspend fun clearActiveOp()

    // Bulk teardown -----
    @Query("DELETE FROM consent")            suspend fun clearConsent()
    @Query("DELETE FROM provider")           suspend fun clearProviders()
    @Query("DELETE FROM intent")             suspend fun clearIntents()
    @Query("DELETE FROM session")            suspend fun clearSessions()
    @Query("DELETE FROM capture_event")      suspend fun clearEvents()
    @Query("DELETE FROM ui_state")           suspend fun clearStates()
    @Query("DELETE FROM compile_job")        suspend fun clearJobs()
    @Query("DELETE FROM test_draft")         suspend fun clearDrafts()
    @Query("DELETE FROM approved_test")      suspend fun clearApproved()
    @Query("DELETE FROM replay_run")         suspend fun clearRuns()
    @Query("DELETE FROM mission")            suspend fun clearMissions()
}
