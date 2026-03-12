import type { Metadata } from "next";
import { Sora } from "next/font/google"; // Importing the new font
import WalletContextProvider from "@/components/WalletProvider";
import "@solana/wallet-adapter-react-ui/styles.css";

// Configuring the Sora font
const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "Solana Airdrop Claim - Celestial Event", // Enhanced Title
  description: "A special, one-time celestial event. Connect your wallet to claim your reward.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={sora.className}> {/* Applying the new font to the entire application */}
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
