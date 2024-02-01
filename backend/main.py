import os
from typing import Annotated

from fastapi import FastAPI, Response, Path, Query
from fastapi.staticfiles import StaticFiles

import tilenames2
import route_durations.opentripplanner
import route_durations.vrr
import route_durations.hafas
from route_durations.route_duration_provider import RouteDurationProvider
from tile_renderer import render_tile

import clients.vrr_api as vrr_api
from wrap_as_memcached import get_memcached_wrapper


memcache_wrapper = get_memcached_wrapper(os.environ.get("MEMCACHED_URL"))

route_duration_providers: dict[str, RouteDurationProvider] = {
    "vrr": memcache_wrapper.wrap_duration_provider(
        "vrr", route_durations.vrr.query_best_route_duration
    ),
    "otp": memcache_wrapper.wrap_duration_provider(
        "otp", route_durations.opentripplanner.query_best_route_duration
    ),
    "hafas": memcache_wrapper.wrap_duration_provider(
        "hafas", route_durations.hafas.query_best_route_duration
    ),
}

search_locations_fn = memcache_wrapper.wrap_location_search(vrr_api.search_locations)


app = FastAPI()


@app.get("/api/locations/search/")
def search_locations(q: str = Annotated[str, Query(min_length=2)]):
    return search_locations_fn(q)


@app.get(
    "/api/{src}/{origin_lat},{origin_lng}/{tile_size}/{z}/{x}/{y}.png",
    responses={200: {"content": {"image/png": {}}}},
    response_class=Response,
)
def generate_random_noice_tile_image(
    src: Annotated[str, Path(regex="^(vrr|otp|hafas)$")],
    origin_lat: float,
    origin_lng: float,
    tile_size: Annotated[int, Path(le=256, ge=64)],
    z: int,
    x: int,
    y: int,
):
    origin_latlng = (origin_lat, origin_lng)

    center_latlng = tilenames2.xy_to_latlon(x, y, z, tile_size_pixels=tile_size)

    if src not in route_duration_providers:
        raise Exception("Unknown src")

    provider = route_duration_providers[src]
    best_journey_time = provider(
        origin_latlng,
        center_latlng,
    )

    image = render_tile(tile_size, best_journey_time)

    return Response(
        content=image,
        media_type="image/png",
        headers={"Cache-Control": "max-age=86400"},
    )


app.mount("/", StaticFiles(directory="static", html=True), name="static")
