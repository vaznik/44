import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pot Roulette',
  description: 'Telegram Mini App – Pot Roulette',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="bg" />
        {children}
      </body>
    </html>
  );
}
