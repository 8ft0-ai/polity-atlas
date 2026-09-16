import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Polity Atlas',
  description:
    'A source-led geographic workspace for government, parliament, elections, and diplomatic relations.',
};

const themeScript = `
  try {
    const saved = localStorage.getItem('polity-atlas-theme');
    const dark = saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (_) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
