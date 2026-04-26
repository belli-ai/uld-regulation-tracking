import { BuildUpCanvas } from "@/components/build-up-canvas";

type Props = {
  params: Promise<{
    flightNo: string;
    uldId: string;
  }>;
};

function decodeRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function BuildUpPage({ params }: Props) {
  const { flightNo, uldId } = await params;

  return (
    <BuildUpCanvas
      flightNo={decodeRouteSegment(flightNo)}
      uldId={decodeRouteSegment(uldId)}
    />
  );
}
