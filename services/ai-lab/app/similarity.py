"""Small, dependency-free string similarity.

Kept deliberately plain: this code is ported to Kotlin as part of the
deterministic engine (task AI-A-15), so anything clever here becomes a
transliteration problem later.
"""

from __future__ import annotations

from app.relevance import content_tokens


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)

    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current = [i]
        for j, cb in enumerate(b, start=1):
            current.append(
                min(
                    previous[j] + 1,          # deletion
                    current[j - 1] + 1,       # insertion
                    previous[j - 1] + (ca != cb),  # substitution
                )
            )
        previous = current
    return previous[-1]


def edit_ratio(a: str, b: str) -> float:
    """1.0 for identical strings, 0.0 for entirely dissimilar ones."""
    a, b = a.strip().lower(), b.strip().lower()
    if not a and not b:
        return 1.0
    longest = max(len(a), len(b))
    if longest == 0:
        return 1.0
    return 1.0 - (levenshtein(a, b) / longest)


def token_jaccard(a: str, b: str) -> float:
    """Overlap of meaning-bearing tokens, synonym-aware via app.relevance."""
    ta, tb = content_tokens(a), content_tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def label_similarity(a: str, b: str) -> float:
    """Blend of both signals.

    Token overlap catches "Apply coupon" / "Coupon apply"; edit distance catches
    "Apply" / "Applyy" and translated-but-similar strings that share no token.
    Neither alone is enough for selector self-heal.
    """
    if not a or not b:
        return 0.0
    return max(token_jaccard(a, b), edit_ratio(a, b) * 0.9)
