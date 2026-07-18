import "./globals.css";

export const metadata = {
  title: "AutoApply Agent",
  description: "AI-powered job discovery, matching, tailoring, and application tracking.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        {/* Prevent flash of wrong theme/accent on load. A clean light
            dashboard is this project's default theme -- only an explicit
            prior choice of "dark" (saved by the sidebar's theme toggle)
            overrides it. The accent color logic here mirrors lib/theme.js
            exactly (duplicated, not imported, since this has to run as a
            plain inline script before React hydrates) so a saved custom
            color applies immediately instead of flashing the default
            indigo first. */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var s = localStorage.getItem('theme');
              document.documentElement.setAttribute('data-theme', s === 'dark' ? 'dark' : 'light');
            } catch(e) {}
            try {
              var hex = localStorage.getItem('autoapply_accent');
              if (hex) {
                var h = hex.replace('#', '');
                var num = parseInt(h, 16);
                var r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
                function lum(r,g,b){
                  var a = [r,g,b].map(function(v){
                    v /= 255;
                    return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
                  });
                  return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
                }
                var L = lum(r,g,b);
                var contrastWhite = (1.05) / (L + 0.05);
                var contrastBlack = (L + 0.05) / 0.05;
                var onColor = contrastWhite >= contrastBlack ? '#ffffff' : '#0a0a0a';
                var toward = onColor === '#ffffff' ? [0,0,0] : [255,255,255];
                var mix = function(amt){
                  var mr = r + (toward[0]-r)*amt, mg = g + (toward[1]-g)*amt, mb = b + (toward[2]-b)*amt;
                  var toHex = function(v){ return Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0'); };
                  return '#' + toHex(mr) + toHex(mg) + toHex(mb);
                };
                var root = document.documentElement.style;
                root.setProperty('--primary', hex);
                root.setProperty('--primary-hover', mix(0.18));
                root.setProperty('--primary-light', 'rgba(' + r + ',' + g + ',' + b + ',0.15)');
                root.setProperty('--primary-glow', 'rgba(' + r + ',' + g + ',' + b + ',0.28)');
                root.setProperty('--on-primary', onColor);
                root.setProperty('--scrollbar-thumb-hover', 'rgba(' + r + ',' + g + ',' + b + ',0.45)');
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
