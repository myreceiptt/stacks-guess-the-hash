import "./globals.css";

export const metadata = {
  title: "Guess The Hash",
  description: "Stacks testnet read-only UI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
