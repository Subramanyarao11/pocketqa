package com.techphantoms.pocketqa.demobank.data

data class Account(
    val id: String,
    val name: String,
    val masked: String,
    val balancePaise: Long,
)

data class Payee(val id: String, val name: String, val handle: String)

data class Txn(
    val id: String,
    val label: String,
    val amountPaise: Long,
    val daysAgo: Int,
    val category: String,
)

/**
 * Fixed data so a replay sees the same screen it recorded.
 *
 * Amounts are integers in paise, never floats: a balance rendered from a
 * double drifts in its last digit between runs and turns a correct assertion
 * into a flake. That is a real defect in banking UIs and it is deliberately
 * avoided here, because the point of this app is to test PocketQA, not to
 * hand it noise it cannot do anything about.
 */
object Fixtures {

    /** `transfer-declined` makes the confirm step fail; `low-balance` starves it. */
    var mode: String = "reset"
        private set

    fun apply(fixture: String?) {
        mode = fixture ?: "reset"
    }

    fun reset() = apply("reset")

    val accounts: List<Account>
        get() = listOf(
            Account(
                "acct_savings", "Savings", "•••• 4412",
                if (mode == "low-balance") 8_50 else 4_82_150,
            ),
            Account("acct_current", "Current", "•••• 9930", 1_12_400),
        )

    val payees = listOf(
        Payee("payee_1", "Asha Menon", "asha@upi"),
        Payee("payee_2", "Ravi Kumar", "ravi.k@upi"),
        Payee("payee_3", "Nila Textiles", "nila@upi"),
    )

    /** Long enough that the list must be scrolled to reach the end. */
    val transactions: List<Txn> = buildList {
        val labels = listOf(
            "Metro card top-up" to "Transport",
            "Coffee Culture" to "Food",
            "Electricity bill" to "Bills",
            "Bookstore" to "Shopping",
            "Pharmacy" to "Health",
            "Cab fare" to "Transport",
            "Groceries" to "Food",
            "Mobile recharge" to "Bills",
        )
        var day = 1
        repeat(4) { cycle ->
            labels.forEachIndexed { i, (label, cat) ->
                add(
                    Txn(
                        id = "txn_${cycle}_$i",
                        label = label,
                        amountPaise = ((i + 1) * 137L + cycle * 90L) * 100,
                        daysAgo = day++,
                        category = cat,
                    )
                )
            }
        }
    }

    fun rupees(paise: Long): String {
        val whole = paise / 100
        val frac = (paise % 100).toInt()
        return "₹" + "%,d".format(whole) + ".%02d".format(frac)
    }
}
