"""Turn a Pydantic JSON Schema into one a strict structured-output API accepts.

Providers implementing OpenAI-style `json_schema` with `strict: true` accept only
a subset of JSON Schema. The rules that bite us:

  - every object must carry `additionalProperties: false`
  - every object's `required` must list *all* of its properties; an optional
    field has to become a nullable union instead
  - validation keywords (`pattern`, `minLength`, `minimum`, `minItems`, `format`,
    `default`, ...) are rejected outright by some providers and silently ignored
    by others

Stripping the validation keywords is safe here because they are not our only
line of defence. Three layers run in order, and each is narrower than the last:

  1. the strict schema constrains the *shape* of the response
  2. Pydantic re-validates the parsed object and enforces every constraint we
     just stripped (`ge`, `le`, `pattern`, `max_length`, `extra="forbid"`)
  3. app.merge enforces the closed vocabulary

So a model that returns `score: 1.4` or `variantId: "banana"` is rejected at
layer 2, and one that returns a fabricated id is rejected at layer 3. Stripping
at layer 1 costs us nothing but a slightly less helpful hint to the model.
"""

from __future__ import annotations

from typing import Any

# Keywords a strict structured-output endpoint may reject. We enforce all of
# these ourselves in Pydantic immediately after parsing.
_UNSUPPORTED = frozenset(
    {
        "default", "format", "pattern", "minLength", "maxLength",
        "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
        "minItems", "maxItems", "uniqueItems", "multipleOf",
        "examples", "$comment", "readOnly", "writeOnly", "deprecated",
    }
)


def to_strict(schema: dict[str, Any], drop: tuple[str, ...] = ()) -> dict[str, Any]:
    """Return a deep copy of `schema` that satisfies strict structured outputs.

    `drop` removes top-level properties the model must not be asked to emit —
    see `BaseResponse.SERVER_ASSERTED`.

    `$ref`/`$defs` indirection is resolved away first. Pydantic factors every
    nested model and every enum into `$defs`, so a response schema arrives as a
    tree of pointers. Large models follow those fine; a device-sized model has to
    hold the pointer target in mind while generating, and that is exactly the kind
    of indirection it drops. Inlining costs a few hundred tokens and removes the
    whole class of failure.
    """
    out = _walk(_inline_refs(schema))
    if drop:
        properties = out.get("properties", {})
        for name in drop:
            properties.pop(name, None)
        out["required"] = [name for name in out.get("required", []) if name not in drop]
    return out


_MAX_INLINE_DEPTH = 12


def _inline_refs(schema: dict[str, Any]) -> dict[str, Any]:
    """Replace every `$ref` with its definition and drop `$defs`."""
    defs = schema.get("$defs", {})

    def resolve(node: Any, depth: int) -> Any:
        if depth > _MAX_INLINE_DEPTH:
            # Our contracts are not recursive; this only guards against a future
            # model that is, where inlining would not terminate.
            return node
        if isinstance(node, list):
            return [resolve(item, depth + 1) for item in node]
        if not isinstance(node, dict):
            return node

        ref = node.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/$defs/"):
            target = defs.get(ref.split("/")[-1])
            if target is not None:
                merged = resolve(target, depth + 1)
                # Keywords sitting alongside the $ref (title, description,
                # default) stay with the use site and win over the definition.
                extra = {k: resolve(v, depth + 1) for k, v in node.items() if k != "$ref"}
                return {**merged, **extra} if isinstance(merged, dict) else merged

        return {
            key: resolve(value, depth + 1)
            for key, value in node.items()
            if key != "$defs"
        }

    return resolve(schema, 0)


def _walk(node: Any) -> Any:
    if isinstance(node, list):
        return [_walk(item) for item in node]
    if not isinstance(node, dict):
        return node

    out: dict[str, Any] = {}
    for key, value in node.items():
        if key in _UNSUPPORTED:
            continue
        out[key] = _walk(value)

    if out.get("type") == "object" or "properties" in out:
        out.setdefault("type", "object")
        out["additionalProperties"] = False
        properties = out.get("properties", {})
        # Strict mode requires every property to be required. Pydantic fields
        # with defaults are legitimately optional, so they are listed as required
        # here and the model is told, via the schema shape alone, that it must
        # emit them. Anything genuinely optional should be typed `X | None` in
        # the model, which becomes a nullable union and stays satisfiable.
        out["required"] = list(properties.keys())

    return out


def response_format(
    name: str, schema: dict[str, Any], drop: tuple[str, ...] = ()
) -> dict[str, Any]:
    """The `response_format` block for an OpenAI-compatible chat completion."""
    return {
        "type": "json_schema",
        "json_schema": {
            "name": name,
            "strict": True,
            "schema": to_strict(schema, drop),
        },
    }
