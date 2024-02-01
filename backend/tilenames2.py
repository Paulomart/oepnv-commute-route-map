#!/usr/bin/env python
# -------------------------------------------------------
# Translates between lat/long and the slippy-map tile
# numbering scheme
#
# http://wiki.openstreetmap.org/index.php/Slippy_map_tilenames
#
# Written by Oliver White, 2007
# This file is public-domain
# -------------------------------------------------------
from math import *
from collections import namedtuple


LatLng = namedtuple("LatLng", ["lat", "lng"])


def num_tiles(z, tile_size_pixels):
    return pow(2, z) * (256 / tile_size_pixels)


def sec(x):
    return 1 / cos(x)


def latlon_to_relative_xy(lat, lon):
    x = (lon + 180) / 360
    y = (1 - log(tan(radians(lat)) + sec(radians(lat))) / pi) / 2
    return (x, y)


def latlon_to_xy(lat, lon, z, tile_size_pixels):
    n = num_tiles(z, tile_size_pixels)
    x, y = latlon_to_relative_xy(lat, lon)
    return (n * x, n * y)


def tile_xy(lat, lon, z, tile_size_pixels):
    x, y = latlon_to_xy(lat, lon, z, tile_size_pixels)
    return (int(x), int(y))


def xy_to_latlon(x, y, z, tile_size_pixels):
    n = num_tiles(z, tile_size_pixels)
    relY = y / n
    lat = mercator_to_lat(pi * (1 - 2 * relY))
    lon = -180.0 + 360.0 * x / n
    return (lat, lon)


def xy_to_latlon_center(x, y, z, tile_size_pixels):
    return xy_to_latlon(x + 0.5, y + 0.5, z, tile_size_pixels)


def lat_edges(y, z, tile_size_pixels):
    n = num_tiles(z, tile_size_pixels)
    unit = 1 / n
    relY1 = y * unit
    relY2 = relY1 + unit
    lat1 = mercator_to_lat(pi * (1 - 2 * relY1))
    lat2 = mercator_to_lat(pi * (1 - 2 * relY2))
    return (lat1, lat2)


def lon_edges(x, z, tile_size_pixels):
    n = num_tiles(z, tile_size_pixels)
    unit = 360 / n
    lon1 = -180 + x * unit
    lon2 = lon1 + unit
    return (lon1, lon2)


def tile_edges(x, y, z, tile_size_pixels):
    lat1, lat2 = lat_edges(y, z, tile_size_pixels)
    lon1, lon2 = lon_edges(x, z, tile_size_pixels)
    return (lat2, lon1, lat1, lon2)  # S,W,N,E


def mercator_to_lat(mercatorY):
    return degrees(atan(sinh(mercatorY)))
