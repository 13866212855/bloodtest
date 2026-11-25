import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '清糖笔记 · 个人血糖管理与趋势分析',
  description:
    '便捷记录每次血糖测量结果，提供TIR达标率、24小时时段波动分析、趋势图表与复诊报告导出的个人血糖管理工具。',
  openGraph: {
    title: '清糖笔记 · 个人血糖管理与趋势分析',
    description:
      '便捷记录每次血糖测量结果，提供TIR达标率、24小时时段波动分析、趋势图表与复诊报告导出的个人血糖管理工具。',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '清糖笔记 · 个人血糖管理与趋势分析',
    description:
      '便捷记录每次血糖测量结果，提供TIR达标率、24小时时段波动分析、趋势图表与复诊报告导出的个人血糖管理工具。',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#f7f9fb] text-slate-900 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
