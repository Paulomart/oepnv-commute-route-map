from datetime import timedelta, datetime
from typing import Optional

from tilenames2 import LatLng
from clients.opentripplanner_api import (
    query_trip_between_latlng_points,
    get_best_journey_time_from_plan,
)
from util import get_9am_on_next_monday

from .route_duration_provider import RouteDurationResult


def query_best_route_duration(
    origin_latlng: LatLng, destination_latlng: LatLng
) -> Optional[timedelta]:
    trip = query_trip_between_latlng_points(
        origin_latlng,
        destination_latlng,
        departure_datetime=get_9am_on_next_monday(),
    )

    best_trip_time = get_best_journey_time_from_plan(trip)

    return RouteDurationResult(
        duration=best_trip_time,
        x_headers={
            "x-src": "otp",
        },
    )
