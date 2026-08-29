"""Deterministic intent relevance — Technical Spec section 17.3.

This module is the backbone of the deterministic twins for assertion ranking,
intent compilation and explorer ranking. It is also the code Track A ports to
Kotlin as part of `DeterministicInferenceEngine` (task AI-A-15), so keep it
free of anything that has no Kotlin equivalent: no regex exotica, no locale
tables, no numpy.

Rules implemented here, in the order the spec states them:

  - tokenize normalized intent and UI text
  - retain product entities, error terms, negations, action verbs, numbers/codes
  - lexical overlap plus simple synonyms
  - boost candidates observed after the final relevant action
  - never invent an expected value absent from intent or evidence
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_TOKEN = re.compile(r"[a-z0-9]+")

STOPWORDS: frozenset[str] = frozenset(
    """
    a an the is are was were be been being am do does did doing have has had having
    i me my we our you your he she it they them this that these those there here
    and or but if then than so as of at by for with about into to from on off in out
    up down over under further once all any both each few more most other some
    such only own same too very can will just should now must shall may might would
    """.split()
)

# PocketQA's own scaffolding vocabulary. These words appear in almost every
# intent and almost every compiler-generated fact, so they inflate overlap
# without carrying meaning. Removing them is what separates "shares intent
# terms" from "shares the words every candidate shares".
SCAFFOLDING: frozenset[str] = frozenset(
    """
    verify check ensure confirm test assert expect expected observe observed
    text visible shown displayed appears appear state screen page view final
    element control widget node label value string
    """.split()
)

# Romanised Hindi function words. PocketQA is an India-first product and intents
# arrive code-mixed ("checkout fail hone ke baad bhi coupon apply rehna chahiye").
# Without these, every Hinglish intent carries a long tail of meaningless tokens
# that shrinks real overlap and pushes good candidates under the threshold.
HINGLISH_STOPWORDS: frozenset[str] = frozenset(
    """
    ka ke ki ko se me mein par pe hai hain ho hona hone hui hua huye tha the thi
    bhi aur ya na nahi nahin ye yeh wo woh is us jo kya kar karna karke kiya
    chahiye sakta sakti raha rahe rahi liye lie ek bahut sab kuch abhi phir toh
    baad pehle jab tab agar lekin
    """.split()
)

# Concept groups. The canonical form is the first entry. Kept small and explicit:
# a big fuzzy synonym table is how a deterministic ranker becomes unpredictable.
SYNONYM_GROUPS: tuple[tuple[str, ...], ...] = (
    ("retry", "again", "reattempt", "retried", "retries", "dobara", "dubara"),
    ("coupon", "discount", "offer", "promo", "promocode", "voucher"),
    ("cart", "basket", "bag"),
    ("checkout", "pay", "payment", "order", "purchase", "buy"),
    ("error", "fail", "fails", "failed", "failing", "failure", "unable", "problem",
     "issue", "wrong", "galat", "kharab"),
    ("apply", "applied", "applies", "activate", "activated", "use", "used"),
    ("remain", "remains", "remaining", "stay", "stays", "persist", "persists",
     "still", "kept", "keep", "keeps", "intact", "rehna", "rahega", "bana"),
    ("total", "amount", "payable", "sum", "subtotal"),
    ("remove", "removed", "removes", "delete", "deleted", "cleared", "clear", "gone"),
    ("login", "signin", "logon", "authenticate"),
    ("loading", "loader", "spinner", "please", "wait"),
)

_CANONICAL: dict[str, str] = {
    word: group[0] for group in SYNONYM_GROUPS for word in group
}

NEGATIONS: frozenset[str] = frozenset(
    {"not", "no", "never", "without", "isnt", "arent", "doesnt", "dont", "cannot", "cant", "nor"}
)

ERROR_TERMS: frozenset[str] = frozenset({"error", "failed", "failure", "unable", "problem", "issue"})

# Text that is real but worthless as an assertion (spec 17.2 filter list).
TRANSIENT_MARKERS: tuple[str, ...] = (
    "loading", "please wait", "spinner", "one moment", "updating", "refreshing",
)
_DYNAMIC = re.compile(
    r"""(\b\d{1,2}:\d{2}(:\d{2})?\b            # clock times
        |\b\d{4}-\d{2}-\d{2}\b                 # iso dates
        |\bsession[_-]?\w*\d{3,}\b             # session ids
        |\b[0-9a-f]{16,}\b                     # hashes / opaque ids
        |\b\d+\s*(ms|seconds?|secs?|minutes?|mins?)\s+ago\b)""",
    re.IGNORECASE | re.VERBOSE,
)
# A code is an assertion goldmine: SAVE20, INR499, ORDER123. Case matters before
# lowercasing, so this runs on the raw string.
_CODE = re.compile(r"\b(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]{4,}\b")


def tokenize(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


def canonical(token: str) -> str:
    return _CANONICAL.get(token, token)


def content_tokens(text: str) -> set[str]:
    """Meaning-bearing tokens, canonicalized through the synonym groups."""
    return {
        canonical(t)
        for t in tokenize(text)
        if t not in STOPWORDS
        and t not in SCAFFOLDING
        and t not in HINGLISH_STOPWORDS
        and len(t) > 1
    }


def codes(text: str) -> set[str]:
    """Uppercase alphanumeric codes such as SAVE20. Matched case-sensitively on
    the raw text, then compared case-insensitively."""
    return {c.lower() for c in _CODE.findall(text)}


def numbers(text: str) -> set[str]:
    return {t for t in tokenize(text) if t.isdigit()}


def has_negation(text: str) -> bool:
    return bool(NEGATIONS & set(tokenize(text)))


def is_transient(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in TRANSIENT_MARKERS)


def is_dynamic(text: str) -> bool:
    return bool(_DYNAMIC.search(text))


@dataclass(frozen=True, slots=True)
class Intent:
    """A parsed intent. Built once per request and reused across candidates so
    ranking cost stays linear in the candidate count."""

    raw: str
    tokens: set[str]
    codes: set[str]
    numbers: set[str]
    negated: bool

    @classmethod
    def parse(cls, text: str) -> Intent:
        return cls(
            raw=text,
            tokens=content_tokens(text),
            codes=codes(text),
            numbers=numbers(text),
            negated=has_negation(text),
        )


@dataclass(frozen=True, slots=True)
class RelevanceScore:
    score: float
    reasons: tuple[str, ...]

    def top_reason(self) -> str:
        """The single reason that moved the score most.

        Reasons are stored strongest-first, including penalties. A candidate that
        ranks last because its text is a per-run order id should say so, not
        report the weak positive signal it also happened to match.
        """
        return self.reasons[0] if self.reasons else "No matching intent signal"


def score_text(intent: Intent, text: str, *, is_end_state: bool = False) -> RelevanceScore:
    """Score one piece of candidate evidence against the intent.

    Weights are tuned for repeatable ordering rather than calibrated probability
    (spec 16.2 makes the same point about selector scores). What matters is that
    a direct code match always outranks a generic lexical overlap, and that a
    per-run identifier always sinks.
    """

    contributions: list[tuple[float, str]] = []

    candidate_tokens = content_tokens(text)
    candidate_codes = codes(text)
    candidate_numbers = numbers(text)

    shared_codes = intent.codes & candidate_codes
    if shared_codes:
        contributions.append(
            (0.45, f"Names the code {sorted(shared_codes)[0].upper()} from the intent")
        )

    if intent.tokens:
        overlap = intent.tokens & candidate_tokens
        if overlap:
            ratio = len(overlap) / len(intent.tokens)
            contributions.append(
                (0.40 * ratio, "Shares intent terms " + ", ".join(sorted(overlap)[:3]))
            )

    shared_numbers = intent.numbers & candidate_numbers
    if shared_numbers and not shared_codes:
        contributions.append((0.10, "Matches a numeric value named in the intent"))

    if ERROR_TERMS & candidate_tokens:
        # Error text is rarely the goal, but it is usually the precondition the
        # intent is really about ("after checkout fails").
        if ERROR_TERMS & intent.tokens:
            contributions.append(
                (0.12, "Confirms the failure condition the intent describes")
            )
        else:
            contributions.append((-0.05, "Mentions an error the intent does not"))

    if is_end_state:
        contributions.append(
            (0.15, "Observed in the final state after the last relevant action")
        )

    if is_transient(text):
        contributions.append((-0.35, "Transient loading text is unstable as an assertion"))

    if is_dynamic(text):
        contributions.append(
            (-0.30, "Contains a timestamp or opaque identifier that changes per run")
        )

    if intent.negated and not has_negation(text):
        # The intent is about something *not* happening; a positive fact may still
        # be relevant, but it is weaker evidence.
        contributions.append((-0.05, "Intent is negative but this fact is positive"))

    total = sum(delta for delta, _ in contributions)
    contributions.sort(key=lambda row: -abs(row[0]))
    return RelevanceScore(
        max(0.0, min(1.0, round(total, 4))),
        tuple(reason for _, reason in contributions),
    )
