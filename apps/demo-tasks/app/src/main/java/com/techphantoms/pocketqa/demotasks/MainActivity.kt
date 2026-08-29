package com.techphantoms.pocketqa.demotasks

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.ArrayAdapter
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.techphantoms.pocketqa.demotasks.databinding.ActivityMainBinding
import com.techphantoms.pocketqa.demotasks.databinding.DialogAddTaskBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var adapter: TaskAdapter
    private var tab = "open"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleDeepLink(intent)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        adapter = TaskAdapter(
            items = visible(),
            onToggle = { TaskStore.toggle(it.id); render() },
            onDelete = { confirmDelete(it) },
        )
        binding.taskList.layoutManager = LinearLayoutManager(this)
        binding.taskList.adapter = adapter

        binding.bottomNav.setOnItemSelectedListener { item ->
            tab = when (item.itemId) {
                R.id.tab_done -> "done"
                R.id.tab_all -> "all"
                else -> "open"
            }
            render()
            true
        }

        binding.addTaskFab.setOnClickListener { showAddDialog() }
        render()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
        render()
    }

    private fun handleDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.host == "reset") TaskStore.apply(uri.getQueryParameter("fixture"))
    }

    private fun visible(): List<Task> = when (tab) {
        "done" -> TaskStore.done()
        "all" -> TaskStore.all()
        else -> TaskStore.open()
    }

    private fun render() {
        val shown = visible()
        adapter.submit(shown)
        binding.summaryText.text =
            "${TaskStore.open().size} open · ${TaskStore.done().size} done · showing ${shown.size}"
    }

    /**
     * A confirm dialog in front of a destructive action, so PocketQA has a real
     * irreversible control to refuse rather than a synthetic one.
     */
    private fun confirmDelete(task: Task) {
        AlertDialog.Builder(this)
            .setTitle("Delete task")
            .setMessage("Delete \"${task.title}\"? This cannot be undone.")
            .setPositiveButton("Delete") { _, _ -> TaskStore.delete(task.id); render() }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showAddDialog() {
        val dialogBinding = DialogAddTaskBinding.inflate(LayoutInflater.from(this))
        dialogBinding.newTaskTitle.contentDescription = "new task title"
        dialogBinding.newTaskPriority.contentDescription = "new task priority"
        dialogBinding.newTaskPriority.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item,
            listOf("High", "Medium", "Low"),
        )

        val dialog = AlertDialog.Builder(this)
            .setTitle("New task")
            .setView(dialogBinding.root)
            .setPositiveButton("Add", null) // set below so validation can block dismissal
            .setNegativeButton("Cancel", null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val title = dialogBinding.newTaskTitle.text.toString().trim()
                if (title.length < 3) {
                    // Validation that keeps the dialog open is the interesting
                    // case: the tree changes without the window going away.
                    dialogBinding.newTaskError.text = "Title needs at least 3 characters."
                    dialogBinding.newTaskError.visibility = View.VISIBLE
                    return@setOnClickListener
                }
                TaskStore.add(title, dialogBinding.newTaskPriority.selectedItem.toString())
                render()
                dialog.dismiss()
            }
        }
        dialog.show()
    }
}
