
import { percentToColor } from './LeatletMapContainer';
import css from './Scale.module.css';

type ScaleProps = {
  max: number;
  min: number;
  unit: string;
}

export function Scale({max, min, unit}: ScaleProps): JSX.Element {
  const grains = Array
    .from({length: 100}, (_, i) => i)
    .map(i => (
      <div key={i} className={css.grain} style={{backgroundColor: percentToColor(i)}} />
    ));

  return (
    <div className={css.bar}>
      <div>{min.toFixed(0)}{unit}</div>
      {grains}
      <div>{max.toFixed(0)}{unit}</div>
    </div>
  );
}
