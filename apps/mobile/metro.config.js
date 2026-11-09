// 모노레포: 워크스페이스 루트까지 감시하고 node_modules 를 두 곳에서 찾는다.
// 이게 없으면 packages/* 를 고쳐도 다시 번들되지 않고, 루트로 호이스트된 의존성을 못 찾는다.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')
const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true

module.exports = config
