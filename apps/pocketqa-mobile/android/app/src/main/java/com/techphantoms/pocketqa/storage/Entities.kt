package com.techphantoms.pocketqa.storage

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * PocketQA persistence — one Room table per canonical schema payload.
 *
 * We store the schema payload as a JSON string (`payload`) rather than shredding
 * every field into columns. That keeps the wire format identical between the
 * JS domain modules and Kotlin, and means schema migrations happen in-place via
 * the schema-version prefix on each payload.
 *
 * All rows carry a `checkpointedAt` timestamp so §10 session persistence can
 * rehydrate the active operation on foreground.
 */

@Entity(tableName = "consent")
data class ConsentRow(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "version") val version: Int,
    @ColumnInfo(name = "grantedAt") val grantedAt: Long,
)

@Entity(tableName = "provider")
data class ProviderRow(
    @PrimaryKey val provider: String,
    @ColumnInfo(name = "maskedKey") val maskedKey: String?,
    @ColumnInfo(name = "encryptedKey") val encryptedKey: ByteArray?,
    @ColumnInfo(name = "updatedAt") val updatedAt: Long,
)

@Entity(tableName = "intent")
data class IntentRow(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "packageName") val packageName: String,
    @ColumnInfo(name = "fixture") val fixture: String?,
    @ColumnInfo(name = "payload") val payload: String,
    @ColumnInfo(name = "createdAt") val createdAt: Long,
)

@Entity(tableName = "session")
data class SessionRow(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "intentId") val intentId: String,
    @ColumnInfo(name = "packageName") val packageName: String,
    @ColumnInfo(name = "state") val state: String, // recording|paused|finalising|hard-stopped
    @ColumnInfo(name = "stepCount") val stepCount: Int,
    @ColumnInfo(name = "startedAt") val startedAt: Long,
    @ColumnInfo(name = "checkpointedAt") val checkpointedAt: Long,
)

@Entity(tableName = "capture_event")
data class CaptureEventRow(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "sessionId") val sessionId: String,
    @ColumnInfo(name = "at") val at: Long,
    @ColumnInfo(name = "payload") val payload: String,
)

@Entity(tableName = "ui_state")
data class UIStateRow(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "packageName") val packageName: String,
    @ColumnInfo(name = "screenName") val screenName: String,
    @ColumnInfo(name = "capturedAt") val capturedAt: Long,
    @ColumnInfo(name = "payload") val payload: String,
)

@Entity(tableName = "compile_job")
data class CompileJobRow(
    @PrimaryKey val jobId: String,
    @ColumnInfo(name = "sessionId") val sessionId: String,
    @ColumnInfo(name = "engine") val engine: String,
    @ColumnInfo(name = "finished") val finished: Boolean,
    @ColumnInfo(name = "payload") val payload: String,
    @ColumnInfo(name = "draftId") val draftId: String?,
    @ColumnInfo(name = "createdAt") val createdAt: Long,
)

@Entity(tableName = "test_draft")
data class TestDraftRow(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "name") val name: String,
    @ColumnInfo(name = "packageName") val packageName: String,
    @ColumnInfo(name = "payload") val payload: String,
    @ColumnInfo(name = "revision") val revision: Int,
    @ColumnInfo(name = "updatedAt") val updatedAt: Long,
)

@Entity(tableName = "approved_test")
data class ApprovedTestRow(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "version") val version: Int,
    @ColumnInfo(name = "name") val name: String,
    @ColumnInfo(name = "packageName") val packageName: String,
    @ColumnInfo(name = "compiledBy") val compiledBy: String,
    @ColumnInfo(name = "payload") val payload: String,
    @ColumnInfo(name = "schemaHash") val schemaHash: String,
    @ColumnInfo(name = "approvedAt") val approvedAt: Long,
)

@Entity(tableName = "replay_run")
data class ReplayRunRow(
    @PrimaryKey val runId: String,
    @ColumnInfo(name = "testId") val testId: String,
    @ColumnInfo(name = "testVersion") val testVersion: Int,
    @ColumnInfo(name = "passed") val passed: Boolean,
    @ColumnInfo(name = "payload") val payload: String,
    @ColumnInfo(name = "finishedAt") val finishedAt: Long,
)

@Entity(tableName = "mission")
data class MissionRow(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "goal") val goal: String,
    @ColumnInfo(name = "payload") val payload: String,
    @ColumnInfo(name = "summaryPayload") val summaryPayload: String?,
    @ColumnInfo(name = "createdAt") val createdAt: Long,
)

@Entity(tableName = "active_operation")
data class ActiveOperationRow(
    @PrimaryKey val id: Int = 0,
    @ColumnInfo(name = "kind") val kind: String,
    @ColumnInfo(name = "operationId") val operationId: String,
    @ColumnInfo(name = "checkpointedAt") val checkpointedAt: Long,
)
