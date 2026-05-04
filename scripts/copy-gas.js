import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyGasFiles() {
  ensureDir(distDir);

  // Copy root .gs files and appsscript.json
  const gasDir = path.resolve('gas');
  for (const file of fs.readdirSync(gasDir)) {
    const srcPath = path.join(gasDir, file);
    if (fs.statSync(srcPath).isFile()) {
      if (file.endsWith('.gs') || file === 'appsscript.json') {
        fs.copyFileSync(srcPath, path.join(distDir, file));
        console.log(`Copied: ${file}`);
      }
    } else if (fs.statSync(srcPath).isDirectory() && file === 'lib') {
      const libDest = path.join(distDir, 'lib');
      ensureDir(libDest);
      for (const libFile of fs.readdirSync(srcPath)) {
        const libSrcPath = path.join(srcPath, libFile);
        if (libFile.endsWith('.gs')) {
          fs.copyFileSync(libSrcPath, path.join(libDest, libFile));
          console.log(`Copied: lib/${libFile}`);
        }
      }
    }
  }

  // Process index.html to split into GAS-compatible template files
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('ERROR: index.html not found in dist/');
    process.exit(1);
  }

  // Read Vite's index.html FIRST
  let htmlContent = fs.readFileSync(indexPath, 'utf-8');

  // Extract and replace CSS
  const cssMatch = htmlContent.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
  if (cssMatch) {
    const cssPath = path.join(distDir, cssMatch[1].replace(/^\.\//, ''));
    if (fs.existsSync(cssPath)) {
      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      fs.writeFileSync(path.join(distDir, 'Stylesheet.html'), `<style>\n${cssContent}\n</style>`);
      console.log('Created: Stylesheet.html');
      htmlContent = htmlContent.replace(cssMatch[0], '<?!= include(\'Stylesheet\'); ?>');
      fs.unlinkSync(cssPath);
    }
  }

  // Extract and replace JS
  const jsMatch = htmlContent.match(/<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);
  if (jsMatch) {
    const jsPath = path.join(distDir, jsMatch[1].replace(/^\.\//, ''));
    if (fs.existsSync(jsPath)) {
      const jsContent = fs.readFileSync(jsPath, 'utf-8');
      fs.writeFileSync(path.join(distDir, 'JavaScript.html'), `<script type="module">\n${jsContent}\n</script>`);
      console.log('Created: JavaScript.html');
      htmlContent = htmlContent.replace(jsMatch[0], '<?!= include(\'JavaScript\'); ?>');
      fs.unlinkSync(jsPath);
    }
  }

  // Remove remaining asset references
  htmlContent = htmlContent.replace(/<link[^>]*rel="icon"[^>]*>/g, '');
  htmlContent = htmlContent.replace(/<link[^>]*rel="modulepreload"[^>]*>/g, '');

  // CRITICAL FIX for Windows: Delete index.html BEFORE writing Index.html
  // because Windows filesystem is case-insensitive
  fs.unlinkSync(indexPath);
  
  // Now write Index.html (GAS template)
  fs.writeFileSync(path.join(distDir, 'Index.html'), htmlContent);
  console.log('Created: Index.html (GAS template)');

  // Clean up assets dir
  const assetsDir = path.join(distDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    fs.rmSync(assetsDir, { recursive: true, force: true });
  }

  console.log('All GAS files ready in dist/');
}

copyGasFiles();