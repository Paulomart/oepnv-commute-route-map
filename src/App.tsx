import React, { useCallback, useEffect } from 'react';
import './App.css';
import { StopFinderClient } from './services/vrr/StopFinderClient';
import { TripRequestClient } from './services/vrr/TripRequestClient';
import { Journey, Location, TRIPSchema } from './services/vrr/VrrApiTypes';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

import { LatLng, LatLngBounds } from 'leaflet';
import { LeatletMapContainer } from './LeatletMapContainer';
import { time } from 'console';
import { SCHEMA_CONVERTER_CONFIG } from './services/vrr/VrrClientBase';
import { Scale } from './Scale';

SCHEMA_CONVERTER_CONFIG.logSchemaErrors = false;


const stopsApi = new StopFinderClient(window.location.origin + "/vrr-efa");
const tripsAPi = new TripRequestClient(window.location.origin + "/vrr-efa");


function extractCoordsFromLocation(coords: any): LatLng {
  if (Array.isArray(coords)) {
    return new LatLng(coords[0], coords[1]);
  }

  if (typeof coords === "object") {
    return new LatLng(coords.lat, coords.lng);
  }

  throw new Error("Unknown coords format");
}

function useExtractCoordsFromLocation(coords: any): LatLng[] {
  const [latLng, setLatLng] = React.useState<LatLng[]>([new LatLng(0, 0)]);

  useEffect(() => {
    setLatLng([extractCoordsFromLocation(coords)]);
  }, [coords]);

  return latLng;
}


async function extractTimeForTrip() {

  const dest = await stopsApi.findStopByNameOrId({search: "Bochum Ruhr-Universität"});
  console.log(dest);

  const origin = await stopsApi.findStopByNameOrId({search: "Bochum Hbf"});
  console.log(origin);

  const destinationPointId = dest.locations?.[0].id;
  const originPointId = origin.locations?.[0]?.id;

  if (!destinationPointId || !originPointId) {
    return;
  }

  const trip = await tripsAPi.queryTrip({
    destinationPointId,
    originPointId
  })

  console.log(trip);
  // const trip = await tripsAPi.queryTrip({
  //   destinationPointId
  // })

}

async function bestTimeInSecondsFromTrip(trip: TRIPSchema): Promise<number> {
  if (!Array.isArray(trip.journeys)){
    return 0;
  }

  const times = await Promise.all(
    trip.journeys.map((j) => extractTimeInSecondsFromJourney(j))
  );

  return Math.min(...times);
}


async function extractTimeInSecondsFromJourney(journey: Journey): Promise<number> {
  if (!journey.legs) {
    throw new Error("No legs in journey");
  }

  let timeInSeconds = 0;
  journey.legs.forEach((leg) => {
    if (!leg.duration) {
      return;
    }

    timeInSeconds += leg.duration;
  });

  return timeInSeconds;
}

function App() {

  const [destinationLocation, setDestinationLocation] = React.useState<Location | null>(null);

  return (
    <>
      <div className='map_nav'>
        <LocationSelectorInput onLocationSelected={setDestinationLocation} selectedLocation={destinationLocation} />
      </div>
      {destinationLocation && (
        <div className="map_container">
          <MapRenderer destinationLocation={destinationLocation} />
        </div>
      )}
    </>
  );
}

type Points9 = [Point, Point, Point, Point, Point, Point, Point, Point, Point];
export type PointValueFactory = (position: LatLng) => Promise<number>;
type Point = FPoint | DPoint;


function add(position: LatLng, metersToSouth: number, metersToEast: number): LatLng {
  const earthRadius = 6378137;
  const lat = position.lat + (metersToSouth / earthRadius) * (180 / Math.PI);
  const lng = position.lng + (metersToEast / earthRadius) * (180 / Math.PI) / Math.cos(position.lat * Math.PI/180);
  return new LatLng(lat, lng);
}

class FPoint {
  public readonly position: LatLng;
  public readonly resolutionInMeters: number;
  public readonly durationInSeconds: number;

  constructor(position: LatLng, resolution: number, durationInSeconds: number) {
    this.position = position;
    this.resolutionInMeters = resolution;
    this.durationInSeconds = durationInSeconds;
  }

  public async increateResolution(factory: PointValueFactory, bounds: LatLngBounds | null = null): Promise<Point> {
    const instr = [
      [-1, -1],  [-1, +0],  [-1, +1],
      [+0, -1],  [+0, +0],  [+0, +1],
      [+1, -1],  [+1, +0],  [+1, +1],
    ];

    const nextResolutionInMeters = this.resolutionInMeters / 3;

    if (nextResolutionInMeters < 100) {
      return this;
    }

    const children = await Promise
      .all([...Array(9).keys()]
        .map(async (i) => {
          if (i === 4) {
            return new FPoint(this.position, nextResolutionInMeters, this.durationInSeconds);
          }

          const [north, east] = instr[i];
          const position = add(this.position, north * nextResolutionInMeters, east * nextResolutionInMeters);

          const value = await factory(position);
          return new FPoint(position, nextResolutionInMeters, value);
        }));


    return new DPoint(children as Points9);
  }

  public toHeatPoints(): [number, number, number][] {
    return [[this.position.lat, this.position.lng, this.durationInSeconds]];
  }

  public toBoundedRect(): [LatLngBounds, number][] {
    const halfResolution = this.resolutionInMeters / 2;
    const southWest = add(this.position, -halfResolution, -halfResolution);
    const northEast = add(this.position, +halfResolution, +halfResolution);

    return [[new LatLngBounds(southWest, northEast), this.durationInSeconds]];
  }
}


class DPoint {

  private readonly children: Points9;

  constructor (children: Points9) {
    if (children.length !== 9) {
      throw new Error("Invalid number of children");
    }

    this.children = children;
  }

  public async increateResolution(factory: PointValueFactory, bounds: LatLngBounds | null = null): Promise<DPoint> {
    // await Promise
    //   .all
    const x =  ([...Array(9).keys()]
        .map((i): [number, Point] => {
          return [i, this.children[i]]
        })
        .filter(([i, child]) => {
          if (bounds && child instanceof FPoint && !bounds.intersects(child.toBoundedRect()[0][0])) {
            return false;
          }

          return true;
        })
        .map(async ([i, child]) => {
          this.children[i] = await this.children[i].increateResolution(factory, bounds);
        }));

      for (const y of x) {
        await y;
      }

    return this;
  }

  public toHeatPoints(): [number, number, number][] {
    const points: [number, number, number][] = [];

    for (let i = 0; i < 9; i++) {
      points.push(...this.children[i].toHeatPoints());
    }

    return points;
  }

  public toBoundedRect(): [LatLngBounds, number][] {
    const points: [LatLngBounds, number][] = [];

    for (let i = 0; i < 9; i++) {
      points.push(...this.children[i].toBoundedRect());
    }

    return points;
  }

}

type AsyncFunction<T extends any[], R> = (...args: T) => Promise<R>;

function limitConcurrentCalls<T extends any[], R>(fn: AsyncFunction<T, R>, limit: number): AsyncFunction<T, R> {
  console.log("limitConcurrentCalls", limit);
  let activePromises: Promise<R>[] = [];

  return async (...args: T): Promise<R> => {
    while (activePromises.length >= limit) {
      const promiseToWaitFor = Promise.race(activePromises);
      await promiseToWaitFor;
      activePromises = activePromises.filter(promise => promise !== promiseToWaitFor);
    }

    const newPromise = fn(...args);
    activePromises.push(newPromise);

    newPromise.finally(() => {
      activePromises = activePromises.filter(promise => promise !== newPromise);
    });

    return newPromise;
  };
}

type MapRendererProps = {
  destinationLocation: Location;
}

const pointFactoryCache: Map<string, number> = new Map();

function MapRenderer({destinationLocation}: MapRendererProps): JSX.Element {
  const [viewBounds, setViewBounds] = React.useState<LatLngBounds | null>(null);
  const coords = useExtractCoordsFromLocation(destinationLocation.coord);
  const [min, setMin] = React.useState<number>(0);
  const [max, setMax] = React.useState<number>(0);

  const pointFactory: PointValueFactory = useCallback(async (position) => {
    const key = `${position.lat},${position.lng}`;

    if (pointFactoryCache.has(key)) {
      return pointFactoryCache.get(key) ?? 0;
    }

    try {
      const trip = await tripsAPi.queryTripBetweenPointLatLngAndLocation({
        destinationLocationId: destinationLocation.id ?? "",
        origin: {
          lat: position.lat,
          lng: position.lng
        }
      });

      const value = await bestTimeInSecondsFromTrip(trip);
      pointFactoryCache.set(key, value);
      return value;

      // return Math.random() * 1000;
    } catch (e) {
      console.error(e);
      return 0;
    }

  }, [destinationLocation]);



  return (
    <>
      <LeatletMapContainer
        fitPoints={coords}
        onViewChanged={(bounds) => {
          setViewBounds(bounds);
        }}
        pointFactory={pointFactory}
        onMinMaxChanged={(min, max) => {
          console.log(min, max);
          setMin(min);
          setMax(max);
        }}
      />
      <div style={{position: 'absolute', zIndex: 10000,top: 0, right: 0,}}>
        <Scale max={max / 60} min={min / 60} unit='min' />
      </div>

    </>
  );
}


type LocationSelectorInputProps = {
  onLocationSelected: (location: Location | null) => void;
  selectedLocation: string | Location | null;
}

function LocationSelectorInput(props: LocationSelectorInputProps): JSX.Element {
  const [searchInput, setSearchInput] = React.useState<string>("Gelsenkirchen Hbf");

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value);
  }

  const onClick = () => {
    stopsApi.findStopByNameOrId({search: searchInput}).then((results) => {
      const location = results.locations?.[0] ?? null;
      if (location) {
        setSearchInput(location.name ?? location.id ?? searchInput);
        props.onLocationSelected(location);
      }
    });
  }

  return (
    <div>
      <input type="text" value={searchInput} onChange={onChange} />
      <button onClick={onClick}>Select</button>

    </div>
  );
}

export default App;
