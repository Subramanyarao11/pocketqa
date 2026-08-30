package com.techphantoms.pocketqa.demotasks

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.techphantoms.pocketqa.demotasks.databinding.RowTaskBinding

/**
 * Every row control gets a stable, per-item view id string via
 * `contentDescription`.
 *
 * A RecyclerView reuses its rows, so `android:id` is identical for every row on
 * screen and cannot identify *which* task was touched — the same ambiguity a
 * Compose list has, arriving by a different route. The content description is
 * what makes each checkbox individually addressable, and it is also what a
 * screen reader would announce, so this is not test-only scaffolding.
 */
class TaskAdapter(
    private var items: List<Task>,
    private val onToggle: (Task) -> Unit,
    private val onDelete: (Task) -> Unit,
) : RecyclerView.Adapter<TaskAdapter.VH>() {

    class VH(val binding: RowTaskBinding) : RecyclerView.ViewHolder(binding.root)

    init { setHasStableIds(true) }

    override fun getItemId(position: Int) = items[position].id.hashCode().toLong()

    fun submit(next: List<Task>) {
        val old = items
        items = next
        // notifyDataSetChanged() detaches every row immediately, including the
        // one just tapped — which means the click event the platform sends
        // arrives with a null source and nothing can say what was clicked.
        // Diffing keeps untouched rows attached, and is what a RecyclerView is
        // supposed to do regardless of who is watching.
        if (old.size == next.size && old.map { it.id } == next.map { it.id }) {
            old.indices
                .filter { old[it].done != next[it].done || old[it].title != next[it].title }
                .forEach { notifyItemChanged(it) }
        } else {
            notifyDataSetChanged()
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(RowTaskBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun getItemCount() = items.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val task = items[position]
        with(holder.binding) {
            root.contentDescription = "task row ${task.id}"
            taskTitle.text = task.title
            taskTitle.contentDescription = "task title ${task.id}"
            taskMeta.text = "${task.project} · ${task.priority}"
            taskMeta.contentDescription = "task meta ${task.id}"

            // Rebinding a recycled row fires the listener with the previous
            // row's state, which silently toggles the wrong task. Detach first.
            taskCheckbox.setOnCheckedChangeListener(null)
            taskCheckbox.isChecked = task.done
            taskCheckbox.contentDescription = "toggle ${task.id}"
            taskCheckbox.setOnCheckedChangeListener { _, _ -> onToggle(task) }

            taskDelete.contentDescription = "delete ${task.id}"
            taskDelete.setOnClickListener { onDelete(task) }
        }
    }
}
