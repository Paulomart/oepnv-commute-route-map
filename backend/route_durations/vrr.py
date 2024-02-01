from datetime import timedelta
from typing import Optional

from tilenames2 import LatLng
from clients.vrr_api import (
    query_trip_between_latlng_points,
    get_best_journey_time_from_trip,
)
from util import get_9am_on_next_monday


def query_best_route_duration(
    origin_latlng: LatLng, destination_latlng: LatLng
) -> Optional[timedelta]:
    trip = query_trip_between_latlng_points(
        origin_latlng,
        destination_latlng,
        departure_datetime=get_9am_on_next_monday(),
    )

    return get_best_journey_time_from_trip(trip)
