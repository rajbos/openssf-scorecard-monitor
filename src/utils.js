const got = require('got')
const core = require('@actions/core')
const ejs = require('ejs')
const { readFile } = require('fs').promises
const { join } = require('path')
const { softAssign } = require('@ulisesgascon/soft-assign-deep-property')

const getProjectScore = async ({ platform, org, repo }) => {
  core.debug(`Getting project score for ${platform}/${org}/${repo}`)
  const response = await got(`https://api.securityscorecards.dev/projects/${platform}/${org}/${repo}`)
  const { score, date, repo: { commit } = {} } = JSON.parse(response.body)
  core.debug(`Got project score for ${platform}/${org}/${repo}: ${score} (${date})`)
  return { platform, org, repo, score, date, commit }
}

const getScore = ({ database, platform, org, repo }) => {
  const { current } = database?.[platform]?.[org]?.[repo] || {}
  return current || null
}

const saveScore = ({ database, platform, org, repo, score, date, commit }) => {
  softAssign(database, [platform, org, repo, 'previous'], [])
  const repoRef = database[platform][org][repo]

  if (repoRef.current) {
    repoRef.previous.push(repoRef.current)
  }
  repoRef.current = { score, date, commit }
}

const generateReportContent = async (scores) => {
  core.debug('Generating report content')
  const template = await readFile(join(process.cwd(), 'templates/report.ejs'), 'utf8')
  return ejs.render(template, { scores })
}

const generateIssueContent = async (scores) => {
  core.debug('Generating issue content')
  const scoresInScope = scores.filter(({ currentDiff }) => currentDiff)
  if (!scoresInScope.length) {
    return null
  }
  const template = await readFile(join(process.cwd(), 'templates/issue.ejs'), 'utf8')
  return ejs.render(template, { scores: scoresInScope })
}

module.exports = {
  getProjectScore,
  saveScore,
  getScore,
  generateReportContent,
  generateIssueContent
}
