import React, { useEffect } from "react";
import { Location, LocationType } from "./services/vrr/VrrApiTypes";
import { ItemRenderer, ItemRendererProps, Suggest } from "@blueprintjs/select";
import { useDebounce } from "usehooks-ts";
import { IconName, MenuItem, MenuItemProps, Spinner } from "@blueprintjs/core";
import { Icon, IconSize } from "@blueprintjs/core";

export type LocationLike = Location | string;

export type LocationSelectorInputProps = {
  onLocationSelected: (location: Location | null) => void;
  selectedLocation: Location | null
}

export function LocationSelectorInput({selectedLocation, onLocationSelected}: LocationSelectorInputProps): JSX.Element {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [searchResults, setSearchResults] = React.useState<Location[]>([]);
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  const debouncedSearchQuery = useDebounce(searchQuery, 100);

  const renderLocationItem: ItemRenderer<Location>  = React.useCallback((location, props) => {
    if (!props.modifiers.matchesPredicate) {
      return null;
    }
    return (
      <MenuItem
        {...getLocationItemProps(
          location,
          props,
          location === selectedLocation
        )}
        roleStructure="listoption"
      />
    );
  }, [selectedLocation]);

  useEffect(() => {
    if (debouncedSearchQuery === '') {
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const url = new URL('/api/locations/search/', window.location.href);
    url.searchParams.set('q', debouncedSearchQuery);

    const abortController = new AbortController();
    fetch(url, { signal: abortController.signal })
      .then((res) => {
        return res.json();
      })
      .then((value: any) => {
        setIsLoading(false);
        setSearchResults(value.locations ?? []);
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          return;
        }
        setIsLoading(false);
        console.error(err);
      });

    return () => {
      abortController.abort();
    }
  }, [debouncedSearchQuery]);


  return (
    <Suggest
      items={searchResults}
      inputValueRenderer={(item) => item.name ?? item.id ?? ''}
      onQueryChange={(query) => setSearchQuery(query)}

      itemRenderer={renderLocationItem}
      popoverProps={{ minimal: true, matchTargetWidth: true }}
      inputProps={{
        style: { width: '300px' },
        rightElement: isLoading ? <Spinner size={IconSize.STANDARD} /> : undefined,
        leftElement: selectedLocation ? <LocationIcon location={selectedLocation} /> : <Icon icon='search' size={IconSize.STANDARD} />,
        placeholder: 'Search for a location',
      }}

      onItemSelect={onLocationSelected}
      selectedItem={selectedLocation}
    />
  );
}

function locationToHumanReadable(location: Location): string {
  return location.name ?? location.id ?? '';
}

function locationToIconName(location: Location): IconName {
  return LOCATION_TYP_TO_ICON[location.type ?? 'address'] ?? 'helicopter';
}

function LocationIcon(props: { location: Location }): JSX.Element {
  return <Icon icon={locationToIconName(props.location)} />;
}


const LOCATION_TYP_TO_ICON: Record<LocationType | 'singlehouse', IconName> = {
  address: 'map-marker',
  poi: 'map-marker',
  crossing: 'cross',
  gis:  'map-marker',
  locality: 'map-marker',
  parking: 'drive-time',
  platform: 'map-marker',
  poiHierarchy: 'map-marker',
  sharing: 'share',
  stop: 'app-header',
  street: 'office',
  suburb: 'office',
  unknown: 'help',
  singlehouse: 'home',
};


export function getLocationItemProps(
  location: Location,
  { handleClick, handleFocus, modifiers, query, ref, }: ItemRendererProps,
  isSelected: boolean,
): MenuItemProps & React.Attributes {
  const humanReadable = locationToHumanReadable(location);
  const icon = isSelected ? 'tick' : locationToIconName(location);

  return {
    active: modifiers.active,
    disabled: modifiers.disabled,
    selected: false,
    key: location.id,
    className: 'location-item ' + location.type,
    onClick: handleClick,
    onFocus: handleFocus,
    ref,
    icon,
    text: highlightText(humanReadable, query),
  };
}

function escapeRegExpChars(text: string) {
  return text.replace(/([.*+?^=!:${}()|\\[\]\\/\\])/g, "\\$1");
}

function highlightText(text: string, query: string) {
  let lastIndex = 0;
  const words = query
      .split(/\s+/)
      .filter(word => word.length > 0)
      .map(escapeRegExpChars);
  if (words.length === 0) {
      return [text];
  }
  const regexp = new RegExp(words.join("|"), "gi");
  const tokens: React.ReactNode[] = [];
  while (true) {
      const match = regexp.exec(text);
      if (!match) {
          break;
      }
      const length = match[0].length;
      const before = text.slice(lastIndex, regexp.lastIndex - length);
      if (before.length > 0) {
          tokens.push(before);
      }
      lastIndex = regexp.lastIndex;
      tokens.push(<strong key={lastIndex}>{match[0]}</strong>);
  }
  const rest = text.slice(lastIndex);
  if (rest.length > 0) {
      tokens.push(rest);
  }
  return tokens;
}
