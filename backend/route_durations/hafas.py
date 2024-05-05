from datetime import datetime
from typing import Optional, List, Dict

from tilenames2 import LatLng
from util import get_9am_on_next_monday

from .route_duration_provider import RouteDurationResult

from pyhafas import HafasClient
from pyhafas.types.fptf import Station
from pyhafas.profile import DBProfile
from pyhafas.profile.base.mappings.error_codes import BaseErrorCodesMapping
from pyhafas.types.hafas_response import HafasResponse


class DBProfileCoords(DBProfile):
    def parse_lid_to_station(
        self, lid: str, name: str = "", latitude: float = 0, longitude: float = 0
    ) -> Station:
        parsedLid = self.parse_lid(lid)
        if latitude == 0 and longitude == 0 and parsedLid["X"] and parsedLid["Y"]:
            latitude = float(float(parsedLid["Y"]) / 1000000)
            longitude = float(float(parsedLid["X"]) / 1000000)

        return Station(
            id=-1,
            lid=lid,
            latitude=latitude,
            longitude=longitude,
        )

    def _format_station_hafas_id(self, station: Station) -> dict:
        return {"type": "S", "lid": "A=1@L={}@".format(station.id)}

    def _format_coord(self, x: float) -> str:
        return str(round(x * 1000000))

    def _format_location_identifier(self, data: dict, sep="@") -> str:
        str = ""
        for key in data:
            str += key + "=" + data[key] + sep

        return str

    def format_station_hafas(self, station: Station) -> dict:
        if station.id != "":
            return self._format_station_hafas_id(station)

        address = station.name or ""

        lid = {
            "A": "2",
            "O": address,
            "X": self._format_coord(station.longitude),
            "Y": self._format_coord(station.latitude),
        }

        return {
            "type": "A",
            "name": address,
            "lid": self._format_location_identifier(lid),
        }

    def format_journeys_request(
        self,
        origin: Station,
        destination: Station,
        via: List[Station],
        date: datetime,
        min_change_time: int,
        max_changes: int,
        products: Dict[str, bool],
        max_journeys: int,
    ) -> dict:
        return {
            "req": {
                "arrLocL": [self.format_station_hafas(destination)],
                "viaLocL": [
                    self.format_station_hafas(via_station) for via_station in via
                ],
                "depLocL": [self.format_station_hafas(origin)],
                "outDate": date.strftime("%Y%m%d"),
                "outTime": date.strftime("%H%M%S"),
                "jnyFltrL": [self.format_products_filter(products)],
                "minChgTime": min_change_time,
                "maxChg": max_changes,
                "numF": max_journeys,
            },
            "meth": "TripSearch",
        }


profile = DBProfileCoords()
profile.activate_retry()
client = HafasClient(profile, debug=True)


def query_best_route_duration(
    origin_latlng: LatLng, destination_latlng: LatLng
) -> Optional[RouteDurationResult]:
    origin_station = Station(
        id="", latitude=origin_latlng[0], longitude=origin_latlng[1]
    )
    destination_station = Station(
        id="", latitude=destination_latlng[0], longitude=destination_latlng[1]
    )

    trip = client.journeys(
        origin_station,
        destination_station,
        date=get_9am_on_next_monday(),
        products={
            "long_distance_express": False,
            "long_distance": False,
            "regional_express": True,
            "regional": True,
            "suburban": True,
            "bus": True,
            "ferry": True,
            "subway": True,
            "tram": True,
            "texi": False,
        },
    )

    best_trip_time = min([journey.duration for journey in trip])

    return RouteDurationResult(
        duration=best_trip_time,
        x_headers={
            "x-src": "hafas",
        },
    )
