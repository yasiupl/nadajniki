import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { bipLinks, releaseDate } from '../scripts/lib/sources.mjs'
import { pipelineHash, pipelineFiles } from '../scripts/lib/pipeline.mjs'

test('bipLinks and releaseDate read the release date from the BIP page', () => {
    const html = `<a href="/download/gfx/bip/pl/x/dc_-_stan_na_2026-09-25.xlsx" title="dc">DC</a>
        <a href="/download/gfx/bip/pl/x/obi_-_stan_na_2026-09-25.xlsx">OBI</a>
        <a href="/download/gfx/bip/pl/x/obi_-_stan_na_2026-09-25.xlsx">OBI again</a>
        <a href="/download/gfx/bip/pl/x/_legenda_do_wykazu_rrl.pdf">PDF</a>`
    const links = bipLinks(html)
    assert.equal(links.length, 2)
    assert.equal(links.map(releaseDate).sort().pop(), '2026-09-25')
    assert.equal(releaseDate('DC_2026-08-25.xlsx'), '2026-08-25')
})

test('pipelineHash covers the data scripts and ignores line endings', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-'))
    fs.mkdirSync(path.join(root, 'scripts', 'lib'), { recursive: true })
    const write = (file, text) => fs.writeFileSync(path.join(root, file), text)
    write('scripts/fetch-data.mjs', 'a\nb\n')
    write('scripts/build-data.mjs', 'c\n')
    write('scripts/lib/stations.mjs', 'd\n')
    assert.deepEqual(pipelineFiles(root), ['scripts/build-data.mjs', 'scripts/fetch-data.mjs', 'scripts/lib/stations.mjs'])
    const hash = pipelineHash(root)
    assert.match(hash, /^[0-9a-f]{12}$/)
    write('scripts/fetch-data.mjs', 'a\r\nb\r\n')
    assert.equal(pipelineHash(root), hash, 'CRLF and LF give the same hash')
    write('scripts/lib/stations.mjs', 'changed\n')
    assert.notEqual(pipelineHash(root), hash, 'a change in the pipeline changes the hash')
    fs.rmSync(root, { recursive: true, force: true })
})
