from typing import Callable
from datetime import timedelta
from dataclasses import dataclass
from pydantic import BaseModel


class RouteDurationResult(BaseModel):
    duration: timedelta
    x_headers: dict[str, str]


RouteDurationProvider = Callable[
    [tuple[float, float], tuple[float, float]], RouteDurationResult
]
