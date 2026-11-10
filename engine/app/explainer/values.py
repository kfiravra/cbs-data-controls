"""How a value is written in a sentence or a reason (contracts/errors.md, Rendering, Values).

Nothing here uses `locale` or `strftime`: both depend on the machine, and `%-d` does not exist on Windows.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from app.glossary import Field, Formats

_GROUP = 3


def as_json_scalar(value: Any) -> Any:
    """A raw value as JSON carries it: a `Decimal` as a number, a date as `YYYY-MM-DD`."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, date):
        return value.isoformat()
    return value


def format_date(value: date, formats: Formats) -> str:
    """The pattern's tokens `dd`, `MM` and `yyyy`, filled from the date's own fields."""
    return (
        formats.date.replace("yyyy", f"{value.year:04d}")
        .replace("MM", f"{value.month:02d}")
        .replace("dd", f"{value.day:02d}")
    )


def format_number(value: int | float | Decimal, formats: Formats, *, grouped: bool = True) -> str:
    """Groups of three integer digits, the fraction without its trailing zeros (`15000.50` is `15,000.5`).

    `grouped=False` writes the digits as they are: a number that names a record is not a quantity.
    """
    number = value if isinstance(value, Decimal) else Decimal(str(value))
    sign = "-" if number < 0 else ""
    whole, _, fraction = format(abs(number), "f").partition(".")
    fraction = fraction.rstrip("0")
    if grouped:
        head = len(whole) % _GROUP
        groups = ([whole[:head]] if head else []) + [whole[i : i + _GROUP] for i in range(head, len(whole), _GROUP)]
        whole = formats.group_separator.join(groups)
    return sign + whole + (formats.decimal_separator + fraction if fraction else "")


def format_value(value: Any, field: Field, formats: Formats, language: str) -> str:
    """A value of a field as text; a NULL renders as nothing. The unit follows after one space."""
    if value is None:
        return ""
    text = _bare(value, field, formats, language)
    if field.unit is not None and text:
        return f"{text} {field.unit[language]}"
    return text


def _bare(value: Any, field: Field, formats: Formats, language: str) -> str:
    if field.type == "date" and isinstance(value, date):
        return format_date(value, formats)
    if field.type == "number" and isinstance(value, (int, float, Decimal)) and not isinstance(value, bool):
        return format_number(value, formats, grouped=not field.identifier)
    if field.type == "bool" and isinstance(value, bool) and field.value_labels is not None:
        return field.value_labels[value][language]
    if field.type == "enum" and isinstance(value, str):
        # Found without regard to case, as the database compares it; a stored value with no entry is shown as stored.
        for item in field.enum_values:
            if item.value.casefold() == value.casefold():
                return item.label[language]
    return str(value)
