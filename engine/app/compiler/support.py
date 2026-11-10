"""Whether the compiler can serve a glossary: asked once at startup, so a gap is not found by a run."""

from __future__ import annotations

from app.compiler.computed import COMPUTED
from app.compiler.operators import OPERATORS
from app.glossary import Glossary


def unsupported(glossary: Glossary) -> list[str]:
    """What the glossary asks for that the compiler has no expression for; empty when the two agree."""
    gaps = [f"operator {key}" for key in glossary.operators if key not in OPERATORS]
    for entity in glossary.entities.values():
        for field in entity.fields.values():
            if field.computed is None:
                continue
            where = f"field {entity.key}.{field.key}"
            function = COMPUTED.get(field.computed.function)
            if function is None:
                gaps.append(f"{where}: function {field.computed.function}")
                continue
            gaps += [f"{where}: operator {key}" for key in field.operators if key not in function.predicates]
            if field.comparable:
                # Two fields are compared column to column, and a computed field has no column of its own.
                gaps.append(f"{where}: a computed field must be marked comparable: false")
    return gaps
