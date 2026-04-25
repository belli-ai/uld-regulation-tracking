import { describe, expect, it } from "vitest";
import { adaptMockUldInventory } from "@/lib/adapters/uld-inventory";

describe("adaptMockUldInventory", () => {
  it("produces canonical ULD records preserving serviceability + ownership", () => {
    const result = adaptMockUldInventory([
      {
        "@id": "urn:cargo:uld:AKE-12345EK",
        "@type": "ULD",
        uldSerialNumber: "AKE-12345EK",
        uldTypeCode: "AKE",
        ataDesignator: "AKE",
        serviceabilityCode: "SER",
        damageFlag: false,
        ownerCode: "EK",
        numberOfDoors: 1,
        loadingIndicator: "Y",
        uldProductCode: "ENVIROTAINER_RAP_COL",
        iotDeviceId: "IOT-001",
      },
      {
        "@id": "urn:cargo:uld:RKN-99002EK",
        "@type": "ULD",
        uldSerialNumber: "RKN-99002EK",
        uldTypeCode: "RKN",
        serviceabilityCode: "DAM",
        damageFlag: true,
        ownerCode: "EK",
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      "@type": "ULD",
      uldSerialNumber: "AKE-12345EK",
      uldTypeCode: "AKE",
      ataDesignator: "AKE",
      serviceabilityCode: "SER",
      damageFlag: false,
      ownerCode: "EK",
      numberOfDoors: 1,
      loadingIndicator: "Y",
    });
    // External-source-only fields must not leak into canonical shape.
    const keys = Object.keys(result[0]);
    expect(keys).not.toContain("uldProductCode");
    expect(keys).not.toContain("iotDeviceId");

    expect(result[1].serviceabilityCode).toBe("DAM");
    expect(result[1].damageFlag).toBe(true);
  });

  it("defaults invalid serviceability to SER and damageFlag to false", () => {
    const [uld] = adaptMockUldInventory([
      {
        "@id": "urn:cargo:uld:UNKNOWN",
        uldSerialNumber: "UNKNOWN",
        uldTypeCode: "AKE",
        ownerCode: "EK",
        serviceabilityCode: "BOGUS",
      },
    ]);
    expect(uld.serviceabilityCode).toBe("SER");
    expect(uld.damageFlag).toBe(false);
  });
});
