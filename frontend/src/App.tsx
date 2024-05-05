import 'leaflet/dist/leaflet.css';

import '@maplibre/maplibre-gl-leaflet';

import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { Location } from './services/vrr/VrrApiTypes';
import { MapContainer, TileLayer } from 'react-leaflet';

import L from 'leaflet';
import { useDebounce } from 'usehooks-ts';
import { LocationLike, LocationSelectorInput } from './LocationSelectorInput';
import { DATA_SOURCES, DataSource, DataSourceSelect, dataSourceForId, dataSourceToString } from './DataSourceSelect';

function usePersistentState<T>(initialState: T, key: string, encoder: Encoder<T>, decoder: Decoder<T>): [T, (value: T) => void] {
  // Parse the current URL search parameters
  const searchParams = new URLSearchParams(window.location.search);
  const storedStateString = searchParams.get(key);
  const storedState = storedStateString ? decoder(storedStateString) : null;

  // Initialize state with the persisted state or the initial state
  const [state, setState] = useState<T>(storedState || initialState);
  const debouncedState = useDebounce(state, 500);

  // Update the URL when the state changes
  useEffect(() => {
    const newSearchParams = new URLSearchParams(window.location.search);
    const encoded = encoder(debouncedState);
    if (encoded) {
      newSearchParams.set(key, encoded);
    } else {
      newSearchParams.delete(key);
    }
    newSearchParams.sort();

    // Update the URL without triggering a page reload
    window.history.replaceState(null, '', `${window.location.pathname}?${newSearchParams.toString()}`);
  }, [debouncedState, key, encoder]);

  // Function to update state
  const updateState = (value: T): void => {
    setState(value);
  };

  return [state, updateState];
};

type Decoder<T> = (encoded: string | null) => T | null;
type Encoder<T> = (value: T) => string | null;


const LatLngBoundsDecoder: Decoder<L.LatLngBounds> = (encoded) => {
  if (encoded === "null" || encoded === "undefined" || encoded === undefined || encoded === null) {
    return null;
  }

  const [west, south, east, north] = encoded.split(',').map(parseFloat);
  return new L.LatLngBounds(new L.LatLng(south, west), new L.LatLng(north, east));
}

const LatLngBoundsEndcoder: Encoder<L.LatLngBounds | null> = (value) => {
  return value ? value.toBBoxString() : null;
}

const locationLikeToString: Encoder<LocationLike | null> = (x) => typeof x === 'string' ? x : x?.name ?? '';


function App() {

  const [bounds, setBounds] = usePersistentState<L.LatLngBounds | null>(null, "xb", LatLngBoundsEndcoder, LatLngBoundsDecoder);
  const [destinationLocationId, setDestinationLocationId] = usePersistentState<LocationLike | null>(null, "q", locationLikeToString, String);
  const destinationLocation = useLocationFromLocationLike(destinationLocationId);
  const [dataSource, setDataSource] = usePersistentState<DataSource>(DATA_SOURCES[0], 's', dataSourceToString, dataSourceForId);

  return (
    <>
      <div className='map_nav'>
        <LocationSelectorInput
          onLocationSelected={(location) => {
            setDestinationLocationId(location);
            const coords = location?.coord as [number, number];

            if (coords) {
              const pad = 0.04;
              const newBounds = new L.LatLngBounds(
                new L.LatLng(coords[0] - pad, coords[1] - pad),
                new L.LatLng(coords[0] + pad, coords[1] + pad)
              );
              setBounds(newBounds);
            }
          }}
          selectedLocation={destinationLocation}
        />
        <div>
          <DataSourceSelect
            selected={dataSource}
            onChange={setDataSource}
          />
        </div>
      </div>
      {destinationLocation && bounds && (
        <div className="map_container">
          <Test
            destinationLocation={destinationLocation}
            dataSource={dataSource}
            onViewChanged={setBounds}
            bounds={bounds}
          />
        </div>
      )}
    </>
  );
}

export type TestProps = {
  destinationLocation: Location;
  dataSource: DataSource;
  onViewChanged?: (bounds: L.LatLngBounds) => void;
  bounds: L.LatLngBounds;
}

function Test({destinationLocation, dataSource, onViewChanged, bounds}: TestProps): JSX.Element {
  const coords: [number, number] = destinationLocation.coord as any;
  const [map, setMap] = useState<null | L.Map>(null);

  const onMove = useCallback(() => {
    if (!map) {
      return;
    }
    const bounds = map.getBounds();
    if (onViewChanged) {
      onViewChanged(bounds);
    }
  }, [map, onViewChanged]);

  useEffect(() => {
    if (!map || !bounds) {
      return;
    }

    map.fitBounds(bounds, {animate: false, duration: 0});
  }, [map, bounds]);

  useEffect(() => {
    if (!map) {
      return;
    }

    map.on('move', onMove);

    return () => {
      map.off('move', onMove);
    };
  }, [map, onMove]);

  const displayMap = useMemo(
    () => {
      return (
        <MapContainer
          center={bounds.getCenter()}
          zoom={13}
          scrollWheelZoom={true}
          className='leaflet'
          ref={setMap as any}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <TileLayer
            tileSize={64}
            opacity={0.6}
            attribution={dataSource.attribution}
            url={"/api/" + dataSource.id + "/" + coords[0] + "," + coords[1] + "/64/{z}/{x}/{y}.png"}
          />
        </MapContainer>
      )
    },
    [bounds, dataSource, coords],
  );

  return displayMap;
}


export type PointValueFactory = (position: L.LatLng) => Promise<number | null>;


function useLocationFromLocationLike(locationLike: LocationLike | null): Location | null {
  const [location, setLocation] = useState<Location | null>(null);

  useEffect(() => {
    if (!locationLike) {
      return;
    }

    if (typeof locationLike === 'string') {
      const url = new URL('/api/locations/search/', window.location.href);
      url.searchParams.set('q', locationLike);

      fetch(url)
        .then((res) => {
          return res.json();
        })
        .then((value: any) => {
          console.log(value);
          const location = value.locations?.[0] ?? null;
          if (location) {
            setLocation(location);
          }
        });
    } else {
      setLocation(locationLike);
    }
  }
  , [locationLike]);

  return location;
}

export default App;
