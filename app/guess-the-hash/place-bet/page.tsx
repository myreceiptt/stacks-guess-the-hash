import dynamicImport from "next/dynamic";

const PlaceBetClient = dynamicImport(() => import("./client"));

export default function PlaceBetPage() {
  return <PlaceBetClient />;
}

export const dynamic = "force-dynamic";
