#!/usr/bin/env node
/**
 * Tiny local fake of the GitHub pulls API (GET/POST /repos/:repo/pulls), so the
 * API's B5b sync can "open" its rolling PR without touching GitHub.
 *   node fake-github.js <port> <repo> <stateFile>
 * State (the PR list) is written to <stateFile> after every change.
 * `POST /__merge` marks every open PR closed (used by hq-merge.sh).
 */
'use strict'
const http = require('http')
const fs = require('fs')
const [port, repo, stateFile] = process.argv.slice(2)
const prefix = `/repos/${repo}/pulls`
const pulls = []
const save = () => fs.writeFileSync(stateFile, JSON.stringify(pulls, null, 2))
save()
http
  .createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const send = (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(data))
      }
      const url = new URL(req.url || '/', 'http://localhost')
      if (url.pathname === '/__merge' && req.method === 'POST') {
        pulls.forEach((p) => (p.state = 'closed'))
        save()
        return send(200, { ok: true })
      }
      if (url.pathname !== prefix) return send(404, { message: 'Not Found' })
      if (req.method === 'GET') {
        const head = url.searchParams.get('head') || ''
        const branch = head.includes(':') ? head.split(':')[1] : head
        return send(
          200,
          pulls.filter(
            (p) =>
              p.state === (url.searchParams.get('state') || 'open') &&
              p.head === branch &&
              p.base === url.searchParams.get('base')
          )
        )
      }
      if (req.method === 'POST') {
        const input = JSON.parse(body || '{}')
        if (
          pulls.some(
            (p) =>
              p.state === 'open' &&
              p.head === input.head &&
              p.base === input.base
          )
        )
          return send(422, { message: 'A pull request already exists' })
        const pr = {
          number: pulls.length + 1,
          html_url: `https://github.example/${repo}/pull/${pulls.length + 1}`,
          title: input.title,
          body: input.body,
          head: input.head,
          base: input.base,
          state: 'open',
        }
        pulls.push(pr)
        save()
        return send(201, pr)
      }
      send(405, { message: 'Method Not Allowed' })
    })
  })
  .listen(Number(port), '127.0.0.1', () =>
    console.log(`fake GitHub on 127.0.0.1:${port} (${repo})`)
  )
