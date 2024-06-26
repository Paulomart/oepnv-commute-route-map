from pymemcache.client.base import Client
from route_durations.route_duration_provider import (
    RouteDurationProvider,
    RouteDurationResult,
)
from datetime import timedelta, datetime, UTC
from typing import Optional, List, Callable
import json
from tilenames2 import LatLng
import functools
from hashlib import md5
from pydantic import BaseModel


def get_memcached_wrapper(memcached_url: str):
    if memcached_url is None:
        return NoopWrapper()
    else:
        return MemcachedWrapper(memcached_url)


def latlng_to_short_str(latlng: LatLng) -> str:
    return f"{latlng[0]:.6f},{latlng[1]:.6f}"


def compute_cache_key(
    prefix: str, origin_latlng: LatLng, destination_latlng: LatLng
) -> str:
    value = f"v2-{prefix}-{latlng_to_short_str(origin_latlng)}-{latlng_to_short_str(destination_latlng)}"
    return md5(value.encode("utf-8")).hexdigest()


class CacheEntry(BaseModel):
    is_present: bool
    value: Optional[RouteDurationResult]


class MemcachedWrapper:
    def __init__(self, memcached_url: str):
        self.memcached_client = Client(memcached_url)

    def wrap_location_search(
        self, func: Callable[[str], List]
    ) -> Callable[[str], List]:
        @functools.wraps(func)
        def wrapper(q: str) -> List:
            key = md5(f"search-{q}".encode("utf-8")).hexdigest()

            try:
                location_list = self.memcached_client.get(key, None)
            except:
                location_list = None

            if location_list is not None:
                try:
                    location_list = json.loads(location_list)
                    # print("Cache hit")
                except:
                    # print("Cache hit but invalid value")
                    location_list = None

            if location_list is None:
                # print("Cache miss")
                location_list = func(q)

                self.memcached_client.set(
                    key=key,
                    value=json.dumps(location_list),
                    expire=int(timedelta(weeks=1).total_seconds()),
                )

            return location_list

        return wrapper

    def wrap_duration_provider(
        self, prefix: str, func: RouteDurationProvider
    ) -> RouteDurationProvider:
        @functools.wraps(func)
        def wrapper(
            origin_latlng: LatLng, destination_latlng: LatLng
        ) -> Optional[RouteDurationResult]:
            key = compute_cache_key(prefix, origin_latlng, destination_latlng)

            cache_headers = {}

            try:
                cache_entry = self.memcached_client.get(key, None)
            except Exception as e:
                print("Cache miss (exception)")
                print(e)
                cache_entry = None
                cache_headers.update({"x-cache-hit": "exception"})

            if cache_entry is not None:
                cache_headers.update({"x-cache-hit": "true"})
                try:
                    cache_entry = CacheEntry(**json.loads(cache_entry))
                except:
                    # print("Cache hit but invalid value")
                    cache_entry = None
                    cache_headers.update({"x-cache-value": "err"})

            if cache_entry is None:
                # print("Cache miss")
                value = func(origin_latlng, destination_latlng)
                cache_headers.update({"x-cache-computed": "true"})

                if value is None:
                    cache_entry = CacheEntry(is_present=False, value=None)
                else:
                    value.x_headers.update(
                        {"x-cache-computed-at": datetime.now(UTC).isoformat()}
                    )
                    cache_entry = CacheEntry(is_present=True, value=value)

                self.memcached_client.set(
                    key=key,
                    value=cache_entry.model_dump_json(),
                    expire=int(timedelta(weeks=1).total_seconds()),
                )

            if cache_entry.is_present:
                # print("Cache present", cache_entry)
                value = cache_entry.value
                value.x_headers.update(cache_headers)
                return value

            return None

        return wrapper


class NoopWrapper:
    def wrap_duration_provider(
        self, key: str, func: RouteDurationProvider
    ) -> RouteDurationProvider:
        return func

    def wrap_location_search(
        self, func: Callable[[str], List]
    ) -> Callable[[str], List]:
        return func
