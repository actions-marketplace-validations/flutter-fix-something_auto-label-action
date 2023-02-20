import * as core from '@actions/core'
import * as github from '@actions/github'
import {GitHub} from '@actions/github/lib/utils'

function getOctokit(): InstanceType<typeof GitHub> {
  // Get the GitHub token from the environment
  const token = core.getInput('github-token', {required: true})
  if (!token) {
    throw new Error('No token found, please set github-token input.')
  }
  return github.getOctokit(token)
}

async function run(): Promise<void> {
  try {
    if (github.context.payload.pull_request) {
      await handlePullRequest()
    } else if (github.context.payload.issue) {
      await handleIssue()
    } else {
      core.setFailed('Could not get issue or pull request from context.')
    }
  } catch (e) {
    core.setFailed(`action happen error: ${e}`)
  }
}

function randomColor(): string {
  let color = '#'
  const letters = '0123456789ABCDEF'
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
}

async function setIssueLabel(
  issueNumber: number,
  label: string
): Promise<void> {
  const kit = getOctokit()

  // check label is exist
  const {data: labels} = await kit.rest.issues.listLabelsOnIssue()
  const isExist = labels.some(item => item.name === label)

  if (isExist) {
    core.setOutput('Label is exist', `Label ${label} is exist, skip`)
    return
  }

  const owner = github.context.repo.owner
  const repo = github.context.repo.repo

  // check repo has the label
  const {data: repoLabels} = await kit.rest.issues.listLabelsForRepo()
  const isRepoExist = repoLabels.some(item => item.name === label)

  if (!isRepoExist) {
    // create label for repo
    await kit.rest.issues.createLabel({
      name: label,
      color: randomColor(),
      owner,
      repo
    })
  }

  // add label to issue
  await kit.rest.issues.addLabels({
    issue_number: issueNumber,
    labels: [label],
    owner,
    repo
  })
}

async function handleIssue(): Promise<void> {
  // Get the issue number from the context
  const issueNumber = github.context.payload.issue?.number

  // Get the issue title from the context
  const issueTitle = github.context.payload.issue?.title

  if (!issueNumber || !issueTitle) {
    core.setFailed('Could not get issue number or title from context')
    return
  }

  // Check issue title is string
  if (typeof issueTitle !== 'string') {
    core.setOutput('Not found title', 'The issue title is not string, skip')
    return
  }

  // handle issue title
  const regex = /(\[.*\])\s(.*)/
  const match = issueTitle.match(regex)

  if (!match) {
    core.setOutput('Not found title', 'Not fount issue title prefix, skip')
    return
  }

  const prefix = match[1]

  const labelPrefix = prefix.toLowerCase()
  // Found ignore case prefix 'bug'
  if (labelPrefix.includes('bug')) {
    setIssueLabel(issueNumber, 'Type: Bug')
  } else if (labelPrefix.includes('feature') || labelPrefix.includes('feat')) {
    setIssueLabel(issueNumber, 'Type: Feature')
  } else if (labelPrefix.includes('question') || labelPrefix.includes('help')) {
    setIssueLabel(issueNumber, 'Type: Question')
  } else {
    core.setOutput('Not fount title', 'Not fount issue title prefix, skip')
  }
}

async function handlePullRequest(): Promise<void> {
  // Get pull request number from the context
  const pullRequestNumber = github.context.payload.pull_request?.number
  if (!pullRequestNumber) {
    throw new Error('Could not get pull request number from context')
  }

  // Get pull request title from the context
  const pullRequestTitle = github.context.payload.pull_request?.title
  if (!pullRequestTitle) {
    throw new Error('Could not get pull request title from context')
  }

  const regex = /(\[.*\])\s(.*)/
  const match = pullRequestTitle.match(regex)

  if (!match) {
    core.setOutput(
      'Not found title',
      'Not fount pull request title prefix, skip'
    )
    return
  }

  const prefix = match[1]

  const labelPrefix = prefix.toLowerCase()

  if (typeof labelPrefix !== 'string') {
    core.setOutput(
      'Not found title',
      'The pull request title is not string, skip'
    )
    return
  }

  // Found ignore case prefix 'bug'

  if (labelPrefix.includes('bug')) {
    setIssueLabel(pullRequestNumber, 'Type: Bug')
  } else if (labelPrefix.includes('feature') || labelPrefix.includes('feat')) {
    setIssueLabel(pullRequestNumber, 'Type: Feature')
  } else {
    core.setOutput(
      'Not fount title',
      'Not fount pull request title prefix, skip'
    )
  }
}

run()
