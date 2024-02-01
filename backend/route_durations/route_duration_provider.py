from typing import Callable
from datetime import timedelta


RouteDurationProvider = Callable[[tuple[float, float], tuple[float, float]], timedelta]
