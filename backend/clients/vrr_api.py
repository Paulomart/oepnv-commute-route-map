import requests
from typing import Optional, Literal
from datetime import timedelta, datetime

from tilenames2 import LatLng

common_vrr_query_params = {"outputFormat": "rapidJSON", "version": "10.4.18.18"}


def format_coordinates(latlng: LatLng) -> str:
    (latitude, longitude) = latlng

    if latitude < 0 or longitude < 0:
        raise ValueError("Coordinates must be positive")

    if latitude > 90:
        raise ValueError("Latitude must be less than 90")

    if longitude > 180:
        raise ValueError("Longitude must be less than 180")

    # If I am not mistaken, the VRR API expects the coordinates with the
    # longitude first. Unlike the rest of the world, which uses latitude first.

    return f"{longitude:.5f}:{latitude:.5f}:WGS84[dd.ddddd]"


def search_locations(search: str) -> any:
    url = "http://openservice-test.vrr.de/static02/XML_STOPFINDER_REQUEST"
    url = "http://www.vrr.de/vrr-efa/XML_STOPFINDER_REQUEST"

    query = {
        "name_sf": search,
        "type_sf": "any",
        "convertAddressesITKernel2LocationServer": "1",
        "convertCoord2LocationServer": "1",
        "convertCrossingsITKernel2LocationServer": "1",
        "convertPOIsITKernel2LocationServer": "1",
        "convertStopsPTKernel2LocationServer": "1",
        "coordOutputFormat": "WGS84[dd.ddddd]",
        "doNotSearchForStops_sf": "1",
        "language": "de",
        "locationInfoActive": "1",
        "locationServerActive": "1",
        "serverInfo": "1",
        "sl3plusStopFinderMacro": "trip",
        "vrrStopFinderMacro": "1",
        **common_vrr_query_params,
    }

    response = requests.get(url, params=query)
    return response.json()


def query_trip_between_latlng_points(
    origin_latlng: LatLng,
    destination_latlng: LatLng,
    departure_datetime: datetime = None,
    arrival_datetime: datetime = None,
) -> any:
    if departure_datetime is not None and arrival_datetime is not None:
        raise ValueError("Cannot specify both departure_datetime and arrival_datetime")

    url = "http://openservice-test.vrr.de/static03/XML_TRIP_REQUEST2"

    query = {
        "name_origin": format_coordinates(origin_latlng),
        "type_origin": "coord",
        "name_destination": format_coordinates(destination_latlng),
        "type_destination": "coord",
        "itdDate": "01",
        **prepare_planed_time_option(departure_datetime, "dep"),
        **prepare_planed_time_option(arrival_datetime, "arr"),
        **common_vrr_query_params,
    }

    response = requests.get(url, params=query)
    return response.json()


def prepare_planed_time_option(
    planned_time: Optional[datetime], itdTripDateTimeDepArr: Literal["dep", "arr"]
) -> dict:
    if planned_time is None:
        return {}

    itdDate = planned_time.strftime("%Y%m%d")
    itdTime = planned_time.strftime("%H%M") + "h"

    return {
        "itdDate": itdDate,
        "itdTime": itdTime,
        "itdTripDateTimeDepArr": itdTripDateTimeDepArr,
    }


def get_best_journey_time_from_trip(trip: any) -> Optional[timedelta]:
    min_duration = None

    if "journeys" not in trip:
        return None

    for journey in trip["journeys"]:
        duration_for_journey = 0

        for leg in journey["legs"]:
            if "duration" not in leg:
                continue
            duration_for_journey += leg["duration"]

        if min_duration is None or duration_for_journey < min_duration:
            min_duration = duration_for_journey

    if min_duration is None:
        return None

    return timedelta(seconds=min_duration)


# dest = LatLng(51.457643729100646, 7.004127502441406)

# test = query_trip_between_location_and_point_latlng(
#     origin_id="de:05513:5613",
#     destination_latlng=dest,
# )

# print(test)

# best = get_best_journey_time_from_trip(test)

# print(best)
