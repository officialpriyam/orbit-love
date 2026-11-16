import "./globals.css";
import { headers } from "next/headers";
export const metadata = {
  title: "Orbit — A little closer to love",
  description:
    "Meet someone who shares your values and cares about the same little things. Dating and friendship through thoughtful matching rounds. Developed by priyx.",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce =
    process.env.ORBIT_PREVIEW_EXPORT === "1"
      ? undefined
      : (await headers()).get("x-nonce") || undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('orbit-theme');document.documentElement.dataset.theme=(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))?'dark':'light'}catch(e){}",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Baskervville:ital@0;1&family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
