import * as L from "leaflet"
import { useCallback, useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer } from "react-leaflet"
import "leaflet.heat";
import { PointValueFactory } from "./App";


export function percentToColor(perc: number): string {
  perc = 100 - perc;
	let r, g, b = 0;
	if(perc < 50) {
		r = 255;
		g = Math.round(5.1 * perc);
	}
	else {
		g = 255;
		r = Math.round(510 - 5.10 * perc);
	}
	let h = r * 0x10000 + g * 0x100 + b * 0x1;
	return '#' + ('000000' + h.toString(16)).slice(-6);
}

export type LeatletMapContainerProps = {
  fitPoints: L.LatLng[];
  pointFactory: PointValueFactory;
  onViewChanged?: (bounds: L.LatLngBounds) => void;
  onMinMaxChanged: (min: number, max: number) => void;
};


let layer: L.GridLayer;


export function LeatletMapContainer(props: LeatletMapContainerProps): JSX.Element {
  const [map, setMap] = useState<null | L.Map>(null)

  const fitPoints = props.fitPoints;
  const onViewChanged = props.onViewChanged;
  const pointFactory = props.pointFactory;

  const onMove = useCallback(() => {
    if (!map) {
      return;
    }
    const bounds = map.getBounds();
    if (onViewChanged) {
      onViewChanged(bounds);
    }
  }, [map, onViewChanged]);

  const onClick = useCallback((e: L.LeafletMouseEvent) => {
    console.log(e.layerPoint, e.containerPoint, e.latlng, e.latlng.wrap(), e);
    // find the rectangle that contains the point
    const latLngBounds: L.LatLngBounds = (layer as any)._getTiledPixelBounds(e.latlng);

    console.log(latLngBounds);


  }, []);

  // useEffect(() => {
  //   if (!map) {
  //     return;
  //   }
  //   const bounds = L.latLngBounds(fitPoints);
  //   map.fitBounds(bounds, { padding: [50, 50] });

  // }, [map, fitPoints]);

  useEffect(() => {
    if (!map) {
      return;
    }

    console.log("add layer");

    const CanvasLayer = L.GridLayer.extend({
      maxValue: 1,
      minValue: 0,

      tileCoordsToBounds2: function(coords: any) {
        return this._tileCoordsToBounds(coords);
      },

      createTile: function(coords: any, done: any) {
        // create a <canvas> element for drawing
        var tile = L.DomUtil.create('canvas', 'leaflet-tile');

        // setup tile width and height according to the options
        var size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;

        // get a canvas context and draw something on it using coords.x, coords.y and coords.z
        var ctx = tile.getContext('2d');

        const latLngBounds: L.LatLngBounds = this._tileCoordsToBounds(coords);

        pointFactory(latLngBounds.getCenter()).then((value): any => {

          if (value > this.maxValue || value < this.minValue) {
            props.onMinMaxChanged(this.minValue, this.maxValue);
            this.once('load', () => {
              this.redraw();
            });
          }

          this.maxValue = Math.max(this.maxValue, value);
          this.minValue = Math.min(this.minValue, value);

          const percent = value / this.maxValue;
          const color = percentToColor(percent * 100);

          // fill the tile with solid red
          ctx!.fillStyle = color;
          ctx!.fillRect(0, 0, size.x, size.y);

          // create border around the tile
          ctx!.strokeStyle = 'white';
          ctx!.lineWidth = 10;
          ctx!.strokeRect(0, 0, size.x, size.y);

          // draw the value in the center of the tile
          ctx!.font = '25px sans-serif';
          ctx!.textAlign = 'center';
          ctx!.textBaseline = 'middle';
          ctx!.fillStyle = 'black';
          ctx!.fillText((value / 60).toFixed(0), size.x / 2, size.y / 2);

          done(null, tile);
        });

        // return the tile so it can be rendered on screen
        return tile;
      },

    });

    // @ts-ignore
    layer = new CanvasLayer({opacity: 0.8, tileSize: 200, minNativeZoom: 15, minZoom: 14});

    map.addLayer(layer);

    return () => {
      console.log("remove layer");
      map.removeLayer(layer);
    };

  }, [map]);

  useEffect(() => {
    if (!map) {
      return;
    }

    map.on('click', onClick);
    map.on('move', onMove);

    return () => {
      map.off('move', onMove)
      map.off('click', onClick)
    };
  }, [map, onMove, onClick]);


  const displayMap = useMemo(
    () => (
      <MapContainer
        center={[51.45739974795775, 7.012843151852082]}
        zoom={13}
        scrollWheelZoom={false}
        ref={setMap as any}
        className='leaflet'
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>
    ),
    [],
  );

  return displayMap;

  //     {/* {map ? <DisplayPosition map={map} /> : null} */}
  //     {}
  // )
}
