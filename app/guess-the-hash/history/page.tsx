import dynamicImport from "next/dynamic";

const GuessTheHashHistoryClient = dynamicImport(() => import("./client"));

export default function GuessTheHashHistoryPage() {
  return <GuessTheHashHistoryClient />;
}

export const dynamic = "force-dynamic";
