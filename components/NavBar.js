"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'center',
      gap: '2rem',
      padding: '1.5rem',
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      marginBottom: '2rem'
    }}>
      <Link href="/" style={{
        textDecoration: 'none',
        color: pathname === '/' ? '#0ea5e9' : 'rgba(255,255,255,0.6)',
        fontWeight: pathname === '/' ? 'bold' : 'normal',
        fontSize: '1.2rem',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        borderBottom: pathname === '/' ? '2px solid #0ea5e9' : 'none',
        paddingBottom: '5px',
        transition: 'all 0.2s'
      }}>
        Hytale Tracker
      </Link>
      <Link href="/mcpe" style={{
        textDecoration: 'none',
        color: pathname === '/mcpe' ? '#f59e0b' : 'rgba(255,255,255,0.6)',
        fontWeight: pathname === '/mcpe' ? 'bold' : 'normal',
        fontSize: '1.2rem',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        borderBottom: pathname === '/mcpe' ? '2px solid #f59e0b' : 'none',
        paddingBottom: '5px',
        transition: 'all 0.2s'
      }}>
        MCPE Tracker
      </Link>
    </nav>
  );
}
