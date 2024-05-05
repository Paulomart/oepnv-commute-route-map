from typing import Callable, Optional
from datetime import timedelta
from dataclasses import dataclass
from pydantic import BaseModel


class RouteDurationResult(BaseModel):
    duration: Optional[timedelta]
    x_headers: dict[str, str]


RouteDurationProvider = Callable[
    [tuple[float, float], tuple[float, float]], RouteDurationResult
]
