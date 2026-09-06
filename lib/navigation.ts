export const PORTAL_NAVIGATION = [
  { href: '/feed', label: 'Bảng tin' },
  { href: '/community', label: 'Cộng đồng' },
  { href: '/activities', label: 'Hoạt động' },
  { href: '/members', label: 'Thành viên' },
  { href: '/profile', label: 'Hồ sơ' },
] as const;

export type PortalNavigationItem = (typeof PORTAL_NAVIGATION)[number];
