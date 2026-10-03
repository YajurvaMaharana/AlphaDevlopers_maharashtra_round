import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FairDrop — Anti-Bot Flash Crowd Allocation Platform',
  description: 'High-demand ticket registration platform selling 500 seats to 50,000 fans with guaranteed bot resistance and cryptographic fairness.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-blue-500/30 selection:text-blue-200">
        {children}
      </body>
    </html>
  );
}
