import "./globals.css";

export const metadata = {
  title: "Cold Email Tool | Job Applications",
  description: "Send personalized cold emails with your resume to multiple HRs separately.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        {/* Prevent flash of wrong theme on load */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var s = localStorage.getItem('theme');
              var p = s || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
              document.documentElement.setAttribute('data-theme', p);
            } catch(e) {}
          })();
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
