import fs from 'fs'
import path from 'path'

const outDir = 'dist'

function inlineAssets() {
  const indexPath = path.join(outDir, 'index.html')
  let html = fs.readFileSync(indexPath, 'utf-8')

  const assetsDir = path.join(outDir, 'assets')
  if (!fs.existsSync(assetsDir)) {
    console.log('No assets directory found')
    return
  }

  const files = fs.readdirSync(assetsDir)
  
  for (const file of files) {
    const filePath = path.join(assetsDir, file)
    if (!fs.statSync(filePath).isFile()) continue

    const content = fs.readFileSync(filePath, 'utf-8')
    fs.unlinkSync(filePath)

    if (file.endsWith('.css')) {
      html = html.replace(
        /<link rel="stylesheet"[^>]*href="\.\/assets\/[^"]*\.css"[^>]*>/,
        `<style>${content}</style>`
      )
      console.log(`Inlined CSS: ${file}`)
    } else if (file.endsWith('.js')) {
      html = html.replace(
        /<script[^>]*src="\.\/assets\/[^"]*\.js"[^>]*><\/script>/,
        `<script type="module">${content}</script>`
      )
      console.log(`Inlined JS: ${file}`)
    }
  }

  try {
    fs.rmdirSync(assetsDir)
  } catch (e) {}

  fs.writeFileSync(indexPath, html)
  console.log('Single file ready!')
}

inlineAssets()