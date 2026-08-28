import fs from 'node:fs'
import path from 'node:path'

const [adminPath, waterPath, outputPath] = process.argv.slice(2)
if (!adminPath || !waterPath || !outputPath) {
  throw new Error('Usage: node wrap-geojson.mjs <admin.geojson> <water.geojson> <map-data.js>')
}

const administrative = JSON.parse(fs.readFileSync(adminPath, 'utf8'))
const water = JSON.parse(fs.readFileSync(waterPath, 'utf8'))
const payload = { administrative, water }
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `window.HK_MAP_DATA = ${JSON.stringify(payload)};\n`, 'utf8')
