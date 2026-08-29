"""Base contract models, split out to break an import cycle.

`app/domain.py` needs `Contract`, and `app/tasks/base.py` is where it used to
live — but importing anything from `app.tasks.base` executes `app/tasks/__init__`,
which imports every task module, several of which import `app.domain`. So
`import app.domain` as a program's *first* import crashed with a partially
initialised module. It only ever worked because every entry point happened to
import `app.tasks` first, which is luck rather than design.

These two classes depend on nothing in the package, so they belong at the bottom
of the import graph. `app.tasks.base` re-exports them, so existing imports keep
working.
"""

from __future__ import annotations

from typing import ClassVar

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class Contract(BaseModel):
    """Base for every request and response model.

    `extra="forbid"` is a safety control, not tidiness: an unexpected key in a
    model response is an attempt to smuggle a field past the schema, and the
    correct handling is rejection.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        frozen=False,
        str_strip_whitespace=True,
    )


class BaseResponse(Contract):
    """Every task can decline. `insufficientEvidence` is the escape hatch that
    keeps a model from inventing an answer to look useful (spec 19.1)."""

    insufficient_evidence: bool = False

    ESCAPE_FIELD: ClassVar[str] = "insufficient_evidence"

    #: Fields the *system* asserts, which the model must never be asked to emit.
    #: Named by their serialisation alias. They are stripped from the schema sent
    #: to the provider and filled from the model default after parsing.
    #:
    #: This exists because of a real failure: `repair_selector` declared
    #: `reviewRequired: Literal[True]`, strict structured outputs force every
    #: property into `required`, and so every model was asked whether human
    #: review was required, answered `false`, and had its entire response
    #: discarded. Whether a repair needs review is not the model's call, and it
    #: should never have been in its schema.
    SERVER_ASSERTED: ClassVar[tuple[str, ...]] = ()
