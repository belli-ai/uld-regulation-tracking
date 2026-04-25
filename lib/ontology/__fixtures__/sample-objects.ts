import {
  isLoading,
  isStoring,
  toIRI,
  type Address,
  type AnyLogisticsAction,
  type Booking,
  type Carrier,
  type DgDeclaration,
  type Geolocation,
  type IotDevice,
  type IRI,
  type Loading,
  type Location,
  type LogisticsAction,
  type LogisticsEvent,
  type Measurement,
  type Organization,
  type Party,
  type Piece,
  type Sensor,
  type Shipment,
  type Storing,
  type TemperatureInstructions,
  type TransportMovement,
  type ULD,
  type Waybill,
} from '@/lib/ontology/one-record';

const addressIri = toIRI('https://example.org/address/hkg-terminal-1');
const geolocationIri = toIRI('https://example.org/geolocation/hkg-terminal-1');
const locationIri = toIRI('https://example.org/location/hkg-cool-room-a');
const amsLocationIri = toIRI('https://example.org/location/AMS');
const dxbLocationIri = toIRI('https://example.org/location/DXB');
const organizationIri = toIRI('https://example.org/organization/acme-pharma');
const carrierIri = toIRI('https://example.org/carrier/emirates-skycargo');
const shipperPartyIri = toIRI('https://example.org/party/acme-shipper');
const shipmentIri = toIRI('https://example.org/shipment/176-12345675-1');
const pieceIri = toIRI('https://example.org/piece/upid-0001');
const uldIri = toIRI('https://example.org/uld/AKE12345EK');
const transportMovementIri = toIRI(
  'https://example.org/transport-movement/EK384-HKG-NRT',
);
const bookingIri = toIRI('https://example.org/booking/BKG-0001');
const waybillIri = toIRI('https://example.org/waybill/176-12345675');
const iotDeviceIri = toIRI('https://example.org/iot-device/temp-tracker-1');
const sensorIri = toIRI('https://example.org/sensor/temp-probe-1');
const measurementIri = toIRI('https://example.org/measurement/temp-20260425T0800Z');
const logisticsEventIri = toIRI(
  'https://example.org/logistics-event/loaded-20260425T071500Z',
);
const logisticsActionIri = toIRI(
  'https://example.org/logistics-action/ramp-transfer-1',
);
const loadingIri = toIRI('https://example.org/loading/load-ake12345ek');
const storingIri = toIRI('https://example.org/storing/cool-room-slot-a1');
const dgDeclarationIri = toIRI('https://example.org/dg-declaration/un1845-1');
const temperatureInstructionsIri = toIRI(
  'https://example.org/temperature-instructions/ti-0001',
);
const contactPersonIri = toIRI('https://example.org/person/ramp-supervisor-1');
const handlerPartyIri = toIRI('https://example.org/party/hkg-handler');

export const sampleAddress: Address = {
  '@id': addressIri,
  '@type': 'Address',
  streetAddress: '1 Sky Plaza Road',
  cityName: 'Hong Kong',
  countryCode: 'HK',
  postalCode: '999077',
};

export const sampleGeolocation: Geolocation = {
  '@id': geolocationIri,
  '@type': 'Geolocation',
  latitude: 22.308,
  longitude: 113.9185,
  elevation: 9,
};

export const sampleLocation: Location = {
  '@id': locationIri,
  '@type': 'Location',
  name: 'HKG Cool Room A',
  address: sampleAddress['@id'],
  geolocation: sampleGeolocation['@id'],
  locationCode: 'HKG-CRA',
};

export const sampleOrganization: Organization = {
  '@id': organizationIri,
  '@type': 'Organization',
  organizationName: 'Acme Pharma Logistics Ltd.',
  accountNumbers: ['ACME-7788'],
  contactDetails: [contactPersonIri],
};

export const sampleCarrier: Carrier = {
  '@id': carrierIri,
  '@type': 'Carrier',
  organizationName: 'Emirates SkyCargo',
  accountNumbers: ['EK-CARGO-01'],
  contactDetails: [contactPersonIri],
  airlineCode: 'EK',
  airlineNumericCode: '176',
};

export const sampleParty: Party = {
  '@id': shipperPartyIri,
  '@type': 'Party',
  partyDetails: sampleOrganization['@id'],
  partyRole: 'shipper',
};

const sampleHandlerParty: Party = {
  '@id': handlerPartyIri,
  '@type': 'Party',
  partyDetails: sampleCarrier['@id'],
  partyRole: 'handler',
};

export const sampleShipment: Shipment = {
  '@id': shipmentIri,
  '@type': 'Shipment',
  shipmentOfPieces: [pieceIri],
  ofWaybill: waybillIri,
};

export const samplePiece: Piece = {
  '@id': pieceIri,
  '@type': 'Piece',
  grossWeight: {
    value: 125,
    unit: 'kg',
  },
  dimensions: {
    length: 60,
    width: 40,
    height: 30,
    unit: 'cm',
  },
  ofShipment: sampleShipment['@id'],
};

export const sampleWaybill: Waybill = {
  '@id': waybillIri,
  '@type': 'Waybill',
  waybillPrefix: '176',
  waybillNumber: '176-12345678',
  arrivalLocation: dxbLocationIri,
  departureLocation: amsLocationIri,
  shc: 'COL',
  pieces: [samplePiece],
};

export const sampleTransportMovement: TransportMovement = {
  '@id': transportMovementIri,
  '@type': 'TransportMovement',
  modeCode: 'Air',
  flightNumber: 'EK384',
  departureLocation: amsLocationIri,
  arrivalLocation: dxbLocationIri,
  movementTimes: [
    {
      type: 'STD',
      timestamp: '2026-05-01T06:00:00Z',
    },
    {
      type: 'STA',
      timestamp: '2026-05-01T14:00:00Z',
    },
  ],
  operatingParties: [sampleCarrier['@id']],
  loadingActions: [],
};

export const sampleBooking: Booking = {
  '@id': bookingIri,
  '@type': 'Booking',
  bookingTimes: [
    {
      type: 'requested',
      timestamp: '2026-04-24T08:00:00Z',
    },
    {
      type: 'confirmed',
      timestamp: '2026-04-24T08:15:00Z',
    },
  ],
  carrier: sampleCarrier['@id'],
  carrierProduct: 'Pharma Secure',
  transportLegs: [sampleTransportMovement['@id']],
  issuedForWaybill: sampleWaybill['@id'],
};

export const sampleULD: ULD = {
  '@id': uldIri,
  '@type': 'ULD',
  uldSerialNumber: 'AKE12345EK',
  uldTypeCode: 'AKE',
  serviceabilityCode: 'SER',
  damageFlag: false,
  ownerCode: 'EK',
};

export const sampleIotDevice: IotDevice = {
  '@id': iotDeviceIri,
  '@type': 'IotDevice',
  serialNumber: 'IOT-DXB-001',
  attachedTo: sampleULD['@id'],
};

export const sampleSensor: Sensor = {
  '@id': sensorIri,
  '@type': 'Sensor',
  sensorType: 'TEMPERATURE',
  serialNumber: 'SEN-TEMP-001',
  partOfIotDevice: sampleIotDevice['@id'],
};

export const sampleMeasurement: Measurement = {
  '@id': measurementIri,
  '@type': 'Measurement',
  measurementValue: {
    value: 2.5,
    unit: 'C',
  },
  measurementTimestamp: '2026-05-01T08:00:00Z',
  bySensor: sampleSensor['@id'],
};

export const sampleLogisticsEvent: LogisticsEvent = {
  '@id': logisticsEventIri,
  '@type': 'LogisticsEvent',
  eventCode: 'FOH',
  eventName: 'Freight loaded on handling unit',
  eventDate: '2026-04-25T07:15:00Z',
  eventFor: sampleULD['@id'],
  eventLocation: sampleLocation['@id'],
  recordingActor: sampleHandlerParty['@id'],
  recordingOrganization: sampleOrganization['@id'],
};

export const sampleLogisticsAction: LogisticsAction = {
  '@id': logisticsActionIri,
  '@type': 'LogisticsAction',
  actionStartTime: '2026-04-25T06:45:00Z',
  actionEndTime: '2026-04-25T07:00:00Z',
  performedAt: sampleLocation['@id'],
  servedActivity: sampleTransportMovement['@id'],
  contactPersons: [contactPersonIri],
  otherIdentifiers: ['RAMP-XFER-01'],
};

export const sampleLoading: Loading = {
  '@id': loadingIri,
  '@type': 'Loading',
  actionStartTime: '2026-04-25T07:00:00Z',
  actionEndTime: '2026-04-25T07:12:00Z',
  performedAt: sampleLocation['@id'],
  servedActivity: sampleTransportMovement['@id'],
  contactPersons: [contactPersonIri],
  otherIdentifiers: ['LOAD-AKE12345EK'],
  loadedPieces: [samplePiece['@id']],
  loadedUnits: [sampleULD['@id']],
  loadingType: 'aircraft-main-deck',
  onTransportMeans: sampleTransportMovement['@id'],
  loadingPositionIdentifier: 'PMC-14R',
};

export const sampleStoring: Storing = {
  '@id': storingIri,
  '@type': 'Storing',
  actionStartTime: '2026-04-25T05:30:00Z',
  actionEndTime: '2026-04-25T06:30:00Z',
  performedAt: sampleLocation['@id'],
  servedActivity: sampleShipment['@id'],
  contactPersons: [contactPersonIri],
  otherIdentifiers: ['STORE-HKG-CRA-A1'],
  storingType: 'cool-room',
  storageLocation: sampleLocation['@id'],
};

export const sampleDgDeclaration: DgDeclaration = {
  '@id': dgDeclarationIri,
  '@type': 'DgDeclaration',
  issuedForPiece: samplePiece['@id'],
  declarationDate: '2026-04-25',
  declarationPlace: sampleLocation['@id'],
  departureLocation: sampleLocation['@id'],
  arrivalLocation: dxbLocationIri,
};

export const sampleTemperatureInstructions: TemperatureInstructions = {
  '@id': temperatureInstructionsIri,
  '@type': 'TemperatureInstructions',
  minTemperature: {
    value: 2,
    unit: 'C',
  },
  maxTemperature: {
    value: 8,
    unit: 'C',
  },
};

const sampleAnyAction: AnyLogisticsAction = sampleLoading;

export const _narrowingCheck: readonly IRI[] = isLoading(sampleAnyAction)
  ? sampleAnyAction.loadedPieces
  : [];

const sampleAnyAction2: AnyLogisticsAction = sampleStoring;

export const _storingCheck: string = isStoring(sampleAnyAction2)
  ? sampleAnyAction2.storingType
  : '';
