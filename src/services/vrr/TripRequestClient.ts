/* eslint-disable @typescript-eslint/naming-convention */
import { format } from "date-fns";
import { VrrClientBase, warpAsFailSafeSchemaConverter } from "./VrrClientBase";
import { Convert, TRIPSchema } from "./VrrApiTypes";

export interface queryTripTimeParameters {
  plannedTime?: Date;
  plannedTimeIs?: "departure" | "arrival";
}

export interface QueryTripParameters {
  originPointId: string;
  destinationPointId: string;
  viaPointId?: string;

  plannedTime?: Date;
  plannedTimeIs?: "departure" | "arrival";
}

export interface QueryTripBetweenPointLatLngAndLocationParameters {
  origin: {
    lat: number;
    lng: number;
  };
  destinationLocationId: string;

  plannedTime?: Date;
  plannedTimeIs?: "departure" | "arrival";
}


export class TripRequestClient extends VrrClientBase {

  public async queryTrip(query: QueryTripParameters): Promise<TRIPSchema> {
    const planedTimeOptions = this.perparePlanedTimeOption(query);
    const viaOptions = this.prepareViaOption(query);

    return this.executeFetchRequest(
      "/XML_TRIP_REQUEST2",
      {
        name_origin: query.originPointId,
        type_origin: "any",

        name_destination: query.destinationPointId,
        type_destination: "any",

        ...viaOptions,
        ...planedTimeOptions
      },
      warpAsFailSafeSchemaConverter(Convert.toTRIPSchema),
    );
  }

  public async queryTripBetweenPointLatLngAndLocation(query: QueryTripBetweenPointLatLngAndLocationParameters): Promise<TRIPSchema> {
    const planedTimeOptions = this.perparePlanedTimeOption(query);

    return this.executeFetchRequest(
      "/XML_TRIP_REQUEST2",
      {
        name_origin: this.formatCoordinates(query.origin.lat, query.origin.lng),
        type_origin: "coord",

        name_destination: query.destinationLocationId,
        type_destination: "any",


        ...planedTimeOptions
      },
      warpAsFailSafeSchemaConverter(Convert.toTRIPSchema),
    );
  }

  private perparePlanedTimeOption({ plannedTime, ...query }: queryTripTimeParameters): Record<string, string> {
    if (!plannedTime) {
      return {};
    }

    const plannedTimeIs = query.plannedTimeIs ?? "departure";

    const itdTripDateTimeDepArr = plannedTimeIs === "departure" ? "dep" : "arr";
    const itdDate = format(plannedTime, "yyyyMMdd");
    const itdTime = format(plannedTime, "HHmm") + "h";

    return {
      itdDate,
      itdTime,
      itdTripDateTimeDepArr
    };
  }

  private prepareViaOption({ viaPointId }: QueryTripParameters): Record<string, string> {
    if (!viaPointId) {
      return {};
    }

    return {
      name_via: viaPointId,
      type_via: "any"
    };
  }
}
