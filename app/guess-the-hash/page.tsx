import dynamicImport from "next/dynamic";

const GuessTheHashClient = dynamicImport(() => import("./client"));

export default function GuessTheHashPage() {
  return <GuessTheHashClient />;
}

export const dynamic = "force-dynamic";
