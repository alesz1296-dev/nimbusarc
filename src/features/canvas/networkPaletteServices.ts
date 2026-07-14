export const networkPaletteServiceIds = [
  "aws-vpc",
  "aws-public-subnet",
  "aws-private-subnet",
  "aws-internet-gateway",
  "aws-nat-gateway",
  "aws-transit-gateway",
  "aws-vpn-gateway",
  "aws-direct-connect",
] as const;

export function isNetworkPaletteService(serviceId: string) {
  return networkPaletteServiceIds.includes(serviceId as (typeof networkPaletteServiceIds)[number]);
}
