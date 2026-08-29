package com.techphantoms.pocketqa.demotasks

data class Task(
    val id: String,
    var title: String,
    var done: Boolean,
    val priority: String,
    val project: String,
)

/** In-memory store. Reset by the `demotasks://reset` deep link. */
object TaskStore {

    var mode: String = "reset"
        private set

    private val seed: List<Task>
        get() {
            val projects = listOf("Inbox", "Website", "Mobile", "Ops")
            val titles = listOf(
                "Write release notes", "Fix flaky login test", "Review pull request",
                "Update dependency lockfile", "Triage crash reports", "Draft QA checklist",
                "Refresh onboarding copy", "Audit accessibility labels",
                "Rotate signing key", "Prune stale branches", "Measure cold start",
                "Backfill analytics events",
            )
            return titles.mapIndexed { i, t ->
                Task(
                    id = "task_${i + 1}",
                    title = t,
                    done = mode == "all-done" || (mode != "many-tasks" && i % 4 == 3),
                    priority = listOf("High", "Medium", "Low")[i % 3],
                    project = projects[i % projects.size],
                )
            }
        }

    private var items: MutableList<Task> = seed.toMutableList()

    fun apply(fixture: String?) {
        mode = fixture ?: "reset"
        items = seed.toMutableList()
    }

    fun all(): List<Task> = items.toList()
    fun open(): List<Task> = items.filter { !it.done }
    fun done(): List<Task> = items.filter { it.done }

    fun toggle(id: String) {
        items.find { it.id == id }?.let { it.done = !it.done }
    }

    fun delete(id: String) {
        items.removeAll { it.id == id }
    }

    fun add(title: String, priority: String) {
        val n = (items.size + 1)
        items.add(0, Task("task_new_$n", title, false, priority, "Inbox"))
    }
}
