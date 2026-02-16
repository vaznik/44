'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

type IconProps = { size?: number; className?: string };

function IconGrid({ size = 22, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.92"
      />
    </svg>
  );
}

function IconPlus({ size = 22, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.35"
      />
    </svg>
  );
}

function IconWallet({ size = 22, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7.5c0-1.4 1.1-2.5 2.5-2.5H18c1.1 0 2 .9 2 2v2.2"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.9"
      />
      <path
        d="M4 9.7V17c0 1.1.9 2 2 2h12.5c1.4 0 2.5-1.1 2.5-2.5v-6c0-1.1-.9-2-2-2H6c-1.1 0-2-.9-2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M16.8 13h3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function IconHistory({ size = 22, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 22a9 9 0 1 0-8.6-6.4"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.9"
      />
      <path d="M3 12v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}

function IconUser({ size = 22, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 12a4.1 4.1 0 1 0 0-8.2A4.1 4.1 0 0 0 12 12Z" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.5 20.2c1.7-3.3 4.3-5 7.5-5s5.8 1.7 7.5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.75"
      />
    </svg>
  );
}

const tabs = [
  { href: '/', label: 'Lobby', icon: IconGrid },
  { href: '/create', label: 'Create', icon: IconPlus },
  { href: '/deposit', label: 'Wallet', icon: IconWallet },
  { href: '/history', label: 'History', icon: IconHistory },
  { href: '/profile', label: 'Profile', icon: IconUser },
];

export function Nav() {
  const p = usePathname();
  return (
    <div className="navWrap">
      <div className="navBar">
        {tabs.map((t) => {
          const active = p === t.href || (t.href !== '/' && p.startsWith(t.href));
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} className={'navItem ' + (active ? 'active' : '')}>
              <Icon size={22} />
              <div className="navLabel">{t.label}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
