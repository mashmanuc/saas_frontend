import fs from 'node:fs'
import path from 'node:path'

const ukPath = path.join(process.cwd(), 'src', 'i18n', 'locales', 'uk.json')
const ukData = JSON.parse(fs.readFileSync(ukPath, 'utf-8'))

console.log('soloWorkspace structure:')
console.log(JSON.stringify(ukData.soloWorkspace, null, 2).substring(0, 500))

console.log('\n\nDirect access test:')
console.log('soloWorkspace.toolbar.sections.draw:', ukData.soloWorkspace?.toolbar?.sections?.draw)
console.log('soloWorkspace.toolbar.tools.pen:', ukData.soloWorkspace?.toolbar?.tools?.pen)
