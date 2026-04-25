/*
 * TypeScript ontology subset for IATA ONE Record cargo objects (v3.2).
 * Provides compile-time shapes, branded IRIs, and logistics action narrowing helpers.
 */

declare const iriBrand: unique symbol;

export type IRI = string & { readonly [iriBrand]: never };

export const toIRI = (value: string): IRI => value as IRI;

type LogisticsObjectBase<T extends string> = {
  '@id': IRI;
  '@type': T;
};

export type LogisticsObject = LogisticsObjectBase<string>;

/** @see https://onerecord.iata.org/ns/cargo#ULD */
export type ULD = LogisticsObjectBase<'ULD'> & {
  uldSerialNumber: string;
  uldTypeCode: string;
  serviceabilityCode: 'SER' | 'DAM' | 'CON';
  damageFlag: boolean;
  sealNumber?: string;
  numberOfDoors?: number;
  ownerCode: string;
  loadingIndicator?: string;
  ataDesignator?: string;
};

/** @see https://onerecord.iata.org/ns/cargo#Piece */
export type Piece = LogisticsObjectBase<'Piece'> & {
  grossWeight: { value: number; unit: 'kg' | 'lb' };
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm';
  };
  ofShipment: IRI;
  inPiece?: IRI;
  fulfillsUldTypeCode?: string;
  customsInformation?: IRI[];
  containedItems?: IRI[];
};

/** @see https://onerecord.iata.org/ns/cargo#Waybill */
export type Waybill = LogisticsObjectBase<'Waybill'> & {
  waybillPrefix: string;
  waybillNumber: string;
  arrivalLocation: IRI;
  departureLocation: IRI;
  declaredValueForCarriage?: { value: number; currency: string };
  shipmentDetails?: IRI;
  shc: string;
  pieces: Piece[];
};

/** @see https://onerecord.iata.org/ns/cargo#Shipment */
export type Shipment = LogisticsObjectBase<'Shipment'> & {
  shipmentOfPieces: IRI[];
  ofWaybill?: IRI;
};

/** @see https://onerecord.iata.org/ns/cargo#TransportMovement */
export type TransportMovement = LogisticsObjectBase<'TransportMovement'> & {
  modeCode: 'Air';
  flightNumber: string;
  departureLocation: IRI;
  arrivalLocation: IRI;
  movementTimes: { type: 'STD' | 'STA' | 'ATD' | 'ATA'; timestamp: string }[];
  operatingParties: IRI[];
  loadingActions: IRI[];
};

/** @see https://onerecord.iata.org/ns/cargo#Booking */
export type Booking = LogisticsObjectBase<'Booking'> & {
  bookingTimes: {
    type: 'requested' | 'confirmed';
    timestamp: string;
  }[];
  carrier: IRI;
  carrierProduct?: string;
  transportLegs: IRI[];
  issuedForWaybill?: IRI;
};

/** @see https://onerecord.iata.org/ns/cargo#IotDevice */
export type IotDevice = LogisticsObjectBase<'IotDevice'> & {
  serialNumber: string;
  attachedTo: IRI;
};

/** @see https://onerecord.iata.org/ns/cargo#Sensor */
export type Sensor = LogisticsObjectBase<'Sensor'> & {
  sensorType: 'TEMPERATURE' | 'HUMIDITY' | 'GPS' | 'SHOCK' | 'BLE_PROXIMITY';
  serialNumber: string;
  partOfIotDevice: IRI;
};

/** @see https://onerecord.iata.org/ns/cargo#Measurement */
export type Measurement = LogisticsObjectBase<'Measurement'> & {
  measurementValue: { value: number; unit: string };
  measurementTimestamp: string;
  recordedGeolocation?: { latitude: number; longitude: number };
  bySensor: IRI;
};

/** @see https://onerecord.iata.org/ns/cargo#LogisticsEvent */
export type LogisticsEvent = LogisticsObjectBase<'LogisticsEvent'> & {
  eventCode: string;
  eventName: string;
  eventDate: string;
  eventFor: IRI;
  eventLocation: IRI;
  eventTimeType?: 'planned' | 'actual';
  recordingActor?: IRI;
  recordingOrganization?: IRI;
};

type LogisticsActionFields = {
  actionStartTime: string;
  actionEndTime?: string;
  performedAt: IRI;
  servedActivity?: IRI;
  contactPersons?: IRI[];
  otherIdentifiers?: string[];
};

/** @see https://onerecord.iata.org/ns/cargo#LogisticsAction */
export type LogisticsAction = LogisticsObjectBase<'LogisticsAction'> &
  LogisticsActionFields;

/** @see https://onerecord.iata.org/ns/cargo#Loading */
export type Loading = LogisticsObjectBase<'Loading'> &
  LogisticsActionFields & {
    loadedPieces: IRI[];
    loadedUnits: IRI[];
    loadingType: string;
    onTransportMeans?: IRI;
    loadingPositionIdentifier?: string;
  };

/** @see https://onerecord.iata.org/ns/cargo#Storing */
export type Storing = LogisticsObjectBase<'Storing'> &
  LogisticsActionFields & {
    storingType: string;
    storageLocation: IRI;
  };

/** @see https://onerecord.iata.org/ns/cargo#DgDeclaration */
export type DgDeclaration = LogisticsObjectBase<'DgDeclaration'> & {
  issuedForPiece: IRI;
  declarationDate: string;
  declarationPlace: IRI;
  departureLocation: IRI;
  arrivalLocation: IRI;
  complianceDeclarationText?: string;
  aircraftLimitationInformation?: string;
  exclusiveUseIndicator?: boolean;
  shippingRefNo?: string;
};

/** @see https://onerecord.iata.org/ns/cargo#TemperatureInstructions */
export type TemperatureInstructions =
  LogisticsObjectBase<'TemperatureInstructions'> & {
    minTemperature: { value: number; unit: 'C' | 'F' };
    maxTemperature: { value: number; unit: 'C' | 'F' };
  };

/** @see https://onerecord.iata.org/ns/cargo#Location */
export type Location = LogisticsObjectBase<'Location'> & {
  name: string;
  address?: IRI;
  geolocation?: IRI;
  locationCode?: string;
};

/** @see https://onerecord.iata.org/ns/cargo#Address */
export type Address = LogisticsObjectBase<'Address'> & {
  streetAddress?: string;
  cityName: string;
  countryCode: string;
  postalCode?: string;
};

/** @see https://onerecord.iata.org/ns/cargo#Geolocation */
export type Geolocation = LogisticsObjectBase<'Geolocation'> & {
  latitude: number;
  longitude: number;
  elevation?: number;
};

/** @see https://onerecord.iata.org/ns/cargo#Party */
export type Party = LogisticsObjectBase<'Party'> & {
  partyDetails: IRI;
  partyRole: 'shipper' | 'consignee' | 'carrier' | 'handler' | 'forwarder';
};

/** @see https://onerecord.iata.org/ns/cargo#Organization */
export type Organization = LogisticsObjectBase<'Organization'> & {
  organizationName: string;
  accountNumbers?: string[];
  contactDetails?: IRI[];
};

/** @see https://onerecord.iata.org/ns/cargo#Carrier */
export type Carrier = LogisticsObjectBase<'Carrier'> & {
  organizationName: string;
  accountNumbers?: string[];
  contactDetails?: IRI[];
} & {
  airlineCode: string;
  airlineNumericCode?: string;
};

export type AnyLogisticsAction = LogisticsAction | Loading | Storing;

export function isLoading(action: AnyLogisticsAction): action is Loading {
  return action['@type'] === 'Loading';
}

export function isStoring(action: AnyLogisticsAction): action is Storing {
  return action['@type'] === 'Storing';
}
