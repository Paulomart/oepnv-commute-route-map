import { Button, MenuItem } from "@blueprintjs/core";
import { Select } from "@blueprintjs/select";

export function dataSourceForId(id: string | null): DataSource {
  return DATA_SOURCES.find((x) => x.id === id) as DataSource ?? DATA_SOURCES[0];
}

export function dataSourceToString(dataSource: DataSource): string {
  return dataSource.id;
}

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'vrr',
    humanName: 'VRR',
    finePrint: 'exact',
    attribution: 'Contains data from &copy; Verkehrsverbund Rhein-Ruhr AöR <a href="http://opendefinition.org/licenses/cc-by/">Creative Commons Namensnennung (CC-BY)</a>',
  },
  {
    id: 'otp',
    humanName: 'OpenTripPlanner',
    finePrint: 'faster',
    attribution: 'Contains data from &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors and &copy; Verkehrsverbund Rhein-Ruhr AöR <a href="http://opendefinition.org/licenses/cc-by/">Creative Commons Namensnennung (CC-BY)</a>',
  },
  {
    id: 'hafas',
    humanName: 'Deutsche Bahn (HAFAS)',
    finePrint: 'pessimistic',
    attribution: 'Unknown',
  }
];

export type DataSource = {
  id: string;
  humanName: string;
  attribution: string;
  finePrint: string;
}

export type DataSourceSelectProps = {
  selected: DataSource;
  onChange: (value: DataSource) => void;
}

export function DataSourceSelect({selected, onChange}: DataSourceSelectProps): JSX.Element {
  return (
    <Select
      items={DATA_SOURCES}
      itemRenderer={(item, props) => {
        if (!props.modifiers.matchesPredicate) {
          return null;
        }

        return (
          <MenuItem
            {...props}
            roleStructure="listoption"
            key={item.id}
            text={item.humanName}
            active={props.modifiers.active}
            onClick={props.handleClick}
            selected={item.id === selected.id}
            label={item.finePrint}
          />
        );
      }}
      onItemSelect={onChange}
      filterable={false}
      popoverProps={{ minimal: true }}
    >
      <Button
        text={selected.humanName}
        rightIcon="double-caret-vertical"
      />
    </Select>
  );
}
