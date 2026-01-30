import dynamicImport from "next/dynamic";

const GuessTheHashStatsClient = dynamicImport(() => import("./client"));

export default function GuessTheHashStatsPage() {
  return <GuessTheHashStatsClient />;
}

export const dynamic = "force-dynamic";
