import requests
from typing import Optional
from datetime import timedelta, datetime

from tilenames2 import LatLng


def query_trip_between_latlng_points_old(
    origin_latlng: LatLng, destination_latlng: LatLng
) -> any:
    url = "http://localhost:8080/otp/routers/default/plan"

    query = {
        "fromPlace": format_coordinates(origin_latlng),
        "toPlace": format_coordinates(destination_latlng),
        "module": "planner",
        "time": "12:54pm",
        "date": "01-29-2024",
        "mode": "TRANSIT,WALK",
        "arriveBy": "false",
        "wheelchair": "false",
        "showIntermediateStops": "false",
        "locale": "de",
        "baseLayer": "OSM Standard Tiles",
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

    url = "http://localhost:8080/otp/routers/default/index/graphql"

    query = """
query ExampleQuery($arriveBy: Boolean, $date: String, $time: String, $from_lat: Float!, $from_lon: Float!, $to_lat: Float!, $to_lon: Float!) {
  plan(
    from: {
      lat: $from_lat,
      lon: $from_lon
    },
    to: {
      lat: $to_lat,
      lon: $to_lon
    },
    date: $date,
    time: $time,
    arriveBy: $arriveBy,
    searchWindow: 3600,
    numItineraries: 10
  ) {
    itineraries {
      duration
    }
  }
}"""

    variables = {
        "from_lat": origin_latlng[0],
        "from_lon": origin_latlng[1],
        "to_lat": destination_latlng[0],
        "to_lon": destination_latlng[1],
    }

    if departure_datetime is not None:
        variables["date"] = departure_datetime.strftime("%Y-%m-%d")
        variables["time"] = departure_datetime.strftime("%H:%M:%S")
        variables["arriveBy"] = False

    if arrival_datetime is not None:
        variables["date"] = arrival_datetime.strftime("%Y-%m-%d")
        variables["time"] = arrival_datetime.strftime("%H:%M:%S")
        variables["arriveBy"] = True

    query_json = {
        "query": query,
        "variables": variables,
        "operationName": "ExampleQuery",
    }

    response = requests.post(url, json=query_json)
    return response.json()["data"]["plan"]


def get_best_journey_time_from_plan(trip: any) -> Optional[timedelta]:
    min_duration = None

    if "itineraries" not in trip:
        return None

    for itinerary in trip["itineraries"]:
        duration_for_itinerary = itinerary["duration"]

        if min_duration is None or duration_for_itinerary < min_duration:
            min_duration = duration_for_itinerary

    if min_duration is None:
        return None

    return timedelta(seconds=min_duration)


# test = query_trip_between_latlng_points(
#     (51.55487448974971, 7.053222656250001), (51.40777268236964, 6.795043945312501)
# )


# print(test)

# await fetch("http://localhost:8080/", {
#     "credentials": "include",
#     "headers": {
#         "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
#         "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
#         "Accept-Language": "de,en-US;q=0.7,en;q=0.3",
#         "Sec-GPC": "1",
#         "Upgrade-Insecure-Requests": "1",
#         "Sec-Fetch-Dest": "document",
#         "Sec-Fetch-Mode": "navigate",
#         "Sec-Fetch-Site": "none",
#         "Sec-Fetch-User": "?1",
#         "Pragma": "no-cache",
#         "Cache-Control": "no-cache"
#     },
#     "method": "GET",
#     "mode": "cors"
# });
