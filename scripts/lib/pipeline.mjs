// Skrót kodu potoku danych. Inny skrót oznacza, że dane z poprzedniego budowania mogą mieć inny format,
// więc skrypt scripts/data.mjs nie może ich użyć ponownie.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const FILES = ['scripts/fetch-data.mjs', 'scripts/build-data.mjs']
const LIB_DIR = 'scripts/lib'

export function pipelineFiles(root = process.cwd()) {
    const lib = fs.readdirSync(path.join(root, LIB_DIR)).filter(name => name.endsWith('.mjs')).map(name => `${LIB_DIR}/${name}`)
    return [...FILES, ...lib].sort()
}

// Końce linii są ujednolicone, bo kopia robocza na Windows ma CRLF, a serwer budowania ma LF.
export function pipelineHash(root = process.cwd()) {
    const hash = crypto.createHash('sha1')
    for (const file of pipelineFiles(root)) {
        hash.update(`${file}\n`)
        hash.update(fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n'))
    }
    return hash.digest('hex').slice(0, 12)
}
