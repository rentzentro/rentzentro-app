// app/landlord/layout.tsx
import LandlordAccessGate from './LandlordAccessGate';

export default function LandlordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LandlordAccessGate>{children}</LandlordAccessGate>;
}
