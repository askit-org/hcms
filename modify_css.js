const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'app/globals.css');
let css = fs.readFileSync(cssPath, 'utf8');

const rootRegex = /:root\s*\{[\s\S]*?--radius:\s*10px;\n\}/;

const newVars = `:root {
  --background: #f8fafc;
  --foreground: #0f172a;

  /* Brand */
  --accent: #0d9488;
  --accent-light: #14b8a6;
  --accent-glow: rgba(13, 148, 136, 0.15);

  /* Glass Surfaces */
  --surface-1: rgba(255, 255, 255, 0.8);
  --surface-2: rgba(255, 255, 255, 0.6);
  --surface-3: rgba(241, 245, 249, 0.6);
  --border: rgba(0, 0, 0, 0.08);
  --border-light: rgba(0, 0, 0, 0.04);

  /* Text */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;

  /* Status */
  --green: #10b981;
  --amber: #f59e0b;
  --red: #ef4444;
  --blue: #3b82f6;
  --purple: #8b5cf6;
  --indigo: #6366f1;

  --sidebar-width: 260px;
  --header-height: 64px;
  --radius: 10px;

  --hover-btn: rgba(0,0,0,0.04);
  --hover-table: rgba(0,0,0,0.025);
  
  --modal-bg: rgba(255,255,255,0.7);
  --modal-shadow: 0 24px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05) inset;
}

.dark {
  --background: #0b1120;
  --foreground: #f1f5f9;

  /* Glass Surfaces */
  --surface-1: rgba(15, 23, 42, 0.7);
  --surface-2: rgba(24, 33, 50, 0.6);
  --surface-3: rgba(36, 48, 70, 0.5);
  --border: rgba(255, 255, 255, 0.1);
  --border-light: rgba(255, 255, 255, 0.03);

  /* Text */
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  
  --accent-glow: rgba(13, 148, 136, 0.2);

  --hover-btn: rgba(255,255,255,0.04);
  --hover-table: rgba(255,255,255,0.025);
  
  --modal-bg: rgba(0,0,0,0.65);
  --modal-shadow: 0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05) inset;
}`;

css = css.replace(rootRegex, newVars);

// Replace hardcoded rgba for hover effects
css = css.replace(/background:\s*rgba\(255,255,255,0\.04\)/g, 'background: var(--hover-btn)');
css = css.replace(/background:\s*rgba\(255,255,255,0\.025\)/g, 'background: var(--hover-table)');
// Modal background and shadow
css = css.replace(/background:\s*rgba\(0,0,0,0\.65\)/g, 'background: var(--modal-bg)');
css = css.replace(/box-shadow:\s*0\s*24px\s*80px\s*rgba\(0,0,0,0\.7\),\s*0\s*0\s*0\s*1px\s*rgba\(255,255,255,0\.05\)\s*inset/g, 'box-shadow: var(--modal-shadow)');

// Also fix the radial gradient for light theme so it doesn't look weird?
// body::before has radial-gradient with alpha. That is fine, it just looks subtle in light mode too.

fs.writeFileSync(cssPath, css);
console.log('CSS modified');
