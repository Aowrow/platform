import Link from 'next/link';
import { ReactNode } from 'react';

const navItems = [
  { href: '/', label: '能力首页' },
  { href: '/features/fenjingtu', label: '分镜图' },
  { href: '/features/fenjingtu-splitter', label: '分镜图分割' },
  { href: '/assets', label: '资产管理' },
  { href: '/settings', label: '系统配置' }
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-6 px-4 py-6 md:px-6">
      <aside className="hidden w-64 shrink-0 rounded-3xl border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur md:block">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">ComfyUI</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">内部 AIGC 平台</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">面向新手的场景化能力平台，而不是通用参数控制台。</p>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
