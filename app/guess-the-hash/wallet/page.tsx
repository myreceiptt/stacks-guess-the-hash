import dynamicImport from "next/dynamic";

const GuessTheHashWalletClient = dynamicImport(() => import("./client"));

export default function GuessTheHashWalletPage() {
  return <GuessTheHashWalletClient />;
}

export const dynamic = "force-dynamic";
